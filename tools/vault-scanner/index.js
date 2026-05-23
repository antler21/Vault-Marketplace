const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const os = require('os')
const zlib = require('zlib')
const crypto = require('crypto')
const { exec } = require('child_process')

const PORT = 35199
const VERSION = '0.6.21'

// ─── Local Storage ────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.env.APPDATA || os.homedir(), 'aio-tool')
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json')
const CONFIG_FILE = path.join(DATA_DIR, 'config.json')
const PACKS_FILE = path.join(DATA_DIR, 'csr2-packs.json')

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function loadJson(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return def }
}

function saveJson(file, data) {
  ensureDataDir()
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

function loadAccounts() { return loadJson(ACCOUNTS_FILE, []) }
function saveAccounts(a) { saveJson(ACCOUNTS_FILE, a) }
function loadConfig() { const c = loadJson(CONFIG_FILE, {}); if (!c.webappUrl) c.webappUrl = 'https://antlervaults.store'; return c }
function saveConfig(c) { saveJson(CONFIG_FILE, c) }
function loadPacks() { return loadJson(PACKS_FILE, []) }
function savePacks(p) { saveJson(PACKS_FILE, p) }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }

// ─── Riot Client API ─────────────────────────────────────────────────────────

const RC_LOCKFILE_PATH = path.join(process.env.LOCALAPPDATA || '', 'Riot Games', 'Riot Client', 'Config', 'lockfile')

function findRCLockfile() {
  try { if (fs.existsSync(RC_LOCKFILE_PATH)) return fs.readFileSync(RC_LOCKFILE_PATH, 'utf8').trim() } catch {}
  return null
}

function parseRCLockfile(content) {
  const parts = content.split(':')
  return { port: parseInt(parts[2]), password: parts[3] }
}

function rcRequest(port, password, method, endpoint, body) {
  return new Promise((resolve) => {
    const auth = Buffer.from('riot:' + password).toString('base64')
    const bodyStr = body ? JSON.stringify(body) : null
    const req = https.request({
      hostname: '127.0.0.1', port, path: endpoint, method,
      headers: {
        Authorization: 'Basic ' + auth,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
      rejectUnauthorized: false,
    }, (res) => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 300, data: JSON.parse(raw), status: res.statusCode }) }
        catch { resolve({ ok: res.statusCode < 300, data: {}, status: res.statusCode }) }
      })
    })
    req.on('error', (e) => resolve({ ok: false, data: { error: e.message }, status: null }))
    req.setTimeout(10000, () => { req.destroy(); resolve({ ok: false, data: { error: 'Timeout' }, status: null }) })
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

async function riotLogin(username, password) {
  const lf = findRCLockfile()
  if (!lf) throw new Error('Riot Client not detected. Open Riot Client first.')
  const { port, password: rcPass } = parseRCLockfile(lf)

  // Sign out any existing session, then wait 2s for it to clear
  log(`[login:${username}] DELETE session...`)
  const delRes = await rcRequest(port, rcPass, 'DELETE', '/rso-auth/v1/session')
  log(`[login:${username}] DELETE -> status=${delRes.status} ok=${delRes.ok} data=${JSON.stringify(delRes.data)?.slice(0, 120)}`)
  await new Promise(r => setTimeout(r, 2000))

  // Submit credentials
  log(`[login:${username}] PUT credentials...`)
  const res = await rcRequest(port, rcPass, 'PUT', '/rso-auth/v1/session/credentials', {
    username, password, persistLogin: false
  })
  log(`[login:${username}] PUT -> status=${res.status} ok=${res.ok} type=${res.data?.type} error=${res.data?.error} data=${JSON.stringify(res.data)?.slice(0, 120)}`)
  if (!res.ok) {
    const msg = res.data?.message || res.data?.error || JSON.stringify(res.data)
    throw new Error('Login failed: ' + msg + ' (status ' + res.status + ')')
  }
  if (res.data?.type === 'multifactor') throw new Error('2FA required — not supported')
  if (res.data?.type === 'auth_failure' || res.data?.error === 'auth_failure') throw new Error('Wrong username or password')
  if (res.data?.type === 'authenticated') return res.data

  // Auth is async — poll GET /rso-auth/v1/session until authenticated
  const deadline = Date.now() + 25000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1000))
    const check = await rcRequest(port, rcPass, 'GET', '/rso-auth/v1/session')
    log(`[login:${username}] GET poll -> status=${check.status} type=${check.data?.type} error=${check.data?.error}`)
    if (check.ok && check.data?.type === 'authenticated') return check.data
    if (check.data?.type === 'multifactor') throw new Error('2FA required — not supported')
    if (check.data?.type === 'auth_failure' || check.data?.error === 'auth_failure') throw new Error('Wrong username or password')
  }
  throw new Error('Login timed out — Riot Client did not respond in time')
}

const RC_SERVICE_PATHS = [
  'C:\\Riot Games\\Riot Client\\RiotClientServices.exe',
  path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Riot Games', 'Riot Client', 'RiotClientServices.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Riot Games', 'Riot Client', 'RiotClientServices.exe'),
]

async function restartRiotClient() {
  // Kill everything Riot-related
  await new Promise(r => exec('taskkill /F /IM "Riot Client.exe" /T & taskkill /F /IM RiotClientServices.exe /T & taskkill /F /IM LeagueClient.exe /T & taskkill /F /IM LeagueClientUx.exe /T', r))
  await new Promise(r => setTimeout(r, 2000))
  // Find and relaunch RiotClientServices
  let launched = false
  for (const p of RC_SERVICE_PATHS) {
    if (fs.existsSync(p)) {
      exec(`"${p}"`)
      launched = true
      log('Riot Client relaunched from: ' + p)
      break
    }
  }
  if (!launched) log('WARN: Could not find RiotClientServices.exe to relaunch')
  return launched
}

async function riotLogout() {
  const lf = findRCLockfile()
  if (!lf) return
  const { port, password: rcPass } = parseRCLockfile(lf)
  await rcRequest(port, rcPass, 'DELETE', '/rso-auth/v1/session')
}

async function launchLeague() {
  const lf = findRCLockfile()
  if (!lf) throw new Error('Riot Client not detected.')
  const { port, password: rcPass } = parseRCLockfile(lf)
  const res = await rcRequest(port, rcPass, 'POST', '/product-launcher/v1/products/league_of_legends/patchlines/live', {})
  log(`[launch-league] HTTP ${res.status} ok=${res.ok} data=${JSON.stringify(res.data)?.slice(0, 200)}`)
  if (!res.ok) throw new Error(`Launch failed: HTTP ${res.status} — ${JSON.stringify(res.data)?.slice(0, 100)}`)
}

async function getLeaguePatchState() {
  const lf = findRCLockfile()
  if (!lf) return { error: 'no_lockfile', skip: true }
  try {
    const { port, password: rcPass } = parseRCLockfile(lf)
    const res = await rcRequest(port, rcPass, 'GET', '/patch/v1/products/league_of_legends')
    log(`[league-state] HTTP ${res.status}: ${JSON.stringify(res.data)?.slice(0, 500)}`)
    if (!res.ok || !res.data) return { error: 'api_error', status: res.status, skip: true }
    const d = res.data
    const action = String(d.action || '').toLowerCase()
    const stateType = String(d.product_state?.type || d.status || '').toLowerCase()
    const progress = d.progress ?? d.product_state?.percent ?? null
    const patching = action === 'patching' || action === 'checking_for_patches' || stateType === 'patching' || stateType === 'downloading'
    const needs_repair = action === 'repairing' || stateType === 'needs_repair' || stateType === 'corrupted'
    const needs_patch = !patching && !needs_repair && (stateType === 'needs_update' || stateType === 'patch_available' || action === 'needs_update')
    const ready = !patching && !needs_repair && !needs_patch
    return { ready, patching, needs_repair, needs_patch, progress, raw_action: action, raw_state: stateType }
  } catch (e) {
    log(`[league-state] error: ${e.message}`)
    return { error: e.message, skip: true }
  }
}

// ─── Server state ─────────────────────────────────────────────────────────────

let webappScanning = false
let pendingImport = null
let _lcuOnline = false          // cached LCU status — refreshed every 3s
let _shutdownTimer = null       // set by /shutdown, cancelled by /heartbeat (handles refresh vs close)

// ─── LCU Discovery ───────────────────────────────────────────────────────────

const LOCKFILE_PATHS = [
  'C:\\Riot Games\\League of Legends\\lockfile',
  path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Riot Games\\League of Legends\\lockfile'),
  path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Riot Games\\League of Legends\\lockfile'),
  path.join(process.env.LOCALAPPDATA || '', '..\\Local\\Riot Games\\League of Legends\\lockfile'),
]

function findLockfile() {
  for (const p of LOCKFILE_PATHS) {
    try { if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim() } catch {}
  }
  return null
}

function parseLockfile(content) {
  const parts = content.split(':')
  return { port: parseInt(parts[2]), password: parts[3] }
}

// ─── LCU API ─────────────────────────────────────────────────────────────────

function lcuGet(lcuPort, password, endpoint) {
  return new Promise((resolve) => {
    const auth = Buffer.from(`riot:${password}`).toString('base64')
    const req = https.request({
      hostname: '127.0.0.1', port: lcuPort, path: endpoint, method: 'GET',
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      rejectUnauthorized: false,
    }, (res) => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 300, data: JSON.parse(raw), status: res.statusCode }) }
        catch { resolve({ ok: false, data: null, status: res.statusCode }) }
      })
    })
    req.on('error', () => resolve({ ok: false, data: null, status: null }))
    req.setTimeout(8000, () => { req.destroy(); resolve({ ok: false, data: null, status: null }) })
    req.end()
  })
}

function lcuDelete(lcuPort, password, endpoint) {
  return new Promise((resolve) => {
    const auth = Buffer.from(`riot:${password}`).toString('base64')
    const req = https.request({
      hostname: '127.0.0.1', port: lcuPort, path: endpoint, method: 'DELETE',
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      rejectUnauthorized: false,
    }, (res) => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 300, data: raw ? JSON.parse(raw) : null, status: res.statusCode }) }
        catch { resolve({ ok: res.statusCode < 300, data: null, status: res.statusCode }) }
      })
    })
    req.on('error', () => resolve({ ok: false, data: null, status: null }))
    req.setTimeout(8000, () => { req.destroy(); resolve({ ok: false, data: null, status: null }) })
    req.end()
  })
}

async function unfriendAll() {
  const lf = findLockfile()
  if (!lf) throw new Error('No League client detected. Make sure League is open and fully loaded.')
  const { port, password } = parseLockfile(lf)
  let totalRemoved = 0
  for (let attempt = 1; attempt <= 5; attempt++) {
    const friendsRes = await lcuGet(port, password, '/lol-chat/v1/friends')
    if (!friendsRes.ok) throw new Error('Could not fetch friends list (status ' + friendsRes.status + ').')
    const friends = (friendsRes.data || []).filter(f => f.id)
    log(`[unfriend-all] attempt ${attempt}: ${friends.length} friends found`)
    if (friends.length === 0) break
    for (const f of friends) {
      const r = await lcuDelete(port, password, '/lol-chat/v1/friends/' + encodeURIComponent(f.id))
      if (r.ok || r.status === 204) totalRemoved++
    }
    await new Promise(r => setTimeout(r, 1500)) // brief pause before re-checking
  }
  log(`[unfriend-all] Done: ${totalRemoved} total removed`)
  return { count: totalRemoved }
}

async function pMap(items, fn, concurrency = 8) {
  const results = []
  for (let i = 0; i < items.length; i += concurrency) {
    results.push(...await Promise.all(items.slice(i, i + concurrency).map(fn)))
  }
  return results
}

// Extract itemIds from various LCU inventory response shapes
function extractIds(data) {
  if (!data) return []
  // Plain array: [{itemId: N, ...}]
  if (Array.isArray(data)) {
    return data.map(i => i.itemId ?? i.id).filter(x => x != null && x !== 0)
  }
  // Nested: {data: {items: {TYPE: [...]}}}
  if (data.data?.items && typeof data.data.items === 'object') {
    return Object.values(data.data.items).flat().map(i => i.itemId ?? i.id).filter(x => x != null && x !== 0)
  }
  // Wrapped: {items: [...]}
  if (Array.isArray(data.items)) {
    return data.items.map(i => i.itemId ?? i.id).filter(x => x != null && x !== 0)
  }
  return []
}

function debugRes(name, res) {
  if (!res.ok) {
    log(`  [${name}] WARN: status=${res.status}, data=${JSON.stringify(res.data)?.slice(0, 120)}`)
    return
  }
  const d = res.data
  if (Array.isArray(d)) log(`  [${name}] array[${d.length}], first=${JSON.stringify(d[0])?.slice(0, 100)}`)
  else if (d && typeof d === 'object') log(`  [${name}] object keys=${Object.keys(d).join(',')}`)
  else log(`  [${name}] ${typeof d}: ${String(d).slice(0, 80)}`)
}

// ─── Rank History Parser ─────────────────────────────────────────────────────

function parseRankItemName(name) {
  if (!name || typeof name !== 'string') return null
  // Normalize: en/em dashes → hyphen, "Grand Master" → "Grandmaster", strip trailing " Icon"
  const n = name.trim().replace(/[–—]/g, '-').replace(/grand\s+master/gi, 'Grandmaster').replace(/\s+Icon$/i, '')
  const RANK_RE = /^(iron|bronze|silver|gold|platinum|emerald|diamond|master|grandmaster|challenger)$/i
  let m

  // Season 1 icon: "Season 1 Reward - {rank}"
  m = n.match(/^Season 1 Reward - (\w+)$/i)
  if (m && RANK_RE.test(m[1])) return { year: 2011, split: null, rank: m[1].toUpperCase() }

  // Season 1 icon silver exception: "Season 1 {rank}"
  m = n.match(/^Season 1 (\w+)$/i)
  if (m && RANK_RE.test(m[1])) return { year: 2011, split: null, rank: m[1].toUpperCase() }

  // Season 2 icon: "Season 2 Reward - {rank} Solo"
  m = n.match(/^Season 2 Reward - (\w+) Solo$/i)
  if (m && RANK_RE.test(m[1])) return { year: 2012, split: null, rank: m[1].toUpperCase() }

  // Season 3 icon: "Season 3 - {rank}"
  m = n.match(/^Season 3 - (\w+)$/i)
  if (m && RANK_RE.test(m[1])) return { year: 2013, split: null, rank: m[1].toUpperCase() }

  // Season 2014-2016 icon: "Season {year} - Solo {rank}"
  m = n.match(/^Season (201[4-6]) - Solo (\w+)$/i)
  if (m && RANK_RE.test(m[2])) return { year: parseInt(m[1]), split: null, rank: m[2].toUpperCase() }

  // Season 2017-2022 icon: "Season {year} - Solo/Duo {rank}"
  m = n.match(/^Season (201[7-9]|202[0-2]) - Solo\/Duo (\w+)$/i)
  if (m && RANK_RE.test(m[2])) return { year: parseInt(m[1]), split: null, rank: m[2].toUpperCase() }

  // Season 2023 icon splits: "Season 2023 - Split {n} - Solo/Duo {rank}"
  m = n.match(/^Season 2023 - Split (\d+) - Solo\/Duo (\w+)$/i)
  if (m && RANK_RE.test(m[2])) return { year: 2023, split: parseInt(m[1]), rank: m[2].toUpperCase() }

  // Season 2024+ icon: "Season Year {year} - {rank}"
  m = n.match(/^Season Year (20\d{2}) - (\w+)$/i)
  if (m && RANK_RE.test(m[2])) return { year: parseInt(m[1]), split: null, rank: m[2].toUpperCase() }

  // Emote 2019-2023: "{year} - Split {n} - {rank}"
  m = n.match(/^(20(?:19|2[0-3])) - Split (\d+) - (\w+)$/i)
  if (m && RANK_RE.test(m[3])) return { year: parseInt(m[1]), split: parseInt(m[2]), rank: m[3].toUpperCase() }

  // Emote 2024+: "Season {year} - End of Year - {rank}"
  m = n.match(/^Season (20\d{2}) - End of Year - (\w+)$/i)
  if (m && RANK_RE.test(m[2])) return { year: parseInt(m[1]), split: null, rank: m[2].toUpperCase() }

  return null
}

function buildRankHistory(entries, accountCreatedEstimate) {
  const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER']
  const currentYear = new Date().getFullYear()

  let startYear = 2011
  if (accountCreatedEstimate) {
    const y = parseInt(accountCreatedEstimate.slice(0, 4))
    if (!isNaN(y) && y >= 2011) startYear = y
  }
  const startSeason = startYear - 2010
  const currentSeason = currentYear - 2010

  // Group by year, separating split vs non-split entries
  const byYear = {}
  for (const e of entries) {
    if (!byYear[e.year]) byYear[e.year] = { splits: [], noSplit: null }
    if (e.split != null) {
      byYear[e.year].splits.push(e)
    } else {
      const cur = byYear[e.year].noSplit
      if (!cur || TIERS.indexOf(e.rank) > TIERS.indexOf(cur.rank)) {
        byYear[e.year].noSplit = e
      }
    }
  }

  const seasons = []
  for (let s = startSeason; s <= currentSeason; s++) {
    const year = s + 2010
    const yd = byYear[year]
    if (!yd) {
      seasons.push({ season: s, year, splits: [{ split: null, rank: null }] })
    } else if (yd.splits.length > 0) {
      const sorted = [...yd.splits].sort((a, b) => a.split - b.split)
      seasons.push({ season: s, year, splits: sorted.map(e => ({ split: e.split, rank: e.rank })) })
    } else {
      seasons.push({ season: s, year, splits: [{ split: null, rank: yd.noSplit ? yd.noSplit.rank : null }] })
    }
  }
  return seasons
}

function findPeakFromHistory(seasons) {
  const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER']
  let peakTier = null, peakSeason = null, peakSplit = null
  for (const s of seasons) {
    for (const sp of s.splits) {
      if (!sp.rank) continue
      const idx = TIERS.indexOf(sp.rank)
      if (idx === -1) continue
      if (!peakTier || idx > TIERS.indexOf(peakTier)) {
        peakTier = sp.rank; peakSeason = s.season; peakSplit = sp.split
      }
    }
  }
  if (!peakTier) return null
  return `${peakTier} (S${peakSeason}${peakSplit != null ? ` Split ${peakSplit}` : ''})`
}

// ─── Scan Logic ──────────────────────────────────────────────────────────────

async function runScan(lcuPort, password) {
  log('Fetching summoner info...')
  const summonerRes = await lcuGet(lcuPort, password, '/lol-summoner/v1/current-summoner')
  if (!summonerRes.ok || !summonerRes.data) throw new Error('Could not read summoner — is the League client fully loaded?')
  const summoner = summonerRes.data
  const summonerId = summoner.summonerId
  log(`Summoner: ${summoner.gameName || summoner.displayName} (level ${summoner.summonerLevel})`)

  log('Fetching all inventory data in parallel...')
  const [skinsRes, lootRes, emotesRes, iconsRes, wardsRes, finishersRes, walletRes,
         regionRes, tftCompanionsRes, tftTacticianRes, tftCompanionV1Res, tftMapSkinsRes, tftDamageSkinsRes,
         masteryCollRes, masteryLocalRes, skinInvRes] = await Promise.all([
    lcuGet(lcuPort, password, `/lol-champions/v1/inventories/${summonerId}/skins-minimal`),
    lcuGet(lcuPort, password, '/lol-loot/v1/player-loot'),
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/EMOTE'),
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/SUMMONER_ICON'),
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/WARD_SKIN'),
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/NEXUS_FINISHER'),
    lcuGet(lcuPort, password, '/lol-store/v1/wallet'),
    lcuGet(lcuPort, password, '/riotclient/region-locale'),
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/TFT_COMPANION'),
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/TFT_TACTICIAN'),
    lcuGet(lcuPort, password, '/lol-inventory/v1/inventory?inventoryTypes=%5B%22COMPANION%22%5D'),
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/TFT_MAP_SKIN'),
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/TFT_DAMAGE_SKIN'),
    lcuGet(lcuPort, password, '/lol-collections/v1/inventories/champion-mastery'),
    lcuGet(lcuPort, password, '/lol-champion-mastery/v1/local-player/champion-mastery'),
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/CHAMPION_SKIN'),
  ])
  const masteryRes = (masteryCollRes.ok && Array.isArray(masteryCollRes.data) && masteryCollRes.data.length > 0)
    ? masteryCollRes : masteryLocalRes

  log('Raw endpoint responses:')
  debugRes('skins', skinsRes)
  debugRes('loot', lootRes)
  debugRes('emotes', emotesRes)
  debugRes('icons', iconsRes)
  debugRes('wards', wardsRes)
  debugRes('finishers (NEXUS_FINISHER)', finishersRes)
  debugRes('wallet', walletRes)
  debugRes('region', regionRes)
  debugRes('tft-companions (TFT_COMPANION)', tftCompanionsRes)
  debugRes('tft-tactician (TFT_TACTICIAN)', tftTacticianRes)
  debugRes('tft-companion-v1 (v1/inventory?COMPANION)', tftCompanionV1Res)
  debugRes('tft-map-skins', tftMapSkinsRes)
  debugRes('tft-damage-skins', tftDamageSkinsRes)
  debugRes('skin-inv (CHAMPION_SKIN)', skinInvRes)

  // Skins
  if (!skinsRes.ok || !Array.isArray(skinsRes.data)) throw new Error('Could not read skin inventory')
  const allSkins = skinsRes.data
  const ownedSkins = allSkins.filter(s => !s.isBase && (s.ownership?.owned || s.ownership?.rental?.rented))
  const ownedSkinIds = ownedSkins.map(s => s.id)
  log(`Found ${ownedSkinIds.length} owned skins. Fetching chroma data...`)

  // Chromas (per-champion detail)
  const champIds = [...new Set(ownedSkins.map(s => Math.floor(s.id / 1000)))]
  const chromaResults = await pMap(champIds, async (champId) => {
    const res = await lcuGet(lcuPort, password, `/lol-champions/v1/inventories/${summonerId}/champions/${champId}/skins`)
    if (!res.ok || !Array.isArray(res.data)) return []
    return res.data.flatMap(skin => {
      const chromas = skin.chromas || []
      return chromas.filter(c => {
        // Try multiple ownership shapes
        return c.ownership?.owned === true ||
               c.ownership?.rental?.rented === true ||
               c.owned === true
      }).map(c => c.id)
    })
  }, 8)
  const ownedChromaIds = chromaResults.flat()
  log(`Found ${ownedChromaIds.length} owned chromas.`)

  // Emotes
  const ownedEmoteIds = extractIds(emotesRes.data)
  log(`Found ${ownedEmoteIds.length} emotes.`)

  // Icons
  const ownedIconIds = extractIds(iconsRes.data)
  log(`Found ${ownedIconIds.length} icons.`)

  // Wards
  const ownedWardIds = extractIds(wardsRes.data)
  log(`Found ${ownedWardIds.length} ward skins.`)

  // Finishers
  const ownedFinisherIds = extractIds(finishersRes.data)
  log(`Found ${ownedFinisherIds.length} finishers.`)

  // Region
  let region = ''
  if (regionRes.ok && regionRes.data) {
    region = regionRes.data.region || regionRes.data.webRegion || ''
  }
  log(`Region: ${region || 'unknown'}`)

  // TFT inventory — try TFT_COMPANION first, fall back to TFT_TACTICIAN
  let tftCompanionIds = []
  const companionSource =
    (tftCompanionsRes.ok && Array.isArray(tftCompanionsRes.data) && tftCompanionsRes.data.length > 0)
      ? tftCompanionsRes.data
      : (tftTacticianRes.ok && Array.isArray(tftTacticianRes.data) && tftTacticianRes.data.length > 0)
        ? tftTacticianRes.data
        : (tftCompanionV1Res.ok && Array.isArray(tftCompanionV1Res.data) && tftCompanionV1Res.data.length > 0)
          ? tftCompanionV1Res.data
          : null
  if (companionSource) {
    const owned = companionSource.filter(t =>
      t.ownership?.owned === true ||
      t.ownership?.rental?.rented === true ||
      t.owned === true
    )
    tftCompanionIds = owned.length > 0
      ? owned.map(t => t.itemId ?? t.id).filter(x => x != null && x !== 0)
      : extractIds(companionSource)
  }
  const tftMapSkinIds    = extractIds(tftMapSkinsRes.data)
  const tftDamageSkinIds = extractIds(tftDamageSkinsRes.data)
  log(`TFT: ${tftCompanionIds.length} companions, ${tftMapSkinIds.length} arenas, ${tftDamageSkinIds.length} booms`)

  // ─── Discovery scan ───────────────────────────────────────────────────────
  const DISCOVERY_TYPES = [
    'ACHIEVEMENT_BANNER_ACCENT', 'ACHIEVEMENT_TITLE', 'ANNOUNCER_PACK', 'ARAM_BOON',
    'AUGMENT', 'AUGMENT_SLOT', 'BOOST', 'BUNDLES', 'CHAMPION', 'CHAMPION_SKIN',
    'CHERRY_BOON', 'COMPANION', 'CURRENCY', 'EMOTE', 'EVENT_PASS', 'FANPASS',
    'GIFT', 'HEXTECH_CRAFTING', 'MODE_PROGRESSION_REWARD', 'MYSTERY', 'NEXUS_FINISHER',
    'OPAL_ACHIEVEMENT', 'PREMIUM_CLUB_MEMBERSHIP', 'PROGRESSION', 'PROVIEW_PASS',
    'PVE_RELIC', 'PVE_SUMMONER_PACKAGE', 'PVE_UPGRADE', 'QUEUE_ENTRY',
    'REGALIA_BANNER', 'REGALIA_BORDER', 'REGALIA_CREST', 'RP', 'RUNE',
    'SKIN_AUGMENT', 'SKIN_BORDER', 'SKIN_UPGRADE_GEAR', 'SKIN_UPGRADE_HOME_GUARD',
    'SKIN_UPGRADE_RECALL', 'SKIN_UPGRADE_SPAWN', 'SPELL_BOOK_PAGE', 'STATSTONE',
    'STRAWBERRY_BOON', 'STRAWBERRY_LOADOUT_ITEM', 'STRAWBERRY_MAP',
    'SUMMONER_CUSTOMIZATION', 'SUMMONER_ICON', 'TEAMPASS', 'TEAM_SKIN_PURCHASE',
    'TFT_DAMAGE_SKIN', 'TFT_EVENT_PVE_BUDDY', 'TFT_EVENT_PVE_DIFFICULTY',
    'TFT_EVENT_SKILLS', 'TFT_MAP_SKIN', 'TFT_PLAYBOOK', 'TFT_ZOOM_SKIN',
    'TOURNAMENT_FLAG', 'TOURNAMENT_FRAME', 'TOURNAMENT_LOGO', 'TOURNAMENT_TROPHY',
    'TRANSFER', 'WARD_SKIN',
  ]
  log('Running discovery scan (ranked + champion count + all-inventory dump + extra types + last match)...')
  const [rankedRes, champMinimalRes, invAllV1Res, invAllV2Res, invPlayerRes, matchHistoryRes, iconMetaRes, emoteMetaRes, ...discoveryResults] = await Promise.all([
    lcuGet(lcuPort, password, '/lol-ranked/v1/current-ranked-stats'),
    lcuGet(lcuPort, password, '/lol-champions/v1/owned-champions-minimal'),
    lcuGet(lcuPort, password, '/lol-inventory/v1/inventory/all'),
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/all'),
    lcuGet(lcuPort, password, `/lol-inventory/v1/player/${summoner.puuid}`),
    lcuGet(lcuPort, password, '/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=1'),
    lcuGet(lcuPort, password, '/lol-game-data/assets/v1/summoner-icons.json'),
    lcuGet(lcuPort, password, '/lol-game-data/assets/v1/summoner-emotes.json'),
    ...DISCOVERY_TYPES.map(type => lcuGet(lcuPort, password, `/lol-inventory/v2/inventory/${type}`)),
  ])

  // Ranked — current tier + peak this season + previous season end
  let soloRank = null, flexRank = null, tftRank = null
  let soloPeakRank = null, flexPeakRank = null
  let soloPrevRank = null, flexPrevRank = null
  if (rankedRes.ok && rankedRes.data) {
    const qm = rankedRes.data.queueMap || {}
    const queues = rankedRes.data.queues || Object.entries(qm).map(([queueType, v]) => ({ queueType, ...v }))
    const toTier = q => (!q || !q.tier || q.tier === 'NA' || q.tier === 'NONE' || q.tier === 'UNRANKED') ? null : q.tier
    const toPeak = q => (!q || !q.highestTier || q.highestTier === 'NA' || q.highestTier === 'NONE' || q.highestTier === 'UNRANKED') ? null : q.highestTier
    const toPrev = q => (!q || !q.previousSeasonEndTier || q.previousSeasonEndTier === 'NA' || q.previousSeasonEndTier === 'NONE' || q.previousSeasonEndTier === 'UNRANKED') ? null : q.previousSeasonEndTier
    const solo = queues.find ? queues.find(q => q.queueType === 'RANKED_SOLO_5x5') : qm['RANKED_SOLO_5x5']
    const flex = queues.find ? queues.find(q => q.queueType === 'RANKED_FLEX_SR')  : qm['RANKED_FLEX_SR']
    const tft  = queues.find ? queues.find(q => q.queueType === 'RANKED_TFT')      : qm['RANKED_TFT']
    soloRank = toTier(solo); flexRank = toTier(flex); tftRank = toTier(tft)
    soloPeakRank = toPeak(solo); flexPeakRank = toPeak(flex)
    soloPrevRank = toPrev(solo); flexPrevRank = toPrev(flex)
  }
  log(`Ranked: solo=${soloRank || 'unranked'} (peak=${soloPeakRank || '-'}, prev=${soloPrevRank || '-'}), flex=${flexRank || 'unranked'}, tft=${tftRank || 'unranked'}`)

  // Last match
  let lastMatch = null
  try {
    const games = matchHistoryRes.ok && matchHistoryRes.data
      ? (matchHistoryRes.data.games?.games || matchHistoryRes.data.games || [])
      : []
    if (games.length > 0) {
      const g = games[0]
      const me = (g.participantIdentities || []).find(pi =>
        pi.player?.summonerId === summonerId || pi.player?.puuid === summoner.puuid
      )
      const pid = me?.participantId
      const p = pid != null ? (g.participants || []).find(x => x.participantId === pid) : (g.participants || [])[0]
      const stats = p?.stats || {}
      const QUEUE_LABELS = {
        420: 'Ranked Solo', 440: 'Ranked Flex', 450: 'ARAM', 900: 'URF',
        400: 'Normal Draft', 430: 'Normal Blind', 1700: 'Arena', 1900: 'URF',
        720: 'ARAM Clash', 700: 'Clash',
      }
      lastMatch = {
        championId:   p?.championId ?? null,
        kills:        stats.kills ?? 0,
        deaths:       stats.deaths ?? 0,
        assists:      stats.assists ?? 0,
        win:          stats.win ?? false,
        queueId:      g.queueId ?? null,
        queueLabel:   QUEUE_LABELS[g.queueId] || (g.gameMode ? g.gameMode.replace(/_/g, ' ') : 'Unknown'),
        gameDate:     g.gameCreation ? new Date(g.gameCreation).toISOString().split('T')[0] : null,
        gameDuration: g.gameDuration ?? null,
      }
      log(`Last match: ${lastMatch.queueLabel} | ${lastMatch.win ? 'WIN' : 'LOSS'} | ${lastMatch.kills}/${lastMatch.deaths}/${lastMatch.assists} on champion ${lastMatch.championId}`)
    } else {
      log('Last match: none found in match history')
    }
  } catch (e) {
    log('Last match fetch failed: ' + e.message)
  }

  // Champion count
  let champCount = null
  if (champMinimalRes.ok && Array.isArray(champMinimalRes.data)) {
    champCount = champMinimalRes.data.filter(c => c.ownership?.owned || c.owned === true || c.f2p === true).length
  }
  log(`Champions owned: ${champCount ?? 'unknown'}`)

  // "All inventory" dump — extract unique inventoryType values + TFT items in full
  function summariseAllInventory(res, label) {
    if (!res.ok) { debugRes(label, res); return { status: res.status, ok: false, data: res.data } }
    const items = Array.isArray(res.data) ? res.data
      : Array.isArray(res.data?.items) ? res.data.items
      : typeof res.data === 'object' && res.data !== null
        ? Object.values(res.data).flat().filter(x => typeof x === 'object')
        : []
    const typeMap = {}
    for (const item of items) {
      const t = item.inventoryType || item.type || 'UNKNOWN'
      if (!typeMap[t]) typeMap[t] = []
      typeMap[t].push(item)
    }
    const typeSummary = {}
    for (const [t, arr] of Object.entries(typeMap)) {
      typeSummary[t] = { count: arr.length, sample: arr.slice(0, 2) }
    }
    const tftItems = items.filter(i => {
      const t = (i.inventoryType || i.type || '').toUpperCase()
      return t.startsWith('TFT') || t.includes('LEGEND') || t.includes('COMPANION') || t.includes('CHIBI')
    })
    log(`  [${label}] total=${items.length}, types=${Object.keys(typeMap).join(',')}, tftRelated=${tftItems.length}`)
    return { status: res.status, ok: true, totalItems: items.length, inventoryTypes: typeSummary, tftRelatedItems: tftItems }
  }

  const _inventoryDump = {
    v1_all:    summariseAllInventory(invAllV1Res,  'inv/v1/all'),
    v2_all:    summariseAllInventory(invAllV2Res,  'inv/v2/all'),
    v1_player: summariseAllInventory(invPlayerRes, 'inv/v1/player'),
  }

  // Per-type discovery results (full raw data for every inventory type)
  const _discovery = {}
  DISCOVERY_TYPES.forEach((type, i) => {
    const res = discoveryResults[i]
    _discovery[type] = {
      status: res.status,
      ok: res.ok,
      count: Array.isArray(res.data) ? res.data.length : null,
      data: res.data,
    }
    debugRes(`discovery/${type}`, res)
  })

  // Wallet (RP + BE) — try /lol-store/v1/wallet first, fall back to parameterised endpoint
  let rp = null, be = null
  if (walletRes.ok && walletRes.data) {
    rp = walletRes.data.rp ?? walletRes.data.RP ?? null
    be = walletRes.data.ip ?? walletRes.data.lol_blue_essence ?? walletRes.data.BE ?? null
  }
  if (rp == null || be == null) {
    const wallet2 = await lcuGet(lcuPort, password, '/lol-inventory/v1/wallet?currencyTypes=lol_blue_essence,rp')
    if (wallet2.ok && wallet2.data) {
      if (rp == null) rp = wallet2.data.rp ?? null
      if (be == null) be = wallet2.data.lol_blue_essence ?? wallet2.data.ip ?? null
    }
  }
  log(`Wallet (endpoints): RP=${rp}, BE=${be}`)

  // Loot
  const lootArr = lootRes.ok && Array.isArray(lootRes.data) ? lootRes.data : []
  // RP and BE sometimes appear in the loot endpoint — use them as final fallback
  if (rp == null) rp = lootArr.find(i => i.lootId === 'CURRENCY_RP')?.count ?? null
  if (be == null) be = lootArr.find(i => i.lootId === 'CURRENCY_champion')?.count ?? null
  log(`Wallet (final): RP=${rp}, BE=${be}`)

  // Exclude currency lootIds that are shown separately (RP, BE) from the allItems map
  const LOOT_CURRENCY_SKIP = new Set(['CURRENCY_RP', 'CURRENCY_champion'])
  const lootData = {}
  for (const item of lootArr) {
    if (item.count > 0 && !LOOT_CURRENCY_SKIP.has(item.lootId)) {
      lootData[item.lootId] = { count: item.count, type: item.type, localizedName: item.localizedName, storeItemId: item.storeItemId }
    }
  }
  const lootSummary = {
    hexChests: lootArr.filter(i => i.lootId?.startsWith('CHEST_') || i.lootId === 'CHEST_generic').reduce((s, i) => s + (i.count || 0), 0),
    hexKeys:   lootArr.filter(i => i.lootId === 'MATERIAL_key' || i.lootId === 'MATERIAL_key_fragment').reduce((s, i) => s + (i.count || 0), 0),
    oe:        lootArr.find(i => i.lootId === 'CURRENCY_cosmetic')?.count ?? 0,
    me:        lootArr.find(i => i.lootId === 'CURRENCY_mythic')?.count ?? 0,
    capsules:  lootArr.filter(i => i.type === 'CHEST' && i.lootId?.includes('CHAMPION')).reduce((s, i) => s + (i.count || 0), 0),
    allItems:  lootData,
  }
  log(`Loot: ${Object.keys(lootData).length} items, hexChests=${lootSummary.hexChests}, keys=${lootSummary.hexKeys}, OE=${lootSummary.oe}, ME=${lootSummary.me}`)

  // Champion Mastery
  const championMastery = (masteryRes.ok && Array.isArray(masteryRes.data))
    ? masteryRes.data.map(m => ({ championId: m.championId, championLevel: m.championLevel ?? m.championMasteryLevel ?? 0, championPoints: m.championPoints ?? 0 })).filter(m => m.championId != null)
    : []
  log(`Champion mastery: ${championMastery.length} champions tracked`)

  // ─── Dedicated inventory endpoints: vintage skins, purchase dates, supplemental skin IDs ─
  function parseInventoryDate(d) {
    if (!d || d === '') return null
    const m = d.match(/^(\d{4})(\d{2})(\d{2})/)
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null
  }

  const skinInvItems = Array.isArray(skinInvRes.data) ? skinInvRes.data : []
  const iconInvItems = Array.isArray(iconsRes.data) ? iconsRes.data : []
  const wardInvItems = Array.isArray(wardsRes.data) ? wardsRes.data : []

  // Vintage = payload.isVintage true → skin came with a border
  const vintageSkinIds = skinInvItems
    .filter(i => i.payload?.isVintage === true)
    .map(i => i.itemId).filter(id => id != null)

  // Supplement skin IDs: picks up special milestone/reward skins missed by skins-minimal
  // Exclude chroma IDs so they don't inflate the skin count
  const chromaIdSet = new Set(ownedChromaIds)
  const supplSkinIds = skinInvItems
    .filter(i => (i.owned === true || i.ownershipType === 'OWNED') && !i.rental)
    .map(i => i.itemId).filter(id => id != null && id !== 0 && !chromaIdSet.has(id))
  const finalSkinIds = [...new Set([...ownedSkinIds, ...supplSkinIds])]
  if (finalSkinIds.length > ownedSkinIds.length) log(`Supplemental skins added: ${finalSkinIds.length - ownedSkinIds.length}`)

  // Account created estimate: oldest purchaseDate across skins + icons + wards
  const skinDates = skinInvItems.filter(i => (i.owned === true || i.ownershipType === 'OWNED') && i.purchaseDate).map(i => parseInventoryDate(i.purchaseDate)).filter(Boolean)
  const iconDates = iconInvItems.filter(i => (i.owned === true || i.ownershipType === 'OWNED') && i.purchaseDate).map(i => parseInventoryDate(i.purchaseDate)).filter(Boolean)
  const wardDates = wardInvItems.filter(i => (i.owned === true || i.ownershipType === 'OWNED') && i.purchaseDate).map(i => parseInventoryDate(i.purchaseDate)).filter(Boolean)
  const allDates = [...skinDates, ...iconDates, ...wardDates].sort()
  const accountCreatedEstimate = allDates[0] || null

  // First RP purchase (non-skin): oldest purchaseDate from icons + wards, tracking which item
  const nonSkinItems = [
    ...iconInvItems.filter(i => (i.owned === true || i.ownershipType === 'OWNED') && i.purchaseDate),
    ...wardInvItems.filter(i => (i.owned === true || i.ownershipType === 'OWNED') && i.purchaseDate),
  ].sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate))
  const firstRpItem = nonSkinItems[0] || null
  const firstRpPurchaseDate     = firstRpItem ? parseInventoryDate(firstRpItem.purchaseDate) : null
  const firstRpPurchaseItemId   = firstRpItem?.itemId ?? null
  const firstRpPurchaseItemType = firstRpItem?.inventoryType || null

  log(`Vintage skins: ${vintageSkinIds.length} | Account est: ${accountCreatedEstimate || 'unknown'} | First RP non-skin: ${firstRpPurchaseDate || 'unknown'} (${firstRpPurchaseItemType}#${firstRpPurchaseItemId})`)

  // Build ID→name maps from game data (inventory items don't include localizedName)
  const iconTitleMap = {}
  if (iconMetaRes.ok && Array.isArray(iconMetaRes.data)) {
    for (const icon of iconMetaRes.data) {
      if (icon.id != null && (icon.title || icon.name)) iconTitleMap[icon.id] = icon.title || icon.name
    }
  }
  log(`Icon metadata: ${Object.keys(iconTitleMap).length} entries`)
  const emoteTitleMap = {}
  if (emoteMetaRes.ok && Array.isArray(emoteMetaRes.data)) {
    for (const emote of emoteMetaRes.data) {
      if (emote.id != null && (emote.name || emote.title)) emoteTitleMap[emote.id] = emote.name || emote.title
    }
  }
  log(`Emote metadata: ${Object.keys(emoteTitleMap).length} entries`)

  // Build rank history from owned emotes + icons using game data name lookup
  const rankEntries = []
  const _rankDebugNames = []
  for (const item of Array.isArray(_discovery.EMOTE?.data) ? _discovery.EMOTE.data : []) {
    const title = emoteTitleMap[item.itemId] || ''
    if (title) _rankDebugNames.push(`emote:${item.itemId}="${title}"`)
    const parsed = parseRankItemName(title)
    if (parsed) rankEntries.push(parsed)
  }
  for (const item of Array.isArray(_discovery.SUMMONER_ICON?.data) ? _discovery.SUMMONER_ICON.data : []) {
    const title = iconTitleMap[item.itemId] || ''
    if (title) _rankDebugNames.push(`icon:${item.itemId}="${title}"`)
    const parsed = parseRankItemName(title)
    if (parsed) rankEntries.push(parsed)
  }
  const rankHistory = buildRankHistory(rankEntries, accountCreatedEstimate)
  const rankHistoryPeak = findPeakFromHistory(rankHistory)
  log(`Rank history: ${rankHistory.length} seasons, ${rankEntries.length} matched items, peak=${rankHistoryPeak || 'none'}`)

  return {
    _scannerVersion: VERSION,
    summonerName: summoner.gameName || summoner.displayName || '',
    tagLine: summoner.tagLine || '',
    summonerLevel: summoner.summonerLevel,
    profileIconId: summoner.profileIconId,
    puuid: summoner.puuid,
    region,
    rp, be,
    soloRank, flexRank, tftRank,
    soloPeakRank, flexPeakRank,
    soloPrevRank, flexPrevRank,
    lastMatch,
    champCount,
    ownedSkinIds: finalSkinIds,
    vintageSkinIds,
    accountCreatedEstimate,
    firstRpPurchaseDate,
    firstRpPurchaseItemId,
    firstRpPurchaseItemType,
    rankHistory,
    rankHistoryPeak,
    _rankDebugNames,
    ownedChromaIds,
    ownedEmoteIds,
    ownedIconIds,
    ownedWardIds,
    ownedFinisherIds,
    tftCompanionIds,
    tftMapSkinIds,
    tftDamageSkinIds,
    lootSummary,
    championMastery,
    _discovery,
    _inventoryDump,
    _champMinimal: champMinimalRes.data,
    _rankedDebug: {
      status: rankedRes.status,
      ok: rankedRes.ok,
      raw: rankedRes.data,
    },
    _matchHistoryDebug: {
      status: matchHistoryRes.status,
      ok: matchHistoryRes.ok,
      raw: matchHistoryRes.data,
    },
    _tftDebug: {
      companions_TFT_COMPANION: {
        status: tftCompanionsRes.status,
        ok: tftCompanionsRes.ok,
        count: Array.isArray(tftCompanionsRes.data) ? tftCompanionsRes.data.length : 0,
        raw: tftCompanionsRes.data,
      },
      companions_TFT_TACTICIAN: {
        status: tftTacticianRes.status,
        ok: tftTacticianRes.ok,
        count: Array.isArray(tftTacticianRes.data) ? tftTacticianRes.data.length : 0,
        raw: tftTacticianRes.data,
      },
      companions_v1_COMPANION: {
        status: tftCompanionV1Res.status,
        ok: tftCompanionV1Res.ok,
        count: Array.isArray(tftCompanionV1Res.data) ? tftCompanionV1Res.data.length : 0,
        raw: tftCompanionV1Res.data,
      },
      mapSkins: {
        status: tftMapSkinsRes.status,
        ok: tftMapSkinsRes.ok,
        count: tftMapSkinIds.length,
        sample: Array.isArray(tftMapSkinsRes.data) ? tftMapSkinsRes.data.slice(0, 3) : tftMapSkinsRes.data,
      },
      damageSkins: {
        status: tftDamageSkinsRes.status,
        ok: tftDamageSkinsRes.ok,
        count: tftDamageSkinIds.length,
        sample: Array.isArray(tftDamageSkinsRes.data) ? tftDamageSkinsRes.data.slice(0, 3) : tftDamageSkinsRes.data,
      },
    },
  }
}

// ─── HTTP Server ─────────────────────────────────────────────────────────────

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function json(res, status, body) {
  setCors(res)
  res.setHeader('Content-Type', 'application/json')
  res.writeHead(status)
  res.end(JSON.stringify(body))
}

function html(res, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.writeHead(200)
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', c => data += c)
    req.on('end', () => { try { resolve(JSON.parse(data)) } catch { resolve({}) } })
  })
}

// ─── Debug Logs ───────────────────────────────────────────────────────────────

const debugLogs = []

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19)
  const line = `[${ts}] ${msg}`
  console.log(line)
  debugLogs.push(line)
  if (debugLogs.length > 500) debugLogs.shift()
}

// ─── LCU Ping ────────────────────────────────────────────────────────────────

async function pingLcu() {
  const lf = findLockfile()
  if (!lf) return false
  try {
    const { port, password } = parseLockfile(lf)
    const res = await lcuGet(port, password, '/lol-summoner/v1/current-summoner')
    return res.ok && res.data && !!res.data.summonerId
  } catch { return false }
}

// ─── CSR2 Save Editor ────────────────────────────────────────────────────────

function csr2ReadSave(buf) {
  const raw = zlib.gunzipSync(buf).toString('utf8')
  const nl = raw.indexOf('\n')
  return JSON.parse(raw.slice(nl + 1))
}

function csr2WriteSave(data) {
  const jsonStr = JSON.stringify(data)
  const hash = crypto.createHash('sha1').update(jsonStr, 'utf8').digest('hex')
  return zlib.gzipSync(Buffer.from(hash + '\n' + jsonStr, 'utf8'))
}

function csr2ApplyPack(data, pack) {
  const c = pack.currencies || {}
  if ('cash'        in c) data.caea = c.cash
  if ('gold'        in c) data.goea = c.gold
  if ('bronzeKeys'  in c) data.gbke = c.bronzeKeys
  if ('silverKeys'  in c) data.gske = c.silverKeys
  if ('goldKeys'    in c) data.ggke = c.goldKeys
  if ('fuel'        in c) data.fupi = c.fuel
  if ('eliteTokens' in c) {
    if (!data.icnd) data.icnd = {}
    if (!data.icnd.crpe) data.icnd.crpe = {}
    data.icnd.EliteTuners_Credits = (data.icnd.EliteTuners_Credits || 0) + c.eliteTokens
  }
  if (Array.isArray(pack.cars) && pack.cars.length > 0) {
    if (!Array.isArray(data.caow)) data.caow = []
    for (const car of pack.cars) {
      const unid = data.ncui || 1
      data.caow.push({ ...car, unid })
      data.ncui = unid + 1
    }
  }
}

function csr2Unban(data) {
  Object.assign(data, {
    rpsp: 0, iags: 0, igbk: 0, igsk: 0, iggk: 0,
    hsif: false, hsig: false, hsez: false,
    liap: 0, lbrp: 0, iapc: [], iapx: '', pupr: [],
    hcfr: false, cbam: 2, tcbl: 0, trhi: [], cbcc: -1, cbcm: -1, lbcr: 0, picl: [],
    demo: false, hsdm: false,
    ehshopitemsrefreshlimitcount: [], ehshopitemsrefreshlimitcooldown: [],
    ehshopitemsautorefreshtimestamp: [], ehshopallactivetabitems: [],
    ehshoprefreshcooldown: '', ehshoprefreshcost: 0,
    shwdnrecs: [], showdnsrt: false, showdneut: false, showdnsrc: 0, smptr: 0,
  })
  function replaceIAP(obj) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) { for (const i of obj) replaceIAP(i) }
    else { for (const k of Object.keys(obj)) { if (k === 'csrc' && obj[k] === 'IAPSpecial') obj[k] = 'Prize'; else if (obj[k] && typeof obj[k] === 'object') replaceIAP(obj[k]) } }
  }
  replaceIAP(data)
  for (const f of [
    'lecb','smpsoc','gppl','splr','eslr','cubl','acmk','acid','acna','acec',
    'acel','acla','acmt','acsl','acli','acpr','acpl','aclp','acrp','acrs',
    'aprs','ecrs','eprs','fcrw','cspe','cjrp','scrp','nccc','cjls','bich','csps',
    'nnjc','nnri','nnkc','vifc','vrtj','ncbp','cht5','chs7','cpnd','cpns',
    'clby','clne','clce','clbi','clbp','clsp','cl3e','fktc','cl3i','clpl',
    'crpe','schi','dlcc','dlci','dlca','dlft','dlsm','dlea','dlel','dldm',
    'vips','vip5','vies','vie5','vipt','vipn','vipe',
  ]) delete data[f]
  if (data.icnd) {
    for (const t of ['EliteTuners_Credits','Halloween_Credits','HeroCar_Credits','AmericaSeries_Credits','EuropeSeries_Credits']) {
      if (t in data.icnd) data.icnd[t] = 0
    }
  }
  for (const [earned, spent] of [['caea','casp'],['goea','gosp'],['gbke','gbks'],['gske','gsks'],['ggke','ggks']]) {
    if (typeof data[earned] === 'number' && typeof data[spent] === 'number') {
      const bal = data[earned] - data[spent]
      if (bal > 0) data[earned] = data[spent] + Math.floor(bal * 0.7)
    }
  }
  if (data.afme && typeof data.afme === 'object') {
    data.afms = { Green: 0, Blue: 0, Red: 0, Yellow: 0 }
    for (const c of Object.keys(data.afme)) {
      if (typeof data.afme[c] === 'number') data.afme[c] = Math.floor(data.afme[c] * 0.5)
    }
  }
}

// ─── UI HTML ─────────────────────────────────────────────────────────────────

const UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AIO Tool v${VERSION}</title>
<style>
:root{--bg:#151515;--surf:#1e1e1e;--surf2:#252525;--accent:#7E6551;--accent-hi:#a08570;--text:#FDF4DC;--muted:#a08570;--border:#2e2e2e;--red:#e05252;--green:#4caf50;--r:10px}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;display:flex;flex-direction:column;height:100vh;overflow:hidden}
header{display:flex;align-items:center;padding:0 16px;height:52px;border-bottom:1px solid var(--border);background:var(--surf);flex-shrink:0;gap:10px}
.logo{font-weight:700;font-size:15px;color:var(--accent);letter-spacing:.5px}
.badge{font-size:11px;color:var(--muted);background:var(--surf2);padding:2px 8px;border-radius:20px}
.spacer{flex:1}
.icon-btn{background:none;border:none;color:var(--muted);cursor:pointer;padding:6px;border-radius:8px;display:flex;align-items:center;transition:color .15s,background .15s}
.icon-btn:hover{color:var(--text);background:var(--surf2)}
.app-body{display:flex;flex:1;overflow:hidden}
aside{width:176px;background:var(--surf);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;overflow-y:auto;padding:8px 0}
.sidebar-label{padding:8px 14px 4px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px}
.sidebar-item{display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;color:var(--muted);font-size:13px;border-left:3px solid transparent;transition:background .12s}
.sidebar-item:hover{background:var(--surf2);color:var(--text)}
.sidebar-item.active{background:rgba(126,101,81,.18);color:var(--accent-hi);border-left-color:var(--accent)}
.sidebar-item.blur{filter:blur(2px);opacity:.5;pointer-events:none}
.s-dot{width:8px;height:8px;border-radius:50%;background:var(--muted);flex-shrink:0}
.s-dot.on{background:var(--accent)}
main{flex:1;overflow-y:auto;padding:20px}
.main-hdr{display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap}
.main-title{font-size:17px;font-weight:600}
.btn{padding:7px 16px;border-radius:var(--r);border:none;cursor:pointer;font-size:13px;font-weight:500;transition:opacity .15s,background .15s}
.btn-primary{background:var(--accent);color:var(--text)}
.btn-primary:hover{opacity:.85}
.btn-secondary{background:var(--surf2);color:var(--text);border:1px solid var(--border)}
.btn-secondary:hover{background:var(--border)}
.btn-danger{background:var(--red);color:#fff}
.btn-danger:hover{opacity:.85}
.btn-sm{padding:5px 12px;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:13px}
.card{background:var(--surf);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;position:relative;transition:border-color .15s,transform .1s}
.card:hover{border-color:var(--accent);transform:translateY(-1px)}
.card.sel{border-color:var(--accent);outline:2px solid var(--accent)}
.card-thumb{width:100%;aspect-ratio:16/9;background:linear-gradient(135deg,var(--surf2),var(--bg));display:flex;align-items:center;justify-content:center}
.card-body{padding:10px 12px}
.card-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-meta{font-size:11px;color:var(--muted);margin-top:3px;display:flex;gap:8px}
.card-overlay{position:absolute;inset:0;background:rgba(0,0,0,.75);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;opacity:0;transition:opacity .15s;pointer-events:none}
.card:hover .card-overlay{opacity:1;pointer-events:all}
.ov-btn{width:82%;padding:7px 12px;border-radius:8px;border:none;cursor:pointer;font-size:12px;font-weight:500;transition:opacity .15s}
.ov-import{background:var(--accent);color:var(--text)}
.ov-preview{background:var(--surf2);color:var(--text);border:1px solid var(--border)}
.ov-remove{background:transparent;color:var(--red);border:1px solid rgba(239,68,68,.4)}
.ov-btn:hover{opacity:.8}
.empty{text-align:center;padding:60px 20px;color:var(--muted)}
.empty h3{font-size:15px;margin-bottom:8px;color:var(--text)}
.scan-banner{padding:11px 14px;background:rgba(126,101,81,.15);border:1px solid rgba(126,101,81,.4);border-radius:var(--r);margin-bottom:14px;color:var(--accent);font-size:13px;display:none}
.scan-banner.on{display:block}
.grid-blur{filter:blur(3px);pointer-events:none}
.sel-bar{display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(126,101,81,.15);border:1px solid rgba(126,101,81,.4);border-radius:var(--r);margin-bottom:12px}
.sel-bar.hide{display:none}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:100;opacity:0;pointer-events:none;transition:opacity .2s}
.modal-bg.on{opacity:1;pointer-events:all}
.modal{background:var(--surf);border:1px solid var(--border);border-radius:14px;padding:24px;width:420px;max-width:95vw;max-height:85vh;overflow-y:auto}
.modal-title{font-size:16px;font-weight:600;margin-bottom:4px}
.modal-sub{font-size:12px;color:var(--muted);margin-bottom:18px}
.field{margin-bottom:14px}
label{display:block;font-size:12px;color:var(--muted);margin-bottom:5px}
input[type=text],input[type=password],textarea,select{width:100%;padding:9px 12px;background:var(--surf2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none;transition:border-color .15s;font-family:inherit}
input:focus,textarea:focus,select:focus{border-color:var(--accent)}
textarea{resize:vertical;min-height:100px}
select{cursor:pointer}
.modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}
.notice{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:10px}
.n-info{background:rgba(126,101,81,.15);border:1px solid rgba(126,101,81,.35);color:var(--accent)}
.n-error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:var(--red)}
.n-success{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:var(--green)}
.steps{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.step{display:flex;align-items:flex-start;gap:12px;padding:10px 14px;background:var(--surf2);border-radius:8px;border:1px solid var(--border)}
.step-ico{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;margin-top:1px}
.ico-pending{background:var(--border);color:var(--muted)}
.ico-active{background:rgba(126,101,81,.2);color:var(--accent-hi)}
.ico-done{background:rgba(34,197,94,.15);color:var(--green)}
.ico-error{background:rgba(239,68,68,.15);color:var(--red)}
.step-info{flex:1}
.step-main{font-size:13px}
.step-sub{font-size:11px;color:var(--muted);margin-top:2px}
@keyframes spin{to{transform:rotate(360deg)}}
.spinner{display:inline-block;width:13px;height:13px;border:2px solid rgba(126,101,81,.25);border-top-color:var(--accent-hi);border-radius:50%;animation:spin .8s linear infinite}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:7px 0}
.toggle{position:relative;width:40px;height:22px;flex-shrink:0}
.toggle input{opacity:0;width:0;height:0}
.tslider{position:absolute;inset:0;background:var(--border);border-radius:22px;cursor:pointer;transition:background .2s}
.tslider:before{content:'';position:absolute;width:16px;height:16px;left:3px;top:3px;background:#fff;border-radius:50%;transition:transform .2s}
.toggle input:checked+.tslider{background:var(--accent)}
.toggle input:checked+.tslider:before{transform:translateX(18px)}
.link-box{display:flex;align-items:center;gap:8px;background:var(--surf2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin-top:8px}
.link-text{flex:1;font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.copy-btn{background:var(--border);border:none;color:var(--text);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;flex-shrink:0}
.copy-btn:hover{background:var(--accent);color:#000}
.chk{position:absolute;top:8px;left:8px;width:18px;height:18px;border-radius:4px;background:rgba(0,0,0,.6);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2}
.chk.on{background:var(--accent);border-color:var(--accent)}
.debug-panel{position:fixed;top:0;right:-500px;width:480px;height:100vh;background:var(--surf);border-left:1px solid var(--border);display:flex;flex-direction:column;z-index:200;transition:right .25s ease}
.debug-panel.open{right:0}
.debug-hdr{display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border);gap:10px}
.debug-title{font-size:14px;font-weight:600;flex:1}
.debug-log{flex:1;overflow-y:auto;padding:12px;font-family:'Consolas','Fira Code',monospace;font-size:11px;color:#9ca3af;line-height:1.65}
.log-line{border-bottom:1px solid rgba(255,255,255,.04);padding:2px 0}
.sidebar-cat-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 4px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;cursor:pointer;user-select:none;transition:color .12s}
.sidebar-cat-hdr:hover{color:var(--text)}
.sidebar-cat-hdr svg{transition:transform .2s;flex-shrink:0}
.sidebar-cat.collapsed .sidebar-cat-hdr svg{transform:rotate(-90deg)}
.sidebar-cat.collapsed .sidebar-cat-items{display:none}
.pack-card{background:var(--surf);border:1px solid var(--border);border-radius:var(--r);padding:14px;cursor:pointer;transition:border-color .15s,transform .1s;position:relative}
.pack-card:hover{border-color:var(--accent);transform:translateY(-1px)}
.pack-card-name{font-size:13px;font-weight:600;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pack-card-meta{font-size:11px;color:var(--muted);display:flex;flex-direction:column;gap:2px}
.pack-card-del{position:absolute;top:8px;right:8px;background:none;border:none;color:var(--muted);cursor:pointer;padding:3px;border-radius:4px;opacity:0;transition:opacity .15s}
.pack-card:hover .pack-card-del{opacity:1}
.pack-card-del:hover{color:var(--red)}
#loading-overlay{position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:500;display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px}
#loading-overlay.on{display:flex}
.big-spinner{width:40px;height:40px;border:3px solid rgba(126,101,81,.25);border-top-color:var(--accent-hi);border-radius:50%;animation:spin .8s linear infinite}
#loading-msg{font-size:14px;color:var(--text)}
.file-drop{border:2px dashed var(--border);border-radius:10px;padding:24px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s}
.file-drop:hover,.file-drop.over{border-color:var(--accent);background:rgba(126,101,81,.08)}
.file-drop-label{font-size:13px;color:var(--muted)}
.file-drop-name{font-size:12px;color:var(--accent);margin-top:6px;font-weight:500}
.preview-box{background:var(--surf2);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:12px;line-height:1.7}
.preview-row{display:flex;justify-content:space-between;align-items:baseline}
.preview-key{color:var(--muted)}
.preview-val{color:var(--text);font-weight:500}
.curr-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
</style>
</head>
<body>

<header>
  <span class="logo">AIO Tool</span>
  <span class="badge">v${VERSION}</span>
  <div class="spacer"></div>
  <button class="icon-btn" onclick="toggleDebug()" title="Debug logs">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
  </button>
  <button class="icon-btn" onclick="openSettings()" title="Settings">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  </button>
</header>

<div class="app-body">
  <aside>
    <div id="sidebar-content"><div class="sidebar-item" style="font-size:12px;opacity:.5">Loading...</div></div>
  </aside>
  <main>
    <!-- Accounts panel -->
    <div id="accounts-panel">
      <div class="main-hdr">
        <span class="main-title">Accounts</span>
        <div class="spacer"></div>
        <button class="btn btn-secondary btn-sm" id="sel-btn" onclick="toggleSelect()" style="display:none">Select</button>
        <button class="btn btn-secondary btn-sm" id="unfriend-btn" onclick="openUnfriendModal()" style="display:none">Unfriend All</button>
        <button class="btn btn-secondary btn-sm" id="scan-current-btn" onclick="scanCurrentAccount()" style="display:none">Scan Current</button>
        <button class="btn btn-secondary btn-sm" id="multi-btn" onclick="openMultiScan()" style="display:none">Multi Scan</button>
        <button class="btn btn-primary btn-sm" id="scan-btn" onclick="openSingleScan()" style="display:none">+ Single Scan</button>
      </div>
      <div class="scan-banner" id="scan-banner">Webapp is using the scanner — please wait...</div>
      <div class="sel-bar hide" id="sel-bar">
        <span style="flex:1;font-size:13px;color:var(--accent)" id="sel-count">0 selected</span>
        <button class="btn btn-secondary btn-sm" onclick="clearSel()">Cancel</button>
        <button class="btn btn-danger btn-sm" onclick="deleteSel()">Delete</button>
      </div>
      <div class="grid" id="grid"></div>
    </div>
    <!-- CSR2 Services panel -->
    <div id="csr2-panel" style="display:none">
      <div class="main-hdr">
        <span class="main-title">CSR2 Services</span>
        <div class="spacer"></div>
        <button class="btn btn-secondary btn-sm" onclick="openUnban()">Unban</button>
        <button class="btn btn-secondary btn-sm" onclick="openEditNsb(null)">Edit NSB</button>
        <button class="btn btn-primary btn-sm" onclick="openCreatePack()">+ Create Pack</button>
      </div>
      <div class="grid" id="packs-grid"></div>
    </div>
  </main>
</div>

<!-- Single Scan Modal -->
<div class="modal-bg" id="scan-modal">
  <div class="modal">
    <div class="modal-title">Single Scan</div>
    <div class="modal-sub">Scan a logged-in League account</div>
    <div class="steps" id="scan-steps">
      <div class="step"><div class="step-ico ico-pending" id="s1-ico">1</div><div class="step-info"><div class="step-main">Detect Riot Client</div><div class="step-sub" id="s1-sub">Waiting...</div></div></div>
      <div class="step"><div class="step-ico ico-pending" id="s2-ico">2</div><div class="step-info"><div class="step-main">Detect League Client</div><div class="step-sub" id="s2-sub">Waiting...</div></div></div>
      <div class="step"><div class="step-ico ico-pending" id="s3-ico">3</div><div class="step-info"><div class="step-main">Scan Account</div><div class="step-sub" id="s3-sub">Waiting...</div></div></div>
    </div>
    <div id="scan-notice" style="display:none"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="scan-close-btn" onclick="closeScanModal()">Cancel</button>
      <button class="btn btn-primary" id="scan-retry-btn" style="display:none" onclick="retryScan()">Retry</button>
    </div>
  </div>
</div>

<!-- Multi Scan Modal -->
<div class="modal-bg" id="multi-modal">
  <div class="modal">
    <div class="modal-title">Multi Scan</div>
    <div class="modal-sub">Auto-login and scan multiple accounts via Riot Client</div>
    <div id="multi-creds-section" class="field">
      <label>Credentials — one per line, format: <code style="font-size:11px">username:password</code></label>
      <textarea id="multi-creds" placeholder="user1:pass1&#10;user2:pass2&#10;user3:pass3" style="font-family:monospace;font-size:12px;min-height:130px"></textarea>
      <label style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer;font-size:12px;color:var(--muted)">
        <input type="checkbox" id="multi-unfriend-toggle" style="cursor:pointer">
        Unfriend all friends after scanning each account
      </label>
    </div>
    <div id="multi-notice" style="display:none"></div>
    <div id="multi-progress" style="display:none">
      <div style="font-size:13px;color:var(--muted);margin-bottom:10px" id="multi-prog-label">Scanning...</div>
      <div class="steps" id="multi-steps"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeMultiModal()" id="multi-close-btn">Cancel</button>
      <button class="btn btn-primary" onclick="startMultiScan()" id="multi-start-btn">Start</button>
    </div>
  </div>
</div>

<!-- Unfriend All Modal -->
<div class="modal-bg" id="unfriend-modal">
  <div class="modal" style="max-width:400px">
    <div class="modal-title">Remove All Friends</div>
    <div class="modal-sub">This will remove every friend from the currently logged-in League account. This cannot be undone.</div>
    <div id="unfriend-notice" style="display:none;margin-top:12px"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="hideModal('unfriend-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="confirmUnfriendAll()" id="unfriend-confirm-btn" style="background:#c0392b;border-color:#c0392b">Remove All</button>
    </div>
  </div>
</div>

<!-- Preview Link Modal -->
<div class="modal-bg" id="preview-modal">
  <div class="modal">
    <div class="modal-title">Preview Link</div>
    <div class="modal-sub">Generate a shareable preview for this account</div>
    <div class="toggle-row">
      <span style="font-size:13px">Hide summoner name</span>
      <label class="toggle"><input type="checkbox" id="prev-hide" checked><span class="tslider"></span></label>
    </div>
    <div class="field" style="margin-top:12px">
      <label>Link expires after</label>
      <select id="prev-expiry">
        <option value="1">1 day</option>
        <option value="3">3 days</option>
        <option value="7" selected>7 days</option>
        <option value="30">30 days</option>
        <option value="0">Never</option>
      </select>
    </div>
    <div id="prev-notice" style="display:none"></div>
    <div id="prev-link-box" style="display:none">
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">Shareable link</div>
      <div class="link-box">
        <span class="link-text" id="prev-link-text"></span>
        <button class="copy-btn" id="prev-copy-btn" onclick="copyLink()">Copy</button>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closePreviewModal()">Close</button>
      <button class="btn btn-primary" id="prev-gen-btn" onclick="generateLink()">Generate Link</button>
    </div>
  </div>
</div>

<!-- Import Modal -->
<div class="modal-bg" id="import-modal">
  <div class="modal">
    <div class="modal-title">Import to Webapp</div>
    <div class="modal-sub">Send this account's scan data to the webapp save form.</div>
    <div class="notice n-info" id="import-acct-info"></div>
    <div id="import-notice" style="display:none"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeImportModal()">Cancel</button>
      <button class="btn btn-primary" id="import-confirm-btn" onclick="doImport()">Import</button>
    </div>
  </div>
</div>

<!-- After Import Modal -->
<div class="modal-bg" id="after-import-modal">
  <div class="modal">
    <div class="modal-title">Account Imported</div>
    <div class="modal-sub">The account was sent to the webapp. Keep the local copy?</div>
    <div class="modal-actions" style="flex-direction:column;gap:10px">
      <button class="btn btn-secondary" style="width:100%" onclick="afterKeep()">Keep local record</button>
      <button class="btn btn-danger" style="width:100%" onclick="afterRemove()">Remove local record</button>
    </div>
  </div>
</div>

<!-- Settings Modal -->
<div class="modal-bg" id="settings-modal">
  <div class="modal">
    <div class="modal-title">Settings</div>
    <div class="modal-sub">Connect to your Vault Admin webapp</div>
    <div class="field">
      <label>Webapp URL</label>
      <input type="text" id="cfg-url" placeholder="https://your-webapp.vercel.app">
    </div>
    <div id="cfg-notice" style="display:none"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeSettings()">Cancel</button>
      <button class="btn btn-primary" onclick="saveSettings()">Save</button>
    </div>
  </div>
</div>

<!-- Loading Overlay -->
<div id="loading-overlay">
  <div class="big-spinner"></div>
  <div id="loading-msg">Processing...</div>
</div>

<!-- Create Pack Modal -->
<div class="modal-bg" id="create-pack-modal">
  <div class="modal" style="max-width:500px">
    <div class="modal-title" id="cp-title-label">Create Pack</div>
    <div class="modal-sub">Define currencies and car options for this pack</div>
    <div class="field">
      <label>Pack Name</label>
      <input type="text" id="cp-name" placeholder="e.g. Starter Pack">
    </div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:8px;font-weight:500">Currencies</div>
    <div class="curr-grid">
      <div class="field"><label>Cash</label><input type="number" id="cp-cash" placeholder="0" min="0"></div>
      <div class="field"><label>Gold</label><input type="number" id="cp-gold" placeholder="0" min="0"></div>
      <div class="field"><label>Bronze Keys</label><input type="number" id="cp-bkeys" placeholder="0" min="0"></div>
      <div class="field"><label>Silver Keys</label><input type="number" id="cp-skeys" placeholder="0" min="0"></div>
      <div class="field"><label>Gold Keys</label><input type="number" id="cp-gkeys" placeholder="0" min="0"></div>
      <div class="field"><label>Fuel Pips</label><input type="number" id="cp-fuel" placeholder="0" min="0"></div>
    </div>
    <div class="field"><label>Elite Tokens</label><input type="number" id="cp-elite" placeholder="0" min="0"></div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <label class="toggle"><input type="checkbox" id="cp-cars-toggle" onchange="toggleCarsSection()"><span class="tslider"></span></label>
      <span style="font-size:13px">Add Cars</span>
    </div>
    <div id="cp-cars-section" style="display:none;border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
      <div class="curr-grid" style="margin-bottom:10px">
        <div class="field">
          <label>Car Count</label>
          <input type="number" id="cp-car-count" placeholder="e.g. 60" min="1">
        </div>
        <div class="field">
          <label>Condition</label>
          <select id="cp-car-condition">
            <option value="stock">Stock</option>
            <option value="maxed">Maxed</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>Car Selection</label>
        <select id="cp-car-mode">
          <option value="random">Random (auto-picked, no duplicates)</option>
          <option value="customizable">Customizable (buyer picks)</option>
          <option value="all">All available cars (everything not owned)</option>
        </select>
      </div>
    </div>
    <div id="cp-notice" style="display:none"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="hideModal('create-pack-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="savePack()" id="cp-save-btn">Save Pack</button>
    </div>
  </div>
</div>

<!-- Apply NSB Modal (used for both pack click and Edit NSB button) -->
<div class="modal-bg" id="apply-nsb-modal">
  <div class="modal" style="max-width:480px">
    <div class="modal-title">Apply Pack to NSB</div>
    <div class="modal-sub" id="ansb-pack-label">Select a pack and upload the NSB file</div>
    <div class="field" id="ansb-pack-select-row" style="display:none">
      <label>Pack</label>
      <select id="ansb-pack-select"></select>
    </div>
    <div class="field">
      <label>NSB File</label>
      <div class="file-drop" id="ansb-drop" onclick="document.getElementById('ansb-file').click()" ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="handleNsbDrop(event,'ansb')">
        <input type="file" id="ansb-file" style="display:none" onchange="handleNsbFile(event,'ansb')">
        <div class="file-drop-label">Click to select or drag & drop your NSB file</div>
        <div class="file-drop-name" id="ansb-file-name" style="display:none"></div>
      </div>
    </div>
    <div id="ansb-preview" style="display:none">
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px;font-weight:500">Pack Preview</div>
      <div class="preview-box" id="ansb-preview-box"></div>
    </div>
    <div id="ansb-notice" style="display:none"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="hideModal('apply-nsb-modal')">Cancel</button>
      <button class="btn btn-primary" id="ansb-apply-btn" onclick="applyNsb()" disabled>Apply & Download</button>
    </div>
  </div>
</div>

<!-- Unban Modal -->
<div class="modal-bg" id="unban-modal">
  <div class="modal" style="max-width:440px">
    <div class="modal-title">Unban NSB</div>
    <div class="modal-sub">Upload the NSB file to apply unban fixes</div>
    <div class="field">
      <label>NSB File</label>
      <div class="file-drop" id="unban-drop" onclick="document.getElementById('unban-file').click()" ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="handleNsbDrop(event,'unban')">
        <input type="file" id="unban-file" style="display:none" onchange="handleNsbFile(event,'unban')">
        <div class="file-drop-label">Click to select or drag & drop your NSB file</div>
        <div class="file-drop-name" id="unban-file-name" style="display:none"></div>
      </div>
    </div>
    <div style="background:var(--surf2);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:12px;color:var(--muted);line-height:1.8;margin-bottom:4px">
      <div style="color:var(--text);font-weight:500;margin-bottom:6px">What this does:</div>
      <div>• Resets ban detection fields</div>
      <div>• Fixes auto-start races</div>
      <div>• Clears IAPSpecial purchase markers</div>
      <div>• Removes restricted account sections</div>
      <div>• Resets event ticket counts to 0</div>
      <div>• Reduces resource balances by 30%</div>
      <div>• Halves aftermarket parts, zeros spent</div>
    </div>
    <div id="unban-notice" style="display:none"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="hideModal('unban-modal')">Cancel</button>
      <button class="btn btn-primary" id="unban-apply-btn" onclick="applyUnban()" disabled>Apply & Download</button>
    </div>
  </div>
</div>

<!-- Debug Panel -->
<div class="debug-panel" id="debug-panel">
  <div class="debug-hdr">
    <span class="debug-title">Debug Logs</span>
    <button class="btn btn-secondary btn-sm" onclick="clearLogs()">Clear</button>
    <button class="icon-btn" onclick="toggleDebug()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div class="debug-log" id="debug-log"></div>
</div>

<script>
var _url = '', _games = [], _accounts = [], _activeGame = null, _activeSection = null
var _packs = [], _nsbData = { ansb: null, unban: null }
var _editingPackId = null
var _selMode = false, _selected = new Set()
var _debugOpen = false, _pollInterval = null
var _scanAbort = false, _multiAbort = false, _multiRunId = 0
var _previewAcct = null, _importAcct = null, _afterImportId = null

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  var cfg = await apiFetch('/local/config', {}).catch(function(){ return {} })
  _url = (cfg.webappUrl || '').replace(/\\/$/, '')
  await fetchGames()
  await reloadAccounts()
  await reloadPacks()
  renderView()
  startPoll()
}

async function apiFetch(path, fallback) {
  var r = await fetch(path)
  if (!r.ok) return fallback
  return r.json()
}

// ─── Games ────────────────────────────────────────────────────────────────────

async function fetchGames() {
  if (!_url) { renderGames([], 'no-url'); return }
  try {
    var r = await fetch(_url + '/api/games')
    if (!r.ok) { renderGames([], 'error:' + r.status); return }
    var all = await r.json()
    _games = (Array.isArray(all) ? all : []).filter(function(g){ return g.script_enabled && g.scanner_type })
    renderGames(_games, null)
  } catch(e) { renderGames([], 'fetch-error:' + e.message) }
}

var SIDEBAR_CATS = [
  { key: 'accounts', label: 'Accounts' },
  { key: 'gacha',    label: 'Gacha Accounts' },
  { key: 'services', label: 'Services' },
  { key: 'tools',    label: 'Tools' },
]

function renderGames(list, err) {
  var el = document.getElementById('sidebar-content')
  if (!list.length) {
    var msg = err === 'no-url' ? 'No webapp URL — open Settings' : err ? 'Failed to load (' + err + ')' : 'No scanner games found'
    el.innerHTML = '<div class="sidebar-item" style="font-size:11px;opacity:.5">' + msg + '</div>'
    _activeGame = null; _activeSection = null
    return
  }
  var catGames = {}
  for (var i = 0; i < list.length; i++) {
    var g = list[i]
    var secs = g.script_sections || []
    for (var j = 0; j < secs.length; j++) {
      if (!catGames[secs[j]]) catGames[secs[j]] = []
      catGames[secs[j]].push(g)
    }
  }
  var html = ''
  for (var c = 0; c < SIDEBAR_CATS.length; c++) {
    var cat = SIDEBAR_CATS[c]
    var games = catGames[cat.key] || []
    if (!games.length) continue
    html += '<div class="sidebar-cat" id="scat-' + cat.key + '">'
    html += '<div class="sidebar-cat-hdr" onclick="toggleCat(\'' + cat.key + '\')">'
    html += '<span>' + cat.label + '</span>'
    html += '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>'
    html += '</div><div class="sidebar-cat-items">'
    for (var gi = 0; gi < games.length; gi++) {
      var g = games[gi]
      var isActive = _activeGame && _activeGame.id === g.id && _activeSection === cat.key
      html += '<div class="sidebar-item' + (isActive ? ' active' : '') + '" data-gid="' + escH(g.id) + '" data-sec="' + cat.key + '" onclick="pickGame(this.dataset.gid,this.dataset.sec)">'
      html += '<span class="s-dot' + (isActive ? ' on' : '') + '"></span>' + escH(g.name || g.id) + '</div>'
    }
    html += '</div></div>'
  }
  el.innerHTML = html
  if (!_activeGame) {
    var first = el.querySelector('.sidebar-item')
    if (first) pickGame(first.dataset.gid, first.dataset.sec)
  }
}

function toggleCat(key) {
  var el = document.getElementById('scat-' + key)
  if (el) el.classList.toggle('collapsed')
}

function pickGame(gid, sec) {
  _activeGame = null
  for (var i = 0; i < _games.length; i++) { if (_games[i].id === gid) { _activeGame = _games[i]; break } }
  _activeSection = sec || null
  document.querySelectorAll('#sidebar-content .sidebar-item').forEach(function(el) {
    var active = el.dataset.gid === gid && el.dataset.sec === sec
    el.classList.toggle('active', active)
    var dot = el.querySelector('.s-dot')
    if (dot) dot.classList.toggle('on', active)
  })
  renderView()
}

function renderView() {
  var isCSR2 = _activeGame && _activeGame.scanner_type === 'csr2services'
  document.getElementById('accounts-panel').style.display = isCSR2 ? 'none' : ''
  document.getElementById('csr2-panel').style.display = isCSR2 ? '' : 'none'
  if (isCSR2) {
    renderPacks()
  } else {
    renderAccounts()
    var list = _activeGame ? _accounts.filter(function(a){ return a.gameId === _activeGame.id }) : _accounts
    var hasScan = !!_activeGame
    document.getElementById('scan-btn').style.display = hasScan ? '' : 'none'
    document.getElementById('scan-current-btn').style.display = hasScan ? '' : 'none'
    document.getElementById('multi-btn').style.display = hasScan ? '' : 'none'
    document.getElementById('unfriend-btn').style.display = hasScan ? '' : 'none'
    document.getElementById('sel-btn').style.display = list.length ? '' : 'none'
  }
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

async function reloadAccounts() {
  _accounts = await apiFetch('/local/accounts', [])
}

function renderAccounts() {
  var grid = document.getElementById('grid')
  var list = _activeGame
    ? _accounts.filter(function(a){ return a.gameId === _activeGame.id })
    : _accounts
  document.getElementById('sel-btn').style.display = list.length ? '' : 'none'
  if (!list.length) {
    grid.innerHTML = '<div class="empty"><h3>No accounts yet</h3><p>Use Single Scan or Multi Scan to add accounts.</p></div>'
    return
  }
  var html = ''
  for (var i = 0; i < list.length; i++) {
    var a = list[i]
    var name = a.summonerName ? (a.summonerName + (a.tagLine ? '#' + a.tagLine : '')) : 'Unknown'
    var skins = Array.isArray(a.ownedSkinIds) ? a.ownedSkinIds.length : 0
    var rank = a.soloRank || 'Unranked'
    var isSel = _selected.has(a.id)
    html += '<div class="card' + (isSel ? ' sel' : '') + '" id="c-' + a.id + '">' +
      (_selMode ? '<div class="chk' + (isSel ? ' on' : '') + '" data-id="' + a.id + '" onclick="toggleSel(this.dataset.id,event)">' +
        (isSel ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '') +
        '</div>' : '') +
      '<div class="card-thumb"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3a4050" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>' +
      '<div class="card-body"><div class="card-name" title="' + escH(name) + '">' + escH(name) + '</div>' +
      '<div class="card-meta"><span>' + skins + ' skins</span><span>' + escH(rank) + '</span></div></div>' +
      '<div class="card-overlay">' +
      '<button class="ov-btn ov-import" data-id="' + a.id + '" onclick="openImport(this.dataset.id,event)">Import to Webapp</button>' +
      '<button class="ov-btn ov-preview" data-id="' + a.id + '" onclick="openPreview(this.dataset.id,event)">Preview Link</button>' +
      '<button class="ov-btn ov-remove" data-id="' + a.id + '" onclick="removeAcct(this.dataset.id,event)">Remove</button>' +
      '</div></div>'
  }
  grid.innerHTML = html
}

function escH(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

// ─── Status Polling ───────────────────────────────────────────────────────────

function startPoll() {
  if (_pollInterval) clearInterval(_pollInterval)
  _pollInterval = setInterval(async function() {
    try {
      var s = await apiFetch('/status', {})
      var banner = document.getElementById('scan-banner')
      var grid = document.getElementById('grid')
      var gameItems = document.querySelectorAll('#games-list .sidebar-item')
      var scanBtnEl = document.getElementById('scan-btn')
      var multiBtnEl = document.getElementById('multi-btn')
      if (s.webappScanning) {
        banner.classList.add('on')
        grid.classList.add('grid-blur')
        gameItems.forEach(function(el){ el.classList.add('blur') })
        if (scanBtnEl) { scanBtnEl.disabled = true; scanBtnEl.style.opacity = '0.4'; scanBtnEl.style.cursor = 'not-allowed' }
        if (multiBtnEl) { multiBtnEl.disabled = true; multiBtnEl.style.opacity = '0.4'; multiBtnEl.style.cursor = 'not-allowed' }
      } else {
        banner.classList.remove('on')
        grid.classList.remove('grid-blur')
        gameItems.forEach(function(el){ el.classList.remove('blur') })
        if (scanBtnEl) { scanBtnEl.disabled = false; scanBtnEl.style.opacity = ''; scanBtnEl.style.cursor = '' }
        if (multiBtnEl) { multiBtnEl.disabled = false; multiBtnEl.style.opacity = ''; multiBtnEl.style.cursor = '' }
      }
    } catch(e) {}
  }, 3500)
}

// ─── Single Scan ──────────────────────────────────────────────────────────────

function openSingleScan() {
  _scanAbort = false
  resetScanModal()
  showModal('scan-modal')
  runSingleScan()
}

function closeScanModal() {
  _scanAbort = true
  hideModal('scan-modal')
}

function resetScanModal() {
  _scanAbort = false
  setStep(1, 'pending', '')
  setStep(2, 'pending', '')
  setStep(3, 'pending', '')
  hideNotice('scan-notice')
  document.getElementById('scan-retry-btn').style.display = 'none'
  document.getElementById('scan-close-btn').textContent = 'Cancel'
}

function setStep(n, state, sub) {
  var ico = document.getElementById('s' + n + '-ico')
  var subEl = document.getElementById('s' + n + '-sub')
  ico.className = 'step-ico ico-' + state
  if (state === 'active') ico.innerHTML = '<div class="spinner"></div>'
  else if (state === 'done') ico.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
  else if (state === 'error') ico.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  else ico.textContent = n
  if (subEl && sub !== undefined) subEl.textContent = sub
}

async function runSingleScan() {
  // Step 1: Riot Client
  setStep(1, 'active', 'Checking Riot Client...')
  var rc = await apiFetch('/riot/status', { running: false })
  if (_scanAbort) return
  if (!rc.running) {
    setStep(1, 'error', 'Riot Client not running')
    showNotice('scan-notice', 'error', 'Riot Client is not running. Open the Riot Client app first, then retry.')
    document.getElementById('scan-retry-btn').style.display = ''
    document.getElementById('scan-close-btn').textContent = 'Close'
    return
  }
  setStep(1, 'done', 'Riot Client detected')

  // Step 2: League Client
  setStep(2, 'active', 'Checking League client...')
  var lcuOk = await apiFetch('/ping-lcu', { ok: false }).then(function(r){ return r.ok })
  if (_scanAbort) return
  if (!lcuOk) {
    setStep(2, 'active', 'Launching League of Legends...')
    await fetch('/riot/launch-league', { method: 'POST' }).catch(function(){})
    if (_scanAbort) return
    setStep(2, 'active', 'Waiting for League to load (up to 90s)...')
    var deadline = Date.now() + 90000
    while (Date.now() < deadline && !_scanAbort) {
      await sleep(5000)
      if (_scanAbort) return
      var ping = await apiFetch('/ping-lcu', { ok: false })
      if (ping.ok) { lcuOk = true; break }
    }
    if (!lcuOk) {
      setStep(2, 'error', 'League client did not start')
      showNotice('scan-notice', 'error', 'League of Legends did not start in time. Launch it manually and retry.')
      document.getElementById('scan-retry-btn').style.display = ''
      document.getElementById('scan-close-btn').textContent = 'Close'
      return
    }
  }
  if (_scanAbort) return
  setStep(2, 'done', 'League client ready')

  // Step 3: Scan with auto-retry (5s gaps, 2 min max)
  setStep(3, 'active', 'Scanning account...')
  var result = null
  var scanDl = Date.now() + 120000
  var scanAttempt = 0
  while (Date.now() < scanDl && !_scanAbort) {
    if (scanAttempt > 0) setStep(3, 'active', 'Retrying scan (attempt ' + (scanAttempt + 1) + ')...')
    result = await fetch('/scan', { method: 'POST' }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
    if (_scanAbort) return
    if (!result.error && Array.isArray(result.ownedSkinIds) && result.ownedSkinIds.length > 0) break
    scanAttempt++
    if (Date.now() < scanDl) { setStep(3, 'active', 'No data yet, retrying in 5s...'); await sleep(5000) }
  }
  if (_scanAbort) return
  if (!result || result.error) {
    setStep(3, 'error', 'Scan failed')
    showNotice('scan-notice', 'error', result ? result.error : 'Scan timed out after 2 minutes')
    document.getElementById('scan-retry-btn').style.display = ''
    document.getElementById('scan-close-btn').textContent = 'Close'
    return
  }
  setStep(3, 'done', 'Scan complete!')
  showNotice('scan-notice', 'success', 'Account scanned! Saving locally...')
  var ok = await saveLocally(result)
  if (ok) {
    await reloadAccounts()
    renderAccounts()
    await sleep(600)
    hideModal('scan-modal')
  }
}

async function retryScan() {
  document.getElementById('scan-retry-btn').style.display = 'none'
  resetScanModal()
  runSingleScan()
}

async function saveLocally(data) {
  var gameId = _activeGame ? _activeGame.id : null
  var existing = _accounts.find(function(a){ return a.summonerName === data.summonerName && a.region === data.region && a.gameId === gameId })
  var body = {
    id: existing ? existing.id : uid(),
    gameId: gameId,
    summonerName: data.summonerName || '',
    tagLine: data.tagLine || '',
    region: data.region || '',
    soloRank: data.soloRank || null,
    ownedSkinIds: data.ownedSkinIds || [],
    scanData: data,
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  if (existing && existing.previewId && _url) {
    fetch(_url + '/api/lol-skins/' + existing.previewId, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresAt: new Date().toISOString() })
    }).catch(function(){})
  }
  var url = existing ? '/local/accounts/' + existing.id : '/local/accounts'
  var method = existing ? 'PATCH' : 'POST'
  var r = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(function(){ return null })
  return r && r.ok
}

// ─── Scan Current Account ────────────────────────────────────────────────────

async function scanCurrentAccount() {
  var btn = document.getElementById('scan-current-btn')
  btn.disabled = true
  btn.textContent = 'Scanning...'
  var result = await fetch('/scan', { method: 'POST' }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (result.error) {
    btn.textContent = 'Scan Current'
    btn.disabled = false
    alert('Scan failed: ' + result.error)
    return
  }
  await saveLocally(result)
  await reloadAccounts()
  renderAccounts()
  btn.textContent = 'Scan Current'
  btn.disabled = false
}

// ─── Unfriend All ────────────────────────────────────────────────────────────

function openUnfriendModal() {
  hideNotice('unfriend-notice')
  var btn = document.getElementById('unfriend-confirm-btn')
  btn.disabled = false
  btn.style.display = ''
  btn.textContent = 'Remove All'
  showModal('unfriend-modal')
}

async function confirmUnfriendAll() {
  var btn = document.getElementById('unfriend-confirm-btn')
  btn.disabled = true
  btn.textContent = 'Removing...'
  hideNotice('unfriend-notice')
  var res = await fetch('/unfriend-all', { method: 'POST' }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (res.error) {
    showNotice('unfriend-notice', 'error', res.error)
    btn.disabled = false
    btn.textContent = 'Remove All'
  } else {
    showNotice('unfriend-notice', 'success', 'Removed ' + res.count + ' friend' + (res.count === 1 ? '' : 's') + '.')
    btn.style.display = 'none'
  }
}

// ─── Multi Scan ───────────────────────────────────────────────────────────────

function openMultiScan() {
  _multiAbort = false
  document.getElementById('multi-creds').value = ''
  document.getElementById('multi-creds-section').style.display = ''
  document.getElementById('multi-progress').style.display = 'none'
  document.getElementById('multi-start-btn').style.display = ''
  document.getElementById('multi-close-btn').textContent = 'Cancel'
  hideNotice('multi-notice')
  showModal('multi-modal')
}

function closeMultiModal() {
  _multiAbort = true
  hideModal('multi-modal')
}

async function startMultiScan() {
  var raw = document.getElementById('multi-creds').value.trim()
  if (!raw) { showNotice('multi-notice', 'error', 'Enter at least one username:password pair.'); return }
  var creds = raw.split('\\n').map(function(l){ return l.trim() }).filter(function(l){ return l.indexOf(':') > 0 })
  if (!creds.length) { showNotice('multi-notice', 'error', 'No valid credentials. Format: username:password'); return }
  document.getElementById('multi-creds-section').style.display = 'none'
  document.getElementById('multi-start-btn').style.display = 'none'
  document.getElementById('multi-progress').style.display = ''
  document.getElementById('multi-close-btn').textContent = 'Stop'
  hideNotice('multi-notice')
  _multiAbort = false
  _multiRunId++
  await runMultiLoop(creds, _multiRunId)
}

async function runMultiLoop(creds, myRunId) {
  var stepsEl = document.getElementById('multi-steps')
  var progEl = document.getElementById('multi-prog-label')
  function aborted() { return _multiAbort || _multiRunId !== myRunId }

  function addStep(label) {
    stepsEl.innerHTML += '<div class="step"><div class="step-ico ico-active"><div class="spinner"></div></div><div class="step-info"><div class="step-main">' + label + '</div></div></div>'
  }
  function markLastDone() {
    var actives = stepsEl.querySelectorAll('.ico-active')
    if (!actives.length) return
    var last = actives[actives.length - 1]
    last.className = 'step-ico ico-done'
    last.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
  }
  function markLastError() {
    var actives = stepsEl.querySelectorAll('.ico-active')
    if (!actives.length) return
    var last = actives[actives.length - 1]
    last.className = 'step-ico ico-error'
    last.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  }
  async function clientLog(msg) {
    await fetch('/debug-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) }).catch(function(){})
  }

  for (var i = 0; i < creds.length; i++) {
    if (aborted()) break
    var parts = creds[i].split(':')
    var username = parts[0]
    var password = parts.slice(1).join(':')
    progEl.textContent = 'Account ' + (i + 1) + ' of ' + creds.length + ': ' + username
    stepsEl.innerHTML = ''

    // Restart Riot Client to get a completely fresh auth session
    addStep('Restarting Riot Client...')
    await fetch('/riot/restart-client', { method: 'POST' }).catch(function(){})
    var rcReady = false
    var rcDl = Date.now() + 45000
    while (Date.now() < rcDl && !aborted()) {
      await sleep(2000)
      var rcStatus = await apiFetch('/riot/status', { running: false })
      if (rcStatus.running) { rcReady = true; break }
    }
    if (aborted()) break
    if (!rcReady) {
      markLastError()
      showNotice('multi-notice', 'error', 'Riot Client did not start — check install path.')
      break
    }
    await sleep(6000)
    markLastDone()
    if (aborted()) break

    // Login via SendKeys
    addStep('Logging in as ' + escH(username) + '...')
    await clientLog('multi-scan: firing sendkeys for ' + username)
    await fetch('/riot/sendkeys-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username, password: password }) }).catch(function(){})
    if (aborted()) break
    var loggedIn = false
    var loginDl = Date.now() + 35000
    while (Date.now() < loginDl && !aborted()) {
      await sleep(2000)
      var authState = await apiFetch('/riot/auth-state', { state: null })
      await clientLog('multi-scan: auth-state poll = ' + authState.state)
      if (authState.state === 'authenticated') { loggedIn = true; break }
    }
    if (aborted()) break
    if (!loggedIn) {
      markLastError()
      showNotice('multi-notice', 'error', username + ': Login failed — check credentials or Riot Client focus.')
      await sleep(2000)
      continue
    }
    markLastDone()
    if (aborted()) break
    await sleep(3000) // give RC a moment to fully settle after login before launching

    // Check League patch state — only pause if we explicitly detect update/repair
    addStep('Checking League...')
    var leagueState = await apiFetch('/riot/league-patch-state', { skip: true })
    await clientLog('league-patch-state: ' + JSON.stringify(leagueState))
    markLastDone()
    if (aborted()) break

    if (!leagueState.skip && (leagueState.needs_patch || leagueState.needs_repair || leagueState.patching)) {
      var patchLabel = leagueState.needs_repair ? 'League needs repair — please repair in Riot Client, waiting...' : 'League needs update — please update in Riot Client, waiting...'
      addStep(patchLabel)
      // Pause and poll until League is ready — no auto-patching
      var patchDone = false
      var patchDl = Date.now() + 45 * 60 * 1000
      while (Date.now() < patchDl && !aborted()) {
        await sleep(15000)
        var ps = await apiFetch('/riot/league-patch-state', { skip: true })
        await clientLog('patch-progress: ' + JSON.stringify(ps))
        if (ps.skip || ps.ready) { patchDone = true; break }
      }
      if (aborted()) break
      if (!patchDone) {
        markLastError()
        showNotice('multi-notice', 'error', username + ': League update timed out (45 min).')
        continue
      }
      markLastDone()
      if (aborted()) break
    }

    // Launch League
    addStep('Launching League...')
    await clientLog('multi-scan: calling launch-league')
    var launchRes = await fetch('/riot/launch-league', { method: 'POST' }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
    await clientLog('multi-scan: launch-league result = ' + JSON.stringify(launchRes))
    if (aborted()) break
    markLastDone()

    // Wait for League LCU (90s)
    addStep('Waiting for League client (up to 90s)...')
    var ready = false
    var dl = Date.now() + 90000
    while (Date.now() < dl && !aborted()) {
      await sleep(5000)
      var p = await apiFetch('/ping-lcu', { ok: false })
      if (p.ok) { ready = true; break }
    }
    if (aborted()) break
    if (!ready) {
      markLastError()
      showNotice('multi-notice', 'error', username + ': League did not start in 90s, skipping.')
      await sleep(1500)
      continue
    }
    markLastDone()

    // Scan with auto-retry (5s gaps, 2 min max)
    addStep('Scanning...')
    var result = null
    var scanDl = Date.now() + 120000
    while (Date.now() < scanDl && !aborted()) {
      result = await fetch('/scan', { method: 'POST' }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
      if (aborted()) break
      if (!result.error && Array.isArray(result.ownedSkinIds) && result.ownedSkinIds.length > 0) break
      if (Date.now() < scanDl) await sleep(5000)
    }
    if (aborted()) break
    if (!result || result.error) {
      markLastError()
      showNotice('multi-notice', 'error', username + ': Scan failed — ' + (result ? result.error : 'timed out'))
    } else {
      markLastDone()
      await saveLocally(result)
      await reloadAccounts()
      renderAccounts()
      // Unfriend all if toggle is enabled
      if (document.getElementById('multi-unfriend-toggle').checked) {
        addStep('Unfriending all friends...')
        var ufRes = await fetch('/unfriend-all', { method: 'POST' }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
        if (ufRes.error) { markLastError() } else { markLastDone() }
      }
    }
    await sleep(2000)
  }
  if (!aborted()) {
    progEl.textContent = 'All done!'
    document.getElementById('multi-close-btn').textContent = 'Close'
  }
}

// ─── Preview Link ─────────────────────────────────────────────────────────────

function openPreview(id, e) {
  if (e) e.stopPropagation()
  _previewAcct = _accounts.find(function(a){ return a.id === id })
  if (!_previewAcct) return
  document.getElementById('prev-link-box').style.display = 'none'
  document.getElementById('prev-gen-btn').style.display = ''
  document.getElementById('prev-hide').checked = true
  document.getElementById('prev-expiry').value = '7'
  hideNotice('prev-notice')
  showModal('preview-modal')
}

function closePreviewModal() { hideModal('preview-modal') }

async function generateLink() {
  if (!_previewAcct) return
  if (!_url) { showNotice('prev-notice', 'error', 'Webapp URL not set — open Settings first.'); return }
  document.getElementById('prev-gen-btn').style.display = 'none'
  showNotice('prev-notice', 'info', 'Generating link...')
  var hideName = document.getElementById('prev-hide').checked
  var days = parseInt(document.getElementById('prev-expiry').value)
  var d = _previewAcct.scanData || {}
  var skinCount = Array.isArray(d.ownedSkinIds) ? d.ownedSkinIds.length : (Array.isArray(_previewAcct.ownedSkinIds) ? _previewAcct.ownedSkinIds.length : 0)
  var body = {
    summonerName: d.summonerName || '', tagLine: d.tagLine || '', region: d.region || '',
    profileIconId: d.profileIconId || null, summonerLevel: d.summonerLevel || null,
    soloRank: d.soloRank || null, flexRank: d.flexRank || null,
    soloPeakRank: d.soloPeakRank || null, soloPrevRank: d.soloPrevRank || null,
    rp: d.rp || null, be: d.be || null,
    ownedSkinIds: d.ownedSkinIds || [], ownedChromaIds: d.ownedChromaIds || [],
    ownedEmoteIds: d.ownedEmoteIds || [], ownedIconIds: d.ownedIconIds || [],
    lootSummary: d.lootSummary || null, rankHistory: d.rankHistory || null,
    champCount: d.champCount || null, championMastery: d.championMastery || null,
    lastMatch: d.lastMatch || null,
    hideName: hideName,
    expiresAt: days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null,
    accountTitle: skinCount + ' Skins Account',
  }
  var res = await fetch(_url + '/api/lol-skins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (res.error) {
    showNotice('prev-notice', 'error', 'Failed: ' + res.error)
    document.getElementById('prev-gen-btn').style.display = ''
    return
  }
  var acct = _accounts.find(function(a){ return a.id === _previewAcct.id })
  if (acct) {
    acct.previewId = res.id
    fetch('/local/accounts/' + acct.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previewId: res.id }) }).catch(function(){})
  }
  var link = 'https://lolprev.site/preview/lol/' + res.id
  document.getElementById('prev-link-text').textContent = link
  document.getElementById('prev-link-box').style.display = ''
  showNotice('prev-notice', 'success', 'Link created! Expires ' + (days > 0 ? 'in ' + days + ' day(s)' : 'never') + '.')
}

function copyLink() {
  var txt = document.getElementById('prev-link-text').textContent
  navigator.clipboard.writeText(txt).catch(function(){})
  var btn = document.getElementById('prev-copy-btn')
  btn.textContent = 'Copied!'
  setTimeout(function(){ btn.textContent = 'Copy' }, 2000)
}

// ─── Import to Webapp ─────────────────────────────────────────────────────────

function openImport(id, e) {
  if (e) e.stopPropagation()
  _importAcct = _accounts.find(function(a){ return a.id === id })
  if (!_importAcct) return
  var name = _importAcct.summonerName || 'Unknown'
  var skins = Array.isArray(_importAcct.ownedSkinIds) ? _importAcct.ownedSkinIds.length : 0
  document.getElementById('import-acct-info').textContent = name + ' — ' + skins + ' skins'
  document.getElementById('import-confirm-btn').disabled = false
  hideNotice('import-notice')
  showModal('import-modal')
}

function closeImportModal() { hideModal('import-modal') }

async function doImport() {
  if (!_importAcct) return
  if (!_url) { showNotice('import-notice', 'error', 'Webapp URL not set — open Settings first.'); return }
  document.getElementById('import-confirm-btn').disabled = true
  showNotice('import-notice', 'info', 'Sending to webapp...')
  var d = _importAcct.scanData || {}
  var skinCount = Array.isArray(d.ownedSkinIds) ? d.ownedSkinIds.length : 0
  var body = {
    summonerName: d.summonerName || '', tagLine: d.tagLine || '', region: d.region || '',
    profileIconId: d.profileIconId || null, summonerLevel: d.summonerLevel || null,
    soloRank: d.soloRank || null, flexRank: d.flexRank || null,
    soloPeakRank: d.soloPeakRank || null, soloPrevRank: d.soloPrevRank || null,
    rp: d.rp || null, be: d.be || null,
    ownedSkinIds: d.ownedSkinIds || [], ownedChromaIds: d.ownedChromaIds || [],
    ownedEmoteIds: d.ownedEmoteIds || [], ownedIconIds: d.ownedIconIds || [],
    lootSummary: d.lootSummary || null, rankHistory: d.rankHistory || null,
    champCount: d.champCount || null, championMastery: d.championMastery || null,
    lastMatch: d.lastMatch || null, accountTitle: skinCount + ' Skins Account',
  }
  var res = await fetch(_url + '/api/lol-skins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (res.error) {
    showNotice('import-notice', 'error', 'Import failed: ' + res.error)
    document.getElementById('import-confirm-btn').disabled = false
    return
  }
  // Save as pending import — webapp will show a notification on next visit
  var pending = { scanId: res.id, accountName: (_importAcct.summonerName || 'Unknown') + (skinCount ? ' · ' + skinCount + ' skins' : ''), importedAt: Date.now() }
  await fetch('/local/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign(await fetch('/local/config').then(function(r){ return r.json() }).catch(function(){ return {} }), { pendingImport: pending })) }).catch(function(){})
  _afterImportId = _importAcct.id
  hideModal('import-modal')
  showModal('after-import-modal')
}

function afterKeep() { hideModal('after-import-modal'); _afterImportId = null }

async function afterRemove() {
  if (_afterImportId) {
    await fetch('/local/accounts/' + _afterImportId, { method: 'DELETE' }).catch(function(){})
    await reloadAccounts()
    renderAccounts()
  }
  hideModal('after-import-modal')
  _afterImportId = null
}

// ─── Remove ───────────────────────────────────────────────────────────────────

async function removeAcct(id, e) {
  if (e) e.stopPropagation()
  await fetch('/local/accounts/' + id, { method: 'DELETE' }).catch(function(){})
  await reloadAccounts()
  renderAccounts()
}

// ─── Select Mode ──────────────────────────────────────────────────────────────

function toggleSelect() {
  _selMode = !_selMode
  _selected.clear()
  document.getElementById('sel-btn').textContent = _selMode ? 'Cancel' : 'Select'
  document.getElementById('sel-bar').classList.toggle('hide', !_selMode)
  renderAccounts()
}

function clearSel() {
  _selMode = false
  _selected.clear()
  document.getElementById('sel-btn').textContent = 'Select'
  document.getElementById('sel-bar').classList.add('hide')
  renderAccounts()
}

function toggleSel(id, e) {
  if (e) e.stopPropagation()
  if (_selected.has(id)) _selected.delete(id)
  else _selected.add(id)
  document.getElementById('sel-count').textContent = _selected.size + ' selected'
  renderAccounts()
}

async function deleteSel() {
  var ids = Array.from(_selected)
  for (var i = 0; i < ids.length; i++) {
    await fetch('/local/accounts/' + ids[i], { method: 'DELETE' }).catch(function(){})
  }
  clearSel()
  await reloadAccounts()
  renderAccounts()
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function openSettings() {
  document.getElementById('cfg-url').value = _url
  hideNotice('cfg-notice')
  showModal('settings-modal')
}

function closeSettings() { hideModal('settings-modal') }

async function saveSettings() {
  var u = document.getElementById('cfg-url').value.trim().replace(/\\/$/, '')
  await fetch('/local/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ webappUrl: u }) }).catch(function(){})
  _url = u
  showNotice('cfg-notice', 'success', 'Saved!')
  setTimeout(function(){ closeSettings() }, 700)
  await fetchGames()
}

// ─── Debug ────────────────────────────────────────────────────────────────────

function toggleDebug() {
  _debugOpen = !_debugOpen
  document.getElementById('debug-panel').classList.toggle('open', _debugOpen)
  if (_debugOpen) refreshLogs()
}

async function refreshLogs() {
  var data = await apiFetch('/debug-logs', { logs: [] })
  var el = document.getElementById('debug-log')
  el.innerHTML = (data.logs || []).map(function(l){ return '<div class="log-line">' + escH(l) + '</div>' }).join('')
  el.scrollTop = el.scrollHeight
}

async function clearLogs() {
  await fetch('/debug-logs', { method: 'DELETE' }).catch(function(){})
  document.getElementById('debug-log').innerHTML = ''
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function showModal(id) { document.getElementById(id).classList.add('on') }
function hideModal(id) { document.getElementById(id).classList.remove('on') }

function showNotice(elId, type, msg) {
  var el = document.getElementById(elId)
  if (!el) return
  el.style.display = 'block'
  el.className = 'notice n-' + type
  el.textContent = msg
}

function hideNotice(elId) {
  var el = document.getElementById(elId)
  if (el) el.style.display = 'none'
}

function sleep(ms) { return new Promise(function(r){ setTimeout(r, ms) }) }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }

// ─── CSR2 Packs ───────────────────────────────────────────────────────────────

async function reloadPacks() {
  _packs = await apiFetch('/csr2/packs', [])
}

function renderPacks() {
  var grid = document.getElementById('packs-grid')
  if (!_packs.length) {
    grid.innerHTML = '<div class="empty"><h3>No packs yet</h3><p>Click <b>+ Create Pack</b> to define a service pack.</p></div>'
    return
  }
  var html = ''
  for (var i = 0; i < _packs.length; i++) {
    var p = _packs[i]
    var meta = buildPackMeta(p)
    html += '<div class="pack-card" onclick="openEditNsb(\'' + p.id + '\')">'
    html += '<button class="pack-card-del" data-pid="' + p.id + '" onclick="deletePack(event,this.dataset.pid)" title="Delete pack">'
    html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
    html += '<div class="pack-card-name">' + escH(p.name || 'Unnamed Pack') + '</div>'
    html += '<div class="pack-card-meta">' + meta.map(function(m){ return '<span>' + escH(m) + '</span>' }).join('') + '</div>'
    html += '</div>'
  }
  grid.innerHTML = html
}

function buildPackMeta(p) {
  var lines = []
  var c = p.currencies || {}
  var parts = []
  if (c.cash)       parts.push(c.cash.toLocaleString() + ' Cash')
  if (c.gold)       parts.push(c.gold.toLocaleString() + ' Gold')
  if (c.bronzeKeys) parts.push(c.bronzeKeys + ' Bronze Keys')
  if (c.silverKeys) parts.push(c.silverKeys + ' Silver Keys')
  if (c.goldKeys)   parts.push(c.goldKeys + ' Gold Keys')
  if (c.fuel)       parts.push(c.fuel + ' Fuel')
  if (c.eliteTokens) parts.push(c.eliteTokens + ' Elite Tokens')
  if (parts.length) lines.push(parts.join(' · '))
  if (p.cars && p.cars.carMode) {
    var carLine = p.cars.count + ' cars · ' + p.cars.carMode
    if (p.cars.condition === 'maxed') carLine += ' · Maxed'
    lines.push(carLine)
  }
  return lines.length ? lines : ['No modifiers']
}

async function deletePack(e, id) {
  e.stopPropagation()
  await fetch('/csr2/packs/' + id, { method: 'DELETE' }).catch(function(){})
  await reloadPacks()
  renderPacks()
}

// ─── Create Pack Modal ────────────────────────────────────────────────────────

function toggleCarsSection() {
  var on = document.getElementById('cp-cars-toggle').checked
  document.getElementById('cp-cars-section').style.display = on ? '' : 'none'
}

function openCreatePack() {
  _editingPackId = null
  document.getElementById('cp-title-label').textContent = 'Create Pack'
  document.getElementById('cp-name').value = ''
  document.getElementById('cp-cash').value = ''
  document.getElementById('cp-gold').value = ''
  document.getElementById('cp-bkeys').value = ''
  document.getElementById('cp-skeys').value = ''
  document.getElementById('cp-gkeys').value = ''
  document.getElementById('cp-fuel').value = ''
  document.getElementById('cp-elite').value = ''
  document.getElementById('cp-cars-toggle').checked = false
  document.getElementById('cp-cars-section').style.display = 'none'
  document.getElementById('cp-car-count').value = ''
  document.getElementById('cp-car-condition').value = 'stock'
  document.getElementById('cp-car-mode').value = 'random'
  hideNotice('cp-notice')
  showModal('create-pack-modal')
}

async function savePack() {
  var name = document.getElementById('cp-name').value.trim()
  if (!name) { showNotice('cp-notice', 'error', 'Enter a pack name.'); return }
  var currencies = {}
  var cash = parseInt(document.getElementById('cp-cash').value) || 0
  var gold = parseInt(document.getElementById('cp-gold').value) || 0
  var bkeys = parseInt(document.getElementById('cp-bkeys').value) || 0
  var skeys = parseInt(document.getElementById('cp-skeys').value) || 0
  var gkeys = parseInt(document.getElementById('cp-gkeys').value) || 0
  var fuel = parseInt(document.getElementById('cp-fuel').value) || 0
  var elite = parseInt(document.getElementById('cp-elite').value) || 0
  if (cash)   currencies.cash = cash
  if (gold)   currencies.gold = gold
  if (bkeys)  currencies.bronzeKeys = bkeys
  if (skeys)  currencies.silverKeys = skeys
  if (gkeys)  currencies.goldKeys = gkeys
  if (fuel)   currencies.fuel = fuel
  if (elite)  currencies.eliteTokens = elite
  var carsOn = document.getElementById('cp-cars-toggle').checked
  var cars = carsOn ? {
    count: parseInt(document.getElementById('cp-car-count').value) || 0,
    condition: document.getElementById('cp-car-condition').value,
    carMode: document.getElementById('cp-car-mode').value,
  } : null
  var pack = { name, currencies, cars }
  var url = _editingPackId ? '/csr2/packs/' + _editingPackId : '/csr2/packs'
  var method = _editingPackId ? 'PATCH' : 'POST'
  var res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pack) }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (res.error) { showNotice('cp-notice', 'error', res.error); return }
  hideModal('create-pack-modal')
  await reloadPacks()
  renderPacks()
}

// ─── Apply NSB Modal ──────────────────────────────────────────────────────────

function openEditNsb(packId) {
  _nsbData.ansb = null
  document.getElementById('ansb-file-name').style.display = 'none'
  document.getElementById('ansb-preview').style.display = 'none'
  document.getElementById('ansb-apply-btn').disabled = true
  document.getElementById('ansb-drop').classList.remove('over')
  hideNotice('ansb-notice')
  var noPresel = !packId
  document.getElementById('ansb-pack-select-row').style.display = noPresel ? '' : 'none'
  if (noPresel) {
    var sel = document.getElementById('ansb-pack-select')
    sel.innerHTML = _packs.map(function(p){ return '<option value="' + p.id + '">' + escH(p.name) + '</option>' }).join('')
    document.getElementById('ansb-pack-label').textContent = 'Select a pack and upload the NSB file'
  } else {
    var pack = _packs.find(function(p){ return p.id === packId })
    document.getElementById('ansb-pack-select').value = packId
    document.getElementById('ansb-pack-label').textContent = pack ? 'Pack: ' + pack.name : 'Apply pack'
    // Store selected pack id in select for applyNsb to read
    document.getElementById('ansb-pack-select').dataset.forcedId = packId
  }
  showModal('apply-nsb-modal')
}

function handleNsbDrop(e, which) {
  e.preventDefault()
  document.getElementById(which + '-drop').classList.remove('over')
  var file = e.dataTransfer.files[0]
  if (file) readNsbFile(file, which)
}

function handleNsbFile(e, which) {
  var file = e.target.files[0]
  if (file) readNsbFile(file, which)
}

function readNsbFile(file, which) {
  var reader = new FileReader()
  reader.onload = function(e) {
    var base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(e.target.result)))
    _nsbData[which] = { base64: base64, name: file.name }
    document.getElementById(which + '-file-name').textContent = file.name
    document.getElementById(which + '-file-name').style.display = ''
    if (which === 'ansb') {
      showAnsbPreview()
      document.getElementById('ansb-apply-btn').disabled = false
    } else {
      document.getElementById('unban-apply-btn').disabled = false
    }
  }
  reader.readAsArrayBuffer(file)
}

function showAnsbPreview() {
  var packId = document.getElementById('ansb-pack-select').dataset.forcedId || document.getElementById('ansb-pack-select').value
  var pack = _packs.find(function(p){ return p.id === packId })
  if (!pack) return
  var meta = buildPackMeta(pack)
  var box = document.getElementById('ansb-preview-box')
  box.innerHTML = meta.map(function(m){ return '<div>' + escH(m) + '</div>' }).join('')
  document.getElementById('ansb-preview').style.display = ''
}

async function applyNsb() {
  if (!_nsbData.ansb) return
  var packId = document.getElementById('ansb-pack-select').dataset.forcedId || document.getElementById('ansb-pack-select').value
  showLoading('Applying pack...')
  var res = await fetch('/csr2/apply-nsb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nsbBase64: _nsbData.ansb.base64, packId: packId })
  }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  hideLoading()
  if (res.error) { showNotice('ansb-notice', 'error', res.error); return }
  downloadBase64(res.resultBase64, _nsbData.ansb.name || 'nsb.txt')
  hideModal('apply-nsb-modal')
}

// ─── Unban Modal ──────────────────────────────────────────────────────────────

function openUnban() {
  _nsbData.unban = null
  document.getElementById('unban-file-name').style.display = 'none'
  document.getElementById('unban-apply-btn').disabled = true
  document.getElementById('unban-drop').classList.remove('over')
  hideNotice('unban-notice')
  showModal('unban-modal')
}

async function applyUnban() {
  if (!_nsbData.unban) return
  showLoading('Applying unban...')
  var res = await fetch('/csr2/unban', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nsbBase64: _nsbData.unban.base64 })
  }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  hideLoading()
  if (res.error) { showNotice('unban-notice', 'error', res.error); return }
  downloadBase64(res.resultBase64, _nsbData.unban.name || 'nsb.txt')
  hideModal('unban-modal')
}

// ─── Loading + Download utils ─────────────────────────────────────────────────

function showLoading(msg) {
  document.getElementById('loading-msg').textContent = msg || 'Processing...'
  document.getElementById('loading-overlay').classList.add('on')
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.remove('on')
}

function downloadBase64(b64, filename) {
  var bytes = Uint8Array.from(atob(b64), function(c){ return c.charCodeAt(0) })
  var blob = new Blob([bytes])
  var a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

init()
// Heartbeat: immediate on load, then every 5s — keeps server alive while window is open
function sendHeartbeat() { fetch('/heartbeat', { method: 'POST' }).catch(function(){}) }
sendHeartbeat()
setInterval(sendHeartbeat, 5000)
// Signal server to shut down when window closes (5s grace so refresh can cancel it)
window.addEventListener('beforeunload', function() { navigator.sendBeacon('/shutdown', '{}') })
</script>
</body>
</html>`

// ─── HTTP Server ──────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { setCors(res); res.writeHead(204); res.end(); return }

  let pathname = '/'
  try { pathname = new URL(req.url || '/', 'http://localhost').pathname } catch {}

  // Serve UI
  if (req.method === 'GET' && pathname === '/') return html(res, UI_HTML)

  // Ping — includes cached LCU status so webapp can detect League client
  if (req.method === 'GET' && pathname === '/ping') return json(res, 200, { ok: true, version: VERSION, leagueOpen: _lcuOnline })

  // Heartbeat — browser sends every 5s; also cancels any pending shutdown (refresh vs close)
  if (req.method === 'POST' && pathname === '/heartbeat') {
    lastHeartbeat = Date.now()
    if (_shutdownTimer) { clearTimeout(_shutdownTimer); _shutdownTimer = null }
    return json(res, 200, { ok: true })
  }

  // Shutdown — browser sends via sendBeacon on beforeunload; 5s timer so refresh can cancel it
  if (req.method === 'POST' && pathname === '/shutdown') {
    json(res, 200, { ok: true })
    _shutdownTimer = setTimeout(() => { log('Window closed — shutting down'); process.exit(0) }, 5000)
    return
  }

  // LCU ping — checks if League client is running and logged in
  if (req.method === 'GET' && pathname === '/ping-lcu') {
    const ok = await pingLcu()
    return json(res, 200, { ok })
  }

  // Unfriend all friends on current League account
  if (req.method === 'POST' && pathname === '/unfriend-all') {
    try {
      const result = await unfriendAll()
      return json(res, 200, result)
    } catch (e) {
      log(`[unfriend-all] error: ${e.message}`)
      return json(res, 400, { error: e.message })
    }
  }

  // Status — for webapp scanning indicator + pending imports
  if (req.method === 'GET' && pathname === '/status') {
    return json(res, 200, { webappScanning, pendingImport: loadConfig().pendingImport || null })
  }

  // Clear pending import (called by webapp after handling)
  if (req.method === 'DELETE' && pathname === '/pending-import') {
    const cfg = loadConfig()
    delete cfg.pendingImport
    saveConfig(cfg)
    return json(res, 200, { ok: true })
  }

  // Scan (used by both webapp checker and local tool)
  if (req.method === 'POST' && pathname === '/scan') {
    if (webappScanning) return json(res, 409, { error: 'A scan is already in progress.' })
    const lf = findLockfile()
    if (!lf) return json(res, 400, { error: 'League client not running. Make sure League of Legends is open and fully loaded.' })
    const { port, password } = parseLockfile(lf)
    webappScanning = true
    try {
      const data = await runScan(port, password)
      json(res, 200, data)
    } catch (e) {
      log('Scan error: ' + e.message)
      json(res, 500, { error: e.message })
    } finally {
      webappScanning = false
    }
    return
  }

  // Riot Client status
  if (req.method === 'GET' && pathname === '/riot/status') {
    return json(res, 200, { running: !!findRCLockfile() })
  }

  // Riot auth state — returns current session type (needs_credentials / authenticated / etc)
  if (req.method === 'GET' && pathname === '/riot/auth-state') {
    const lf = findRCLockfile()
    if (!lf) return json(res, 200, { state: null })
    try {
      const { port, password: rcPass } = parseRCLockfile(lf)
      const s = await rcRequest(port, rcPass, 'GET', '/rso-auth/v1/session')
      return json(res, 200, { state: s.ok ? (s.data?.type || null) : null })
    } catch { return json(res, 200, { state: null }) }
  }

  // Riot login
  if (req.method === 'POST' && pathname === '/riot/login') {
    const body = await readBody(req)
    try {
      await riotLogin(body.username, body.password)
      log(`Riot login OK: ${body.username}`)
      return json(res, 200, { ok: true })
    } catch (e) {
      log(`Riot login FAIL (${body.username}): ${e.message}`)
      return json(res, 400, { error: e.message })
    }
  }

  // Riot logout
  if (req.method === 'POST' && pathname === '/riot/logout') {
    await riotLogout().catch(() => {})
    return json(res, 200, { ok: true })
  }

  // Launch League
  if (req.method === 'POST' && pathname === '/riot/launch-league') {
    try {
      await launchLeague()
      return json(res, 200, { ok: true })
    } catch (e) {
      return json(res, 400, { error: e.message })
    }
  }

  // League patch state (Update / Repair / Play detection)
  if (req.method === 'GET' && pathname === '/riot/league-patch-state') {
    return json(res, 200, await getLeaguePatchState())
  }

  // Close League client (kills LeagueClient + LeagueClientUx)
  if (req.method === 'POST' && pathname === '/riot/close-league') {
    exec('taskkill /F /IM LeagueClient.exe /T & taskkill /F /IM LeagueClientUx.exe /T', () => {})
    log('Close League: taskkill sent')
    return json(res, 200, { ok: true })
  }

  // Restart Riot Client (kills all Riot/League processes + relaunches RC)
  if (req.method === 'POST' && pathname === '/riot/restart-client') {
    const launched = await restartRiotClient()
    return json(res, 200, { ok: true, launched })
  }

  // SendKeys login — types credentials into the Riot Client window via PowerShell
  if (req.method === 'POST' && pathname === '/riot/sendkeys-login') {
    const body = await readBody(req)
    const { username, password } = body
    if (!username || !password) return json(res, 400, { error: 'Missing credentials' })

    // Log auth-state before firing SendKeys
    try {
      const lf = findRCLockfile()
      if (lf) {
        const { port, password: rcPass } = parseRCLockfile(lf)
        const s = await rcRequest(port, rcPass, 'GET', '/rso-auth/v1/session')
        log(`[sendkeys] PRE-FIRE auth-state: type=${s.data?.type} error=${s.data?.error} status=${s.status}`)
      } else {
        log(`[sendkeys] PRE-FIRE: no RC lockfile found`)
      }
    } catch (e) { log(`[sendkeys] PRE-FIRE auth-state check failed: ${e.message}`) }

    // Escape SendKeys special chars: + ^ % ~ ( ) { } [ ]
    const escSK = s => String(s).replace(/[+^%~(){}[\]]/g, m => '{' + m + '}')
    // Escape PowerShell single-quoted string (double up single quotes)
    const escPS = s => String(s).replace(/'/g, "''")
    const u = escPS(escSK(username))
    const p = escPS(escSK(password))
    const psLines = [
      `$w = New-Object -ComObject wscript.shell`,
      `Start-Sleep -Milliseconds 500`,
      `$w.AppActivate('Riot Client')`,
      `Start-Sleep -Milliseconds 800`,
      `$w.SendKeys('{ENTER}')`,
      `Start-Sleep -Milliseconds 2500`,
      `$w.AppActivate('Riot Client')`,
      `Start-Sleep -Milliseconds 500`,
      `$w.SendKeys('${u}')`,
      `Start-Sleep -Milliseconds 300`,
      `$w.SendKeys('{TAB}')`,
      `Start-Sleep -Milliseconds 300`,
      `$w.SendKeys('${p}')`,
      `Start-Sleep -Milliseconds 300`,
      `$w.SendKeys('{ENTER}')`,
    ].join('\r\n')
    const encoded = Buffer.from(psLines, 'utf16le').toString('base64')
    log(`[sendkeys] Firing for ${username} — total PS script: ${psLines.split('\r\n').length} lines`)
    exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, async (err) => {
      if (err) { log(`[sendkeys] PowerShell error: ${err.message}`); return }
      log(`[sendkeys] PowerShell done — polling auth-state for 10s`)
      for (let i = 1; i <= 5; i++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const lf = findRCLockfile()
          if (!lf) { log(`[sendkeys] +${i*2}s: no lockfile`); continue }
          const { port, password: rcPass } = parseRCLockfile(lf)
          const s = await rcRequest(port, rcPass, 'GET', '/rso-auth/v1/session')
          log(`[sendkeys] +${i*2}s: type=${s.data?.type} error=${s.data?.error} status=${s.status}`)
        } catch (e) { log(`[sendkeys] +${i*2}s: poll error: ${e.message}`) }
      }
    })
    return json(res, 200, { ok: true })
  }

  // Client-side debug log relay
  if (req.method === 'POST' && pathname === '/debug-log') {
    const body = await readBody(req)
    log(`[client] ${body.message || '?'}`)
    return json(res, 200, { ok: true })
  }

  // Debug logs
  if (req.method === 'GET' && pathname === '/debug-logs') return json(res, 200, { logs: [...debugLogs] })
  if (req.method === 'DELETE' && pathname === '/debug-logs') { debugLogs.length = 0; return json(res, 200, { ok: true }) }

  // Local accounts CRUD
  if (req.method === 'GET' && pathname === '/local/accounts') return json(res, 200, loadAccounts())

  if (req.method === 'POST' && pathname === '/local/accounts') {
    const body = await readBody(req)
    const accounts = loadAccounts()
    body.id = body.id || uid()
    accounts.push(body)
    saveAccounts(accounts)
    return json(res, 200, body)
  }

  const acctM = pathname.match(/^\/local\/accounts\/(.+)$/)
  if (acctM) {
    const id = acctM[1]
    if (req.method === 'PATCH') {
      const body = await readBody(req)
      const accounts = loadAccounts()
      const idx = accounts.findIndex(a => a.id === id)
      if (idx === -1) return json(res, 404, { error: 'Not found' })
      accounts[idx] = { ...accounts[idx], ...body }
      saveAccounts(accounts)
      return json(res, 200, accounts[idx])
    }
    if (req.method === 'DELETE') {
      const accounts = loadAccounts()
      saveAccounts(accounts.filter(a => a.id !== id))
      return json(res, 200, { ok: true })
    }
  }

  // Local config
  if (req.method === 'GET' && pathname === '/local/config') return json(res, 200, loadConfig())
  if (req.method === 'POST' && pathname === '/local/config') {
    const body = await readBody(req)
    saveConfig(body)
    return json(res, 200, { ok: true })
  }

  // CSR2 packs CRUD
  if (req.method === 'GET' && pathname === '/csr2/packs') {
    return json(res, 200, loadPacks())
  }

  if (req.method === 'POST' && pathname === '/csr2/packs') {
    const body = await readBody(req)
    const packs = loadPacks()
    body.id = uid()
    body.createdAt = new Date().toISOString()
    packs.push(body)
    savePacks(packs)
    return json(res, 200, body)
  }

  const packM = pathname.match(/^\/csr2\/packs\/(.+)$/)
  if (packM) {
    const id = packM[1]
    if (req.method === 'PATCH') {
      const body = await readBody(req)
      const packs = loadPacks()
      const idx = packs.findIndex(p => p.id === id)
      if (idx === -1) return json(res, 404, { error: 'Pack not found' })
      packs[idx] = { ...packs[idx], ...body }
      savePacks(packs)
      return json(res, 200, packs[idx])
    }
    if (req.method === 'DELETE') {
      const packs = loadPacks()
      savePacks(packs.filter(p => p.id !== id))
      return json(res, 200, { ok: true })
    }
  }

  // CSR2 apply-nsb
  if (req.method === 'POST' && pathname === '/csr2/apply-nsb') {
    const body = await readBody(req)
    if (!body.nsbBase64 || !body.packId) return json(res, 400, { error: 'Missing nsbBase64 or packId' })
    const packs = loadPacks()
    const pack = packs.find(p => p.id === body.packId)
    if (!pack) return json(res, 404, { error: 'Pack not found' })
    try {
      const buf = Buffer.from(body.nsbBase64, 'base64')
      const data = csr2ReadSave(buf)
      csr2ApplyPack(data, pack)
      const out = csr2WriteSave(data)
      return json(res, 200, { resultBase64: out.toString('base64') })
    } catch (e) {
      log('[csr2/apply-nsb] Error: ' + e.message)
      return json(res, 500, { error: e.message })
    }
  }

  // CSR2 unban
  if (req.method === 'POST' && pathname === '/csr2/unban') {
    const body = await readBody(req)
    if (!body.nsbBase64) return json(res, 400, { error: 'Missing nsbBase64' })
    try {
      const buf = Buffer.from(body.nsbBase64, 'base64')
      const data = csr2ReadSave(buf)
      csr2Unban(data)
      const out = csr2WriteSave(data)
      return json(res, 200, { resultBase64: out.toString('base64') })
    } catch (e) {
      log('[csr2/unban] Error: ' + e.message)
      return json(res, 500, { error: e.message })
    }
  }

  json(res, 404, { error: 'Not found' })
})

// ─── Startup ──────────────────────────────────────────────────────────────────

let lastHeartbeat = Date.now()

server.listen(PORT, '127.0.0.1', () => {
  log(`AIO Tool v${VERSION} listening on http://localhost:${PORT}`)
  const appUrl = `http://localhost:${PORT}`
  exec(`start msedge --app="${appUrl}" --window-size=1280,820`, (err) => {
    if (err) {
      log('Edge app mode failed, opening default browser: ' + err.message)
      exec(`start "" "${appUrl}"`)
    }
  })
  // Cache LCU status every 3s so /ping can return it instantly
  setInterval(async () => { try { _lcuOnline = await pingLcu() } catch { _lcuOnline = false } }, 3000)
  // Fallback: if no heartbeat or /shutdown for 60s after grace, exit (catches crash/force-close)
  setTimeout(() => {
    setInterval(() => {
      if (Date.now() - lastHeartbeat > 60000) { log('No heartbeat for 60s — shutting down'); process.exit(0) }
    }, 15000)
  }, 30000)
})

