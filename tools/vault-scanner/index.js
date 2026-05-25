const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const os = require('os')
const zlib = require('zlib')
const crypto = require('crypto')
const { exec } = require('child_process')

const PORT = 35199
const VERSION = '0.6.22'

// ─── Local Storage ────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.env.APPDATA || os.homedir(), 'aio-tool')
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json')
const CONFIG_FILE = path.join(DATA_DIR, 'config.json')
const PACKS_FILE     = path.join(DATA_DIR, 'csr2-packs.json')
const CSR2_CARS_FILE = path.join(DATA_DIR, 'csr2-cars.json')
const CSR2_SHA_FILE  = path.join(DATA_DIR, 'csr2-cars-sha.json')
const INT32_MAX = 2147483647

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
function loadPacks()    { return loadJson(PACKS_FILE, []) }
function savePacks(p)  { saveJson(PACKS_FILE, p) }
function loadCsr2Cars() { return loadJson(CSR2_CARS_FILE, []) }
function saveCsr2Cars(d) { saveJson(CSR2_CARS_FILE, d) }
function loadCsr2Sha() { return loadJson(CSR2_SHA_FILE, {}) }
function saveCsr2Sha(d) { saveJson(CSR2_SHA_FILE, d) }
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
  res.setHeader('Cache-Control', 'no-store')
  res.writeHead(200)
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { resolve({}) } })
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

// ─── GitHub Helpers ───────────────────────────────────────────────────────────

function fetchGithubApi(apiPath) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: apiPath,
      method: 'GET',
      headers: { 'User-Agent': 'aio-tool-v' + VERSION, Accept: 'application/vnd.github.v3+json' },
    }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (e) { reject(new Error('GitHub API parse error: ' + data.slice(0, 120))) }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('GitHub API timeout')) })
    req.end()
  })
}

function fetchRawGithub(rawUrl) {
  return new Promise((resolve, reject) => {
    const get = (url) => {
      https.get(url, { headers: { 'User-Agent': 'aio-tool-v' + VERSION } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) return get(res.headers.location)
        let data = ''
        res.on('data', c => data += c)
        res.on('end', () => resolve(data))
      }).on('error', reject)
    }
    get(rawUrl)
  })
}

// ─── CSR2 Save Editor ────────────────────────────────────────────────────────

function csr2ReadSave(buf) {
  let dec
  try { dec = zlib.gunzipSync(buf) } catch (e) { throw new Error('Decompress failed: ' + e.message) }
  const start = dec.indexOf(0x7B)
  const end   = dec.lastIndexOf(0x7D)
  if (start === -1 || end <= start) throw new Error('No JSON found in save file (start=' + start + ' end=' + end + ')')
  const jsonStr = dec.slice(start, end + 1).toString('utf8')
  try { return JSON.parse(jsonStr) } catch (e) {
    const m = e.message.match(/position (\d+)/)
    if (m) {
      const p = +m[1], ctx = JSON.stringify(jsonStr.slice(Math.max(0,p-15), p+15))
      throw new Error('JSON parse error at position ' + p + ' near ' + ctx)
    }
    throw e
  }
}

function csr2WriteSave(data) {
  const jsonStr = JSON.stringify(data)
  const hash = crypto.createHash('sha1').update(jsonStr, 'utf8').digest('hex')
  return zlib.gzipSync(Buffer.from(hash + '\n' + jsonStr, 'utf8'))
}

function csr2ReadSaveStats(buf) {
  const data = csr2ReadSave(buf)
  const ownedCrdbs = Array.isArray(data.caow) ? data.caow.map(c => c.crdb).filter(Boolean) : []
  return {
    cash:         Math.max(0, (data.caea || 0) - (data.casp || 0)),
    gold:         Math.max(0, (data.goea || 0) - (data.gosp || 0)),
    bronzeKeys:   Math.max(0, (data.gbke || 0) - (data.gbks || 0)),
    silverKeys:   Math.max(0, (data.gske || 0) - (data.gsks || 0)),
    goldKeys:     Math.max(0, (data.ggke || 0) - (data.ggks || 0)),
    fuel:         data.fupi  || 0,
    fusionGreen:  (data.afme && data.afme.Green)  || 0,
    fusionBlue:   (data.afme && data.afme.Blue)   || 0,
    fusionRed:    (data.afme && data.afme.Red)    || 0,
    fusionYellow: (data.afme && data.afme.Yellow) || 0,
    carCount:     Array.isArray(data.caow) ? data.caow.length : 0,
    ownedCrdbs:   ownedCrdbs,
  }
}

async function csr2ApplyPack(data, pack, selectedCars) {
  const c = pack.currencies || {}

  // Apply currencies — cash/gold reset spent to 0 and clamp to INT32_MAX
  if ('cash'       in c) { data.caea = Math.min(c.cash, INT32_MAX);       data.casp = 0 }
  if ('gold'       in c) { data.goea = Math.min(c.gold, INT32_MAX);       data.gosp = 0 }
  if ('bronzeKeys' in c) { data.gbke = c.bronzeKeys; data.gbks = 0 }
  if ('silverKeys' in c) { data.gske = c.silverKeys; data.gsks = 0 }
  if ('goldKeys'   in c) { data.ggke = c.goldKeys;   data.ggks = 0 }
  if ('fuel'       in c) data.fupi = c.fuel
  if (c.fusionGreen || c.fusionBlue || c.fusionRed || c.fusionYellow) {
    if (!data.afme) data.afme = {}
    if (!data.afms) data.afms = {}
    if (c.fusionGreen)  { data.afme.Green  = c.fusionGreen;  data.afms.Green  = 0 }
    if (c.fusionBlue)   { data.afme.Blue   = c.fusionBlue;   data.afms.Blue   = 0 }
    if (c.fusionRed)    { data.afme.Red    = c.fusionRed;    data.afms.Red    = 0 }
    if (c.fusionYellow) { data.afme.Yellow = c.fusionYellow; data.afms.Yellow = 0 }
  }

  if (pack.version) { data.prvr = pack.version; data.adpvr = pack.version }

  let note = null
  const carConfig = pack.cars
  if (carConfig && carConfig.count > 0 && Array.isArray(selectedCars) && selectedCars.length > 0) {
    if (!Array.isArray(data.caow)) data.caow = []
    if (typeof data.ncui !== 'number' || data.ncui < data.caow.length) {
      data.ncui = data.caow.length
    }

    const ownedCrdbs = new Set(data.caow.map(c => c.crdb).filter(Boolean))
    const maxed = carConfig.condition === 'maxed'
    const toAdd = selectedCars.filter(car => car.crdb && !ownedCrdbs.has(car.crdb)).slice(0, carConfig.count)

    // Fetch car JSONs in parallel batches, then assign unids sequentially
    const BATCH = 10
    const fetched = []
    for (let i = 0; i < toAdd.length; i += BATCH) {
      const batch = toAdd.slice(i, i + BATCH)
      const results = await Promise.all(batch.map(async (car) => {
        try {
          const txtUrl = maxed ? (car.maxedTxtUrl || car.stockTxtUrl) : car.stockTxtUrl
          if (!txtUrl) throw new Error('no txtUrl')
          const txt = await fetchRawGithub(txtUrl)
          return { ok: true, carJson: JSON.parse(txt), crdb: car.crdb }
        } catch (e) {
          log('[cars-add] Failed ' + (car.crdb || '?') + ': ' + e.message)
          return { ok: false, crdb: car.crdb }
        }
      }))
      fetched.push(...results)
    }

    let added = 0
    for (const r of fetched) {
      if (r.ok && !ownedCrdbs.has(r.crdb)) {
        r.carJson.unid = data.ncui
        data.ncui++
        data.caow.push(r.carJson)
        ownedCrdbs.add(r.crdb)
        added++
      }
    }

    // Rebuild garage position index — must always be [0..ncui-1, -1]
    data.cgpi = [...Array(data.ncui).keys(), -1]

    const remaining = carConfig.count - added
    if (remaining > 0) {
      note = added + ' car(s) added. ' + remaining + ' slot(s) could not be fetched from GitHub.'
    }
  }

  return { note }
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
.section-title{font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px;margin-top:4px}
.field label{display:flex;align-items:center;gap:5px}
.token-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;display:inline-block}
.field-wrap{position:relative}
.field-wrap input{padding-right:36px}
.field-unit{position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--muted);pointer-events:none}
.game-icon{width:18px;height:18px;border-radius:4px;object-fit:cover;flex-shrink:0;background:var(--surf2)}
.game-icon-init{width:18px;height:18px;border-radius:4px;background:var(--accent);display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;flex-shrink:0;vertical-align:middle}
.card-game-img{width:100%;height:100%;object-fit:cover;display:block}
.pack-card-hdr{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.pack-card-hdr .game-icon,.pack-card-hdr .game-icon-init{width:22px;height:22px;border-radius:5px}
.pack-card-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.pack-card-meta{font-size:11px;color:var(--muted);display:flex;flex-direction:column;gap:3px}
.pack-meta-row{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.pack-meta-row .token-dot{margin-right:1px}
.ansb-outer{padding:0;overflow:hidden;display:flex;width:auto;max-width:520px;transition:max-width .25s}
.ansb-outer.has-cars{max-width:860px}
.ansb-left-pane{flex:1;min-width:0;padding:24px;overflow-y:auto;max-height:85vh;box-sizing:border-box;display:flex;flex-direction:column;gap:14px}
.ansb-right-pane{width:280px;border-left:1px solid var(--border);display:none;flex-direction:column;padding:20px;gap:10px;max-height:85vh;overflow-y:auto;box-sizing:border-box}
.ansb-outer.has-cars .ansb-right-pane{display:flex}
.pack-stat-grid{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0}
.pack-stat-chip{background:var(--surf2);border:1px solid var(--border);border-radius:8px;padding:7px 12px;min-width:68px}
.pack-stat-chip .psc-val{font-size:15px;font-weight:600;color:var(--text);display:block}
.pack-stat-chip .psc-lbl{font-size:10px;color:var(--muted);margin-top:2px;display:block;text-transform:uppercase;letter-spacing:.5px}
.compare-table{width:100%;font-size:12px;border-collapse:collapse}
.compare-table th{text-align:left;color:var(--muted);font-weight:500;padding:4px 6px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border)}
.compare-table td{padding:6px 6px;border-bottom:1px solid rgba(255,255,255,.05)}
.comp-label{color:var(--muted);display:flex;align-items:center;gap:5px}
.comp-delta{color:var(--accent);text-align:right;font-size:11px;padding-right:8px}
.comp-arrow{text-align:right;white-space:nowrap}
.comp-curr{color:var(--muted)}
.comp-arrow-sym{color:var(--border);margin:0 5px}
.comp-after{color:#4caf50;font-weight:600}
.car-search-wrap{position:relative;margin-bottom:2px}
.car-search-input{width:100%;background:var(--surf2);border:1px solid var(--border);border-radius:8px;padding:8px 12px 8px 30px;color:var(--text);font-size:13px;outline:none;box-sizing:border-box}
.car-search-input:focus{border-color:var(--accent)}
.car-search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none}
.car-result-list{border:1px solid var(--border);border-radius:8px;background:var(--surf2);overflow:hidden;margin-top:4px}
.car-result-item{display:flex;align-items:center;gap:8px;padding:7px 10px;font-size:12px}
.car-result-item:not(:last-child){border-bottom:1px solid rgba(255,255,255,.05)}
.car-tier-badge{font-size:10px;background:var(--surf);border:1px solid var(--border);padding:1px 5px;border-radius:4px;color:var(--muted);flex-shrink:0}
.car-result-add{background:var(--accent);border:none;color:#fff;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:11px;margin-left:auto;flex-shrink:0}
.car-result-add:hover{opacity:.8}
.car-result-added{font-size:11px;color:var(--muted);margin-left:auto;flex-shrink:0}
.selected-car-item{display:flex;align-items:center;gap:8px;padding:7px 8px;background:var(--surf2);border:1px solid var(--border);border-radius:6px;font-size:12px}
.selected-car-remove{background:none;border:none;color:var(--muted);cursor:pointer;font-size:17px;padding:0;line-height:1;margin-left:auto;flex-shrink:0}
.selected-car-remove:hover{color:var(--text)}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--muted)}
.pack-sect{background:var(--surf2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:10px}
.pack-sect-hdr{font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.car-filter-bar{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px}
.car-filter-chip{background:var(--surf2);border:1px solid var(--border);border-radius:20px;padding:3px 9px;font-size:11px;cursor:pointer;transition:background .15s,color .15s,border-color .15s;white-space:nowrap;color:var(--muted)}
.car-filter-chip.active{background:var(--accent);border-color:var(--accent);color:#fff}
.ensb-row{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surf2);border:1px solid var(--border);border-radius:8px}
.ensb-label{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);flex:1}
.ensb-input{width:100px;background:var(--surf);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text);font-size:13px;outline:none;text-align:right}
.ensb-input:focus{border-color:var(--accent)}
.ensb-after{font-size:13px;color:#4caf50;font-weight:600;min-width:90px;text-align:right}
.result-icon{font-size:46px;text-align:center;margin:4px 0 10px}
.result-title{font-size:18px;font-weight:700;text-align:center;margin-bottom:6px}
.result-desc{font-size:13px;color:var(--muted);text-align:center;line-height:1.6;max-width:320px;margin:0 auto}
.confirm-desc{font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:16px}
.cars-remaining-note{margin-top:auto;padding-top:12px;border-top:1px solid var(--border);font-size:11px;color:var(--muted);line-height:1.5}
.color-swatches-grid{display:flex;flex-wrap:wrap;gap:8px;max-height:340px;overflow-y:auto;padding-right:2px}
.color-swatch{width:120px;background:var(--surf2);border:2px solid var(--border);border-radius:8px;overflow:hidden;cursor:pointer;transition:border-color .15s,transform .1s;flex-shrink:0}
.color-swatch:hover{border-color:var(--accent);transform:scale(1.03)}
.color-swatch img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:var(--surf)}
.color-swatch-name{padding:4px 6px 6px;font-size:11px;text-align:center;color:var(--text);line-height:1.3}
.color-swatch.loading{opacity:.5;pointer-events:none}
.selected-car-photo{width:44px;height:30px;object-fit:cover;border-radius:4px;background:var(--surf2);flex-shrink:0}
.selected-car-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.selected-car-info .scar-name{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.selected-car-info .scar-color{font-size:10px;color:var(--muted)}
.cars-update-bar{background:var(--surf2);border-radius:4px;height:6px;margin:10px 0;overflow:hidden}
.cars-update-bar-fill{background:var(--accent);height:100%;width:0%;transition:width .4s}
.allow-dup-row{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;color:var(--muted);cursor:pointer}
.allow-dup-row input{cursor:pointer}
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
        <button class="btn btn-sm" onclick="openUnban()" style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);color:#ef4444">🚫 Unban</button>
        <button class="btn btn-secondary btn-sm" id="cars-update-btn" onclick="openCarsUpdate()">↺ Car DB <span id="cars-db-count" style="font-size:10px;opacity:.6"></span></button>
        <button class="btn btn-secondary btn-sm" onclick="openCsr2Settings()">⚙ Settings</button>
        <button class="btn btn-secondary btn-sm" onclick="openEditNsbManual()">Edit NSB</button>
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
  <div class="modal" style="max-width:520px">
    <div class="modal-title" id="cp-title-label">Create Pack</div>
    <div class="field" style="margin-bottom:14px">
      <label>Pack Name</label>
      <input type="text" id="cp-name" placeholder="e.g. Starter Pack">
    </div>
    <div class="pack-sect">
      <div class="pack-sect-hdr">💰 Currencies</div>
      <div class="curr-grid">
        <div class="field"><label>💵 Cash</label><div class="field-wrap"><input type="number" id="cp-cash" placeholder="0" min="0"><span class="field-unit">$</span></div></div>
        <div class="field"><label>🪙 Gold</label><div class="field-wrap"><input type="number" id="cp-gold" placeholder="0" min="0"><span class="field-unit">G</span></div></div>
        <div class="field"><label>🔑 Bronze Keys</label><div class="field-wrap"><input type="number" id="cp-bkeys" placeholder="0" min="0"><span class="field-unit">Bk</span></div></div>
        <div class="field"><label>🗝️ Silver Keys</label><div class="field-wrap"><input type="number" id="cp-skeys" placeholder="0" min="0"><span class="field-unit">Sk</span></div></div>
        <div class="field"><label>✨ Gold Keys</label><div class="field-wrap"><input type="number" id="cp-gkeys" placeholder="0" min="0"><span class="field-unit">Gk</span></div></div>
        <div class="field"><label>⛽ Fuel</label><div class="field-wrap"><input type="number" id="cp-fuel" placeholder="0" min="0"><span class="field-unit">F</span></div></div>
      </div>
    </div>
    <div class="pack-sect">
      <div class="pack-sect-hdr">⚗️ Fusion Tokens</div>
      <div class="curr-grid">
        <div class="field"><label><span class="token-dot" style="background:#4caf50"></span>Green</label><div class="field-wrap"><input type="number" id="cp-fgreen" placeholder="0" min="0"><span class="field-unit">Tk</span></div></div>
        <div class="field"><label><span class="token-dot" style="background:#2196F3"></span>Blue</label><div class="field-wrap"><input type="number" id="cp-fblue" placeholder="0" min="0"><span class="field-unit">Tk</span></div></div>
        <div class="field"><label><span class="token-dot" style="background:#e05252"></span>Red</label><div class="field-wrap"><input type="number" id="cp-fred" placeholder="0" min="0"><span class="field-unit">Tk</span></div></div>
        <div class="field"><label><span class="token-dot" style="background:#FFC107"></span>Yellow</label><div class="field-wrap"><input type="number" id="cp-fyellow" placeholder="0" min="0"><span class="field-unit">Tk</span></div></div>
      </div>
    </div>
    <div class="pack-sect" style="padding:12px 16px">
      <div style="display:flex;align-items:center;gap:10px">
        <label class="toggle"><input type="checkbox" id="cp-cars-toggle" onchange="toggleCarsSection()"><span class="tslider"></span></label>
        <span style="font-size:13px;font-weight:500">🚗 Add Cars</span>
      </div>
      <div id="cp-cars-section" style="display:none;margin-top:12px;border-top:1px solid var(--border);padding-top:12px">
        <div class="curr-grid" style="margin-bottom:10px">
          <div class="field"><label>Count</label><input type="number" id="cp-car-count" placeholder="e.g. 60" min="1"></div>
          <div class="field"><label>Condition</label><select id="cp-car-condition"><option value="stock">Stock</option><option value="maxed">Maxed</option></select></div>
        </div>
        <div class="field" style="margin-bottom:0">
          <label>Selection Mode</label>
          <select id="cp-car-mode">
            <option value="random">Random (auto-picked, no duplicates)</option>
            <option value="customizable">Customizable (buyer picks)</option>
            <option value="all">All available (everything not owned)</option>
          </select>
        </div>
      </div>
    </div>
    <div class="pack-sect" style="padding:12px 16px">
      <div style="display:flex;align-items:center;gap:10px">
        <label class="toggle"><input type="checkbox" id="cp-ver-toggle" onchange="toggleVersionSection()"><span class="tslider"></span></label>
        <span style="font-size:13px;font-weight:500">🔖 Version Override</span>
      </div>
      <div id="cp-ver-section" style="display:none;margin-top:12px;border-top:1px solid var(--border);padding-top:12px">
        <div class="field" style="margin-bottom:0">
          <label>Game Version</label>
          <input type="text" id="cp-version" placeholder="e.g. 6.3.0">
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px">Sets prvr &amp; adpvr in the save file</div>
      </div>
    </div>
    <div id="cp-notice" style="display:none"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="hideModal('create-pack-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="savePack()" id="cp-save-btn">Save Pack</button>
    </div>
  </div>
</div>

<!-- Delete Pack Confirm Modal -->
<div class="modal-bg" id="delete-pack-modal">
  <div class="modal" style="max-width:400px">
    <div class="modal-title">Delete Pack?</div>
    <p class="confirm-desc">This will permanently delete <strong id="del-pack-name"></strong>. This cannot be undone.</p>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="hideModal('delete-pack-modal')">Cancel</button>
      <button class="btn btn-danger" id="del-pack-confirm-btn" onclick="confirmDeletePack()">Delete</button>
    </div>
  </div>
</div>

<!-- Apply Result Modal -->
<div class="modal-bg" id="apply-result-modal">
  <div class="modal" style="max-width:360px;text-align:center">
    <div class="result-icon" id="apply-result-icon">✅</div>
    <div class="result-title" id="apply-result-title">Pack Applied!</div>
    <div class="result-desc" id="apply-result-desc">The modified save file has been downloaded.</div>
    <div class="modal-actions" style="justify-content:center;margin-top:18px">
      <button class="btn btn-primary" onclick="hideModal('apply-result-modal');hideModal('apply-nsb-modal')">Done</button>
    </div>
  </div>
</div>

<!-- Unban Confirm Modal -->
<div class="modal-bg" id="unban-confirm-modal">
  <div class="modal" style="max-width:400px">
    <div class="modal-title">Apply Unban?</div>
    <p class="confirm-desc">This will apply ban-reversal fixes to the loaded NSB file and download the modified save. Continue?</p>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="hideModal('unban-confirm-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="confirmApplyUnban()">Unban &amp; Download</button>
    </div>
  </div>
</div>

<!-- NSB Output Folder Conflict Modal -->
<div class="modal-bg" id="nsb-conflict-modal">
  <div class="modal" style="max-width:420px">
    <div class="modal-title">⚠️ File Already Exists</div>
    <p class="confirm-desc">The output folder already contains an NSB file (<strong id="nsb-conflict-name"></strong>). Continuing will delete the existing file before saving the new one.</p>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="hideModal('nsb-conflict-modal')">Keep Existing</button>
      <button class="btn btn-danger" id="nsb-conflict-confirm" onclick="confirmSaveToFolder()">Delete &amp; Save</button>
    </div>
  </div>
</div>

<!-- CSR2 Settings Modal -->
<div class="modal-bg" id="csr2-settings-modal">
  <div class="modal" style="max-width:460px">
    <div class="modal-title">⚙ CSR2 Settings</div>
    <div class="modal-sub">Configure where modified NSB files are saved</div>
    <div class="field">
      <label>Output Folder Path</label>
      <input type="text" id="csr2-folder-input" placeholder="e.g. C:\Users\You\Documents\CSR2">
    </div>
    <div style="font-size:11px;color:var(--muted);margin-top:-8px;margin-bottom:14px">Leave empty to only download (no auto-save). Files in the folder are replaced on each apply.</div>
    <div id="csr2-settings-notice" style="display:none"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="hideModal('csr2-settings-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="saveCsr2Settings()">Save</button>
    </div>
  </div>
</div>

<!-- Edit NSB Manual Modal -->
<div class="modal-bg" id="edit-nsb-modal">
  <div class="modal" style="max-width:520px">
    <div class="modal-title">Edit NSB</div>
    <div class="modal-sub">Load a save file to edit values manually or apply unban</div>
    <div class="field">
      <label>NSB File</label>
      <div class="file-drop" id="ensb-drop" onclick="document.getElementById('ensb-file').click()" ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="handleNsbDrop(event,'ensb')">
        <input type="file" id="ensb-file" style="display:none" onchange="handleNsbFile(event,'ensb')">
        <div class="file-drop-label">Click to select or drag &amp; drop your NSB file</div>
        <div class="file-drop-name" id="ensb-file-name" style="display:none"></div>
      </div>
    </div>
    <div id="ensb-form" style="display:none">
      <div class="pack-sect-hdr" style="margin-bottom:8px">➕ Add to Account</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
        <div class="ensb-row"><span class="ensb-label">💵 Cash</span><input type="number" class="ensb-input" id="ensb-cash" value="0" min="0" oninput="updateEnsbAfter()"><span class="ensb-after" id="ensb-cash-after">—</span></div>
        <div class="ensb-row"><span class="ensb-label">🪙 Gold</span><input type="number" class="ensb-input" id="ensb-gold" value="0" min="0" oninput="updateEnsbAfter()"><span class="ensb-after" id="ensb-gold-after">—</span></div>
        <div class="ensb-row"><span class="ensb-label">🔑 Bronze Keys</span><input type="number" class="ensb-input" id="ensb-bkeys" value="0" min="0" oninput="updateEnsbAfter()"><span class="ensb-after" id="ensb-bkeys-after">—</span></div>
        <div class="ensb-row"><span class="ensb-label">🗝️ Silver Keys</span><input type="number" class="ensb-input" id="ensb-skeys" value="0" min="0" oninput="updateEnsbAfter()"><span class="ensb-after" id="ensb-skeys-after">—</span></div>
        <div class="ensb-row"><span class="ensb-label">✨ Gold Keys</span><input type="number" class="ensb-input" id="ensb-gkeys" value="0" min="0" oninput="updateEnsbAfter()"><span class="ensb-after" id="ensb-gkeys-after">—</span></div>
        <div class="ensb-row"><span class="ensb-label">⛽ Fuel</span><input type="number" class="ensb-input" id="ensb-fuel" value="0" min="0" oninput="updateEnsbAfter()"><span class="ensb-after" id="ensb-fuel-after">—</span></div>
        <div class="ensb-row"><span class="ensb-label"><span class="token-dot" style="background:#4caf50"></span>Green Tk</span><input type="number" class="ensb-input" id="ensb-fgreen" value="0" min="0" oninput="updateEnsbAfter()"><span class="ensb-after" id="ensb-fgreen-after">—</span></div>
        <div class="ensb-row"><span class="ensb-label"><span class="token-dot" style="background:#2196F3"></span>Blue Tk</span><input type="number" class="ensb-input" id="ensb-fblue" value="0" min="0" oninput="updateEnsbAfter()"><span class="ensb-after" id="ensb-fblue-after">—</span></div>
        <div class="ensb-row"><span class="ensb-label"><span class="token-dot" style="background:#e05252"></span>Red Tk</span><input type="number" class="ensb-input" id="ensb-fred" value="0" min="0" oninput="updateEnsbAfter()"><span class="ensb-after" id="ensb-fred-after">—</span></div>
        <div class="ensb-row"><span class="ensb-label"><span class="token-dot" style="background:#FFC107"></span>Yellow Tk</span><input type="number" class="ensb-input" id="ensb-fyellow" value="0" min="0" oninput="updateEnsbAfter()"><span class="ensb-after" id="ensb-fyellow-after">—</span></div>
      </div>
    </div>
    <div id="ensb-notice" style="display:none"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="hideModal('edit-nsb-modal')">Cancel</button>
      <button class="btn btn-secondary" id="ensb-unban-btn" onclick="showModal('unban-confirm-modal')" disabled style="background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.4);color:#ef4444">🚫 Unban</button>
      <button class="btn btn-primary" id="ensb-apply-btn" onclick="applyManualEdit()" disabled>Apply &amp; Download</button>
    </div>
  </div>
</div>

<!-- Apply NSB Modal -->
<div class="modal-bg" id="apply-nsb-modal">
  <div class="modal ansb-outer" id="ansb-outer">
    <!-- Left pane -->
    <div class="ansb-left-pane">
      <div class="modal-title" style="margin-bottom:0">Apply Pack</div>
      <div id="ansb-pack-info"></div>
      <div class="field" id="ansb-pack-select-row" style="display:none;margin-bottom:0">
        <label>Pack</label>
        <select id="ansb-pack-select"></select>
      </div>
      <div class="field" style="margin-bottom:0">
        <label>NSB File</label>
        <div class="file-drop" id="ansb-drop" onclick="document.getElementById('ansb-file').click()" ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="handleNsbDrop(event,'ansb')">
          <input type="file" id="ansb-file" style="display:none" onchange="handleNsbFile(event,'ansb')">
          <div class="file-drop-label">Click to select or drag & drop your NSB file</div>
          <div class="file-drop-name" id="ansb-file-name" style="display:none"></div>
        </div>
      </div>
      <div id="ansb-compare" style="display:none">
        <div class="section-title" style="margin-bottom:6px">Account Preview</div>
        <div id="ansb-compare-box"></div>
      </div>
      <div id="ansb-car-section" style="display:none">
        <div class="section-title" style="margin-bottom:8px">Select Cars <span id="ansb-car-count-badge" style="font-weight:400;color:var(--muted);text-transform:none;font-size:11px;letter-spacing:0">(0 selected)</span></div>
        <div id="ansb-car-locked" style="font-size:12px;color:var(--muted);padding:10px 0;display:none">📂 Please upload NSB file first to enable car selection.</div>
        <div id="ansb-car-controls" style="display:none">
          <label class="allow-dup-row"><input type="checkbox" id="ansb-allow-dup" onchange="toggleAllowDuplicates()"> Allow Duplicates (show owned cars)</label>
          <div class="car-filter-bar" id="ansb-tier-filters"></div>
          <div class="car-filter-bar" id="ansb-star-filters"></div>
          <div class="car-filter-bar" id="ansb-brand-filters" style="max-height:48px;overflow:hidden" id="ansb-brand-filters"></div>
          <div class="car-search-wrap" style="margin-top:4px">
            <span class="car-search-icon" style="font-size:13px;top:50%;transform:translateY(-50%);left:10px">🔍</span>
            <input type="text" class="car-search-input" id="ansb-car-search" placeholder="Search by name or brand..." oninput="searchCars(this.value)">
          </div>
          <div id="ansb-car-results"></div>
        </div>
      </div>
      <div id="ansb-notice" style="display:none"></div>
      <div class="modal-actions" style="margin-top:0">
        <button class="btn btn-secondary" onclick="hideModal('apply-nsb-modal')">Cancel</button>
        <button class="btn btn-primary" id="ansb-apply-btn" onclick="applyNsb()" disabled>Apply & Download</button>
      </div>
    </div>
    <!-- Right pane: selected cars -->
    <div class="ansb-right-pane" id="ansb-cars-pane">
      <div style="font-weight:600;font-size:14px">Selected Cars</div>
      <div id="ansb-selected-count" style="font-size:12px;color:var(--muted);margin-top:-4px">0 cars selected</div>
      <div id="ansb-selected-cars-list" style="flex:1;display:flex;flex-direction:column;gap:6px;overflow-y:auto"></div>
      <div class="cars-remaining-note" id="ansb-cars-remaining-note" style="display:none"></div>
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

<!-- Color Picker Modal -->
<div class="modal-bg" id="color-picker-modal">
  <div class="modal" style="max-width:600px">
    <div class="modal-title" id="cp2-car-name">Select Color</div>
    <div class="modal-sub" id="cp2-car-sub">Choose a paint color to add this car</div>
    <div class="color-swatches-grid" id="cp2-colors-grid"></div>
    <div id="cp2-notice" style="display:none;margin-top:10px"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="hideModal('color-picker-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- Car DB Update Modal -->
<div class="modal-bg" id="cars-update-modal">
  <div class="modal" style="max-width:420px">
    <div class="modal-title">Car Database</div>
    <div id="cars-update-status" style="font-size:13px;color:var(--muted);margin:8px 0 4px">Checking for updates...</div>
    <div class="cars-update-bar"><div class="cars-update-bar-fill" id="cars-update-bar-fill"></div></div>
    <div id="cars-update-info" style="font-size:12px;color:var(--muted);margin-bottom:4px"></div>
    <div id="cars-update-notice" style="display:none"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="hideModal('cars-update-modal')" id="cars-update-close-btn">Cancel</button>
      <button class="btn btn-primary" onclick="doCarsUpdate()" id="cars-update-go-btn" style="display:none">Update Now</button>
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
var _packs = [], _nsbData = { ansb: null, unban: null, ensb: null }, _selectedCars = []
var _editingPackId = null, _deletingPackId = null
var _carFilter = { tier: null, brand: null, starType: null }
var _csr2OutputFolder = '', _ensbCurrent = {}, _pendingSavePack = null
var _selMode = false, _selected = new Set()
var _debugOpen = false, _pollInterval = null
var _scanAbort = false, _multiAbort = false, _multiRunId = 0
var _previewAcct = null, _importAcct = null, _afterImportId = null
var _csr2CarsDb = [], _ownedCrdbs = new Set(), _allowDuplicates = false
var _colorPickerCar = null, _colorPickerCarIdx = -1, _selectingColor = false

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  var cfg = await apiFetch('/local/config', {}).catch(function(){ return {} })
  _url = (cfg.webappUrl || '').replace(/\\/$/, '')
  _csr2OutputFolder = cfg.csr2OutputFolder || ''
  await fetchGames()
  await reloadAccounts()
  await reloadPacks()
  // Load car database
  var carsData = await apiFetch('/csr2/cars', null).catch(function(){ return null })
  _csr2CarsDb = Array.isArray(carsData) ? carsData : []
  updateCarDbCountBadge()
  renderView()
  startPoll()
  // Silently check for car DB updates after UI is ready
  setTimeout(checkCsr2CarsUpdate, 3000)
}

function updateCarDbCountBadge() {
  var el = document.getElementById('cars-db-count')
  if (el) el.textContent = _csr2CarsDb.length ? '(' + _csr2CarsDb.length + ')' : '(empty)'
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
    html += '<div class="sidebar-cat-hdr" data-key="' + cat.key + '" onclick="toggleCat(this.dataset.key)">'
    html += '<span>' + cat.label + '</span>'
    html += '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>'
    html += '</div><div class="sidebar-cat-items">'
    for (var gi = 0; gi < games.length; gi++) {
      var g = games[gi]
      var isActive = _activeGame && _activeGame.id === g.id && _activeSection === cat.key
      html += '<div class="sidebar-item' + (isActive ? ' active' : '') + '" data-gid="' + escH(g.id) + '" data-sec="' + cat.key + '" onclick="pickGame(this.dataset.gid,this.dataset.sec)">'
      html += gameIconHtml(g, 18) + escH(g.name || g.id) + '</div>'
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
    var thumbInner = (_activeGame && _activeGame.image)
      ? '<img src="' + escH(_activeGame.image) + '" class="card-game-img">'
      : '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3a4050" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>'
    html += '<div class="card' + (isSel ? ' sel' : '') + '" id="c-' + a.id + '">' +
      (_selMode ? '<div class="chk' + (isSel ? ' on' : '') + '" data-id="' + a.id + '" onclick="toggleSel(this.dataset.id,event)">' +
        (isSel ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '') +
        '</div>' : '') +
      '<div class="card-thumb">' + thumbInner + '</div>' +
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

function gameIconHtml(g, size) {
  size = size || 18
  var st = 'width:' + size + 'px;height:' + size + 'px;'
  if (g && g.image) return '<img src="' + escH(g.image) + '" class="game-icon" style="' + st + '">'
  var init = g && g.name ? g.name[0].toUpperCase() : '?'
  return '<span class="game-icon-init" style="' + st + '">' + escH(init) + '</span>'
}

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
  var thumb = (_activeGame && _activeGame.image)
    ? '<img src="' + escH(_activeGame.image) + '" class="card-game-img">'
    : '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3a4050" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6M12 9v6"/></svg>'
  var html = ''
  for (var i = 0; i < _packs.length; i++) {
    var p = _packs[i]
    html += '<div class="card" id="pk-' + p.id + '" data-pid="' + p.id + '">'
    html += '<div class="card-thumb">' + thumb + '</div>'
    html += '<div class="card-body"><div class="card-name">' + escH(p.name || 'Unnamed Pack') + '</div></div>'
    html += '<div class="card-overlay">'
    html += '<button class="ov-btn ov-import" data-pid="' + p.id + '" onclick="openEditNsb(this.dataset.pid)">Apply Pack</button>'
    html += '<button class="ov-btn ov-remove" data-pid="' + p.id + '" onclick="deletePack(event,this.dataset.pid)">Delete</button>'
    html += '</div></div>'
  }
  grid.innerHTML = html
}

function fmtN(n) {
  if (!n) return '0'
  if (n >= 1e6) return (n/1e6).toFixed(1).replace(/\.0$/,'') + 'M'
  if (n >= 1e3) return (n/1e3).toFixed(1).replace(/\.0$/,'') + 'K'
  return String(n)
}

function buildPackMeta(p) {
  var rows = []
  var c = p.currencies || {}
  var parts = []
  if (c.cash)       parts.push(fmtN(c.cash) + ' Cash')
  if (c.gold)       parts.push(fmtN(c.gold) + ' Gold')
  if (c.bronzeKeys) parts.push(fmtN(c.bronzeKeys) + ' Bk')
  if (c.silverKeys) parts.push(fmtN(c.silverKeys) + ' Sk')
  if (c.goldKeys)   parts.push(fmtN(c.goldKeys) + ' Gk')
  if (c.fuel)       parts.push(fmtN(c.fuel) + ' Fuel')
  if (parts.length) rows.push('<div class="pack-meta-row">' + parts.map(function(t){ return '<span>' + escH(t) + '</span>' }).join('<span style="color:var(--border)">·</span>') + '</div>')
  var fusion = []
  if (c.fusionGreen)  fusion.push('<span class="token-dot" style="background:#4caf50"></span>' + fmtN(c.fusionGreen))
  if (c.fusionBlue)   fusion.push('<span class="token-dot" style="background:#2196F3"></span>' + fmtN(c.fusionBlue))
  if (c.fusionRed)    fusion.push('<span class="token-dot" style="background:#e05252"></span>' + fmtN(c.fusionRed))
  if (c.fusionYellow) fusion.push('<span class="token-dot" style="background:#FFC107"></span>' + fmtN(c.fusionYellow))
  if (fusion.length) rows.push('<div class="pack-meta-row">' + fusion.join('') + '</div>')
  if (p.cars && p.cars.carMode) {
    rows.push('<div class="pack-meta-row"><span>' + escH(fmtN(p.cars.count) + ' cars · ' + p.cars.carMode + (p.cars.condition === 'maxed' ? ' · Maxed' : '')) + '</span></div>')
  }
  return rows.length ? rows : ['<div class="pack-meta-row"><span>No modifiers</span></div>']
}

function deletePack(e, id) {
  e.stopPropagation()
  _deletingPackId = id
  var pack = _packs.find(function(p){ return p.id === id })
  document.getElementById('del-pack-name').textContent = pack ? (pack.name || 'this pack') : 'this pack'
  showModal('delete-pack-modal')
}

async function confirmDeletePack() {
  if (!_deletingPackId) return
  hideModal('delete-pack-modal')
  await fetch('/csr2/packs/' + _deletingPackId, { method: 'DELETE' }).catch(function(){})
  _deletingPackId = null
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
  document.getElementById('cp-fgreen').value = ''
  document.getElementById('cp-fblue').value = ''
  document.getElementById('cp-fred').value = ''
  document.getElementById('cp-fyellow').value = ''
  document.getElementById('cp-cars-toggle').checked = false
  document.getElementById('cp-cars-section').style.display = 'none'
  document.getElementById('cp-car-count').value = ''
  document.getElementById('cp-car-condition').value = 'stock'
  document.getElementById('cp-car-mode').value = 'random'
  document.getElementById('cp-ver-toggle').checked = false
  document.getElementById('cp-ver-section').style.display = 'none'
  document.getElementById('cp-version').value = ''
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
  var fuel    = parseInt(document.getElementById('cp-fuel').value)    || 0
  var fgreen  = parseInt(document.getElementById('cp-fgreen').value)  || 0
  var fblue   = parseInt(document.getElementById('cp-fblue').value)   || 0
  var fred    = parseInt(document.getElementById('cp-fred').value)    || 0
  var fyellow = parseInt(document.getElementById('cp-fyellow').value) || 0
  if (cash)    currencies.cash = cash
  if (gold)    currencies.gold = gold
  if (bkeys)   currencies.bronzeKeys = bkeys
  if (skeys)   currencies.silverKeys = skeys
  if (gkeys)   currencies.goldKeys = gkeys
  if (fuel)    currencies.fuel = fuel
  if (fgreen)  currencies.fusionGreen = fgreen
  if (fblue)   currencies.fusionBlue = fblue
  if (fred)    currencies.fusionRed = fred
  if (fyellow) currencies.fusionYellow = fyellow
  var carsOn = document.getElementById('cp-cars-toggle').checked
  var cars = carsOn ? {
    count: parseInt(document.getElementById('cp-car-count').value) || 0,
    condition: document.getElementById('cp-car-condition').value,
    carMode: document.getElementById('cp-car-mode').value,
  } : null
  var version = document.getElementById('cp-ver-toggle').checked ? (document.getElementById('cp-version').value.trim() || null) : null
  var pack = { name, currencies, cars, version: version || undefined }
  var url = _editingPackId ? '/csr2/packs/' + _editingPackId : '/csr2/packs'
  var method = _editingPackId ? 'PATCH' : 'POST'
  var res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pack) }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (res.error) { showNotice('cp-notice', 'error', res.error); return }
  hideModal('create-pack-modal')
  await reloadPacks()
  renderPacks()
}

// ─── Apply NSB Modal + Car DB ──────────────────────────────────────────────────

async function openCarsUpdate() {
  document.getElementById('cars-update-status').textContent = 'Checking GitHub for updates...'
  document.getElementById('cars-update-info').textContent = ''
  document.getElementById('cars-update-bar-fill').style.width = '0%'
  document.getElementById('cars-update-go-btn').style.display = 'none'
  document.getElementById('cars-update-close-btn').textContent = 'Close'
  hideNotice('cars-update-notice')
  showModal('cars-update-modal')
  try {
    var res = await fetch('/csr2/cars-check').then(function(r){ return r.json() })
    if (res.error) {
      document.getElementById('cars-update-status').textContent = 'Could not reach GitHub.'
      document.getElementById('cars-update-info').textContent = res.error
      return
    }
    var count = res.carCount || 0
    if (count === 0) {
      document.getElementById('cars-update-status').textContent = 'Car database is empty.'
      document.getElementById('cars-update-info').textContent = 'Download the full car list from GitHub to enable the car picker.'
    } else if (res.hasUpdate) {
      document.getElementById('cars-update-status').textContent = 'Update available!'
      document.getElementById('cars-update-info').textContent = 'Current: ' + count + ' cars. A newer version is available on GitHub.'
    } else {
      document.getElementById('cars-update-status').textContent = 'Car database is up to date.'
      document.getElementById('cars-update-info').textContent = count + ' cars loaded.'
    }
    document.getElementById('cars-update-go-btn').style.display = (count === 0 || res.hasUpdate) ? '' : 'none'
  } catch (e) {
    document.getElementById('cars-update-status').textContent = 'Check failed: ' + e.message
  }
}

async function doCarsUpdate() {
  document.getElementById('cars-update-go-btn').style.display = 'none'
  document.getElementById('cars-update-close-btn').textContent = 'Cancel'
  document.getElementById('cars-update-status').textContent = 'Downloading car database from GitHub...'
  document.getElementById('cars-update-bar-fill').style.width = '30%'
  hideNotice('cars-update-notice')
  try {
    var res = await fetch('/csr2/cars-update', { method: 'POST' }).then(function(r){ return r.json() })
    if (res.error) { showNotice('cars-update-notice', 'error', res.error); document.getElementById('cars-update-close-btn').textContent = 'Close'; return }
    document.getElementById('cars-update-bar-fill').style.width = '100%'
    document.getElementById('cars-update-status').textContent = 'Done! ' + res.count + ' cars loaded.'
    document.getElementById('cars-update-close-btn').textContent = 'Close'
    // Reload car DB
    var carsData = await fetch('/csr2/cars').then(function(r){ return r.json() }).catch(function(){ return [] })
    _csr2CarsDb = Array.isArray(carsData) ? carsData : []
    updateCarDbCountBadge()
    showNotice('cars-update-notice', 'success', res.count + ' cars ready.')
  } catch (e) {
    showNotice('cars-update-notice', 'error', 'Update failed: ' + e.message)
    document.getElementById('cars-update-close-btn').textContent = 'Close'
  }
}

async function checkCsr2CarsUpdate() {
  if (_csr2CarsDb.length === 0) return  // already empty — user will notice the badge
  try {
    var res = await fetch('/csr2/cars-check').then(function(r){ return r.json() })
    if (res.hasUpdate) {
      var btn = document.getElementById('cars-update-btn')
      if (btn) btn.style.borderColor = 'var(--accent)'
    }
  } catch {}
}

function openEditNsb(packId) {
  _nsbData.ansb = null
  _selectedCars = []
  _carFilter = { tier: null, brand: null, starType: null }
  _ownedCrdbs = new Set()
  _allowDuplicates = false
  document.getElementById('ansb-file-name').style.display = 'none'
  document.getElementById('ansb-compare').style.display = 'none'
  document.getElementById('ansb-apply-btn').disabled = true
  document.getElementById('ansb-drop').classList.remove('over')
  document.getElementById('ansb-car-search').value = ''
  document.getElementById('ansb-car-results').innerHTML = ''
  var dupChk = document.getElementById('ansb-allow-dup')
  if (dupChk) dupChk.checked = false
  hideNotice('ansb-notice')
  renderSelectedCars()

  var pack = null
  if (!packId) {
    var sel = document.getElementById('ansb-pack-select')
    sel.innerHTML = _packs.map(function(p){ return '<option value="' + escH(p.id) + '">' + escH(p.name || 'Unnamed') + '</option>' }).join('')
    delete sel.dataset.forcedId
    document.getElementById('ansb-pack-select-row').style.display = ''
    pack = _packs[0] || null
  } else {
    pack = _packs.find(function(p){ return p.id === packId })
    var sel2 = document.getElementById('ansb-pack-select')
    sel2.value = packId
    sel2.dataset.forcedId = packId
    document.getElementById('ansb-pack-select-row').style.display = 'none'
  }

  renderPackInfoInModal(pack)
  showModal('apply-nsb-modal')
}

function openEditNsbManual() {
  _nsbData.ensb = null
  _ensbCurrent = {}
  document.getElementById('ensb-file-name').style.display = 'none'
  document.getElementById('ensb-form').style.display = 'none'
  document.getElementById('ensb-apply-btn').disabled = true
  document.getElementById('ensb-unban-btn').disabled = true
  document.getElementById('ensb-drop').classList.remove('over')
  hideNotice('ensb-notice')
  var fields = ['cash','gold','bkeys','skeys','gkeys','fuel','fgreen','fblue','fred','fyellow']
  for (var i = 0; i < fields.length; i++) {
    var el = document.getElementById('ensb-' + fields[i])
    if (el) el.value = '0'
    var af = document.getElementById('ensb-' + fields[i] + '-after')
    if (af) af.textContent = '—'
  }
  showModal('edit-nsb-modal')
}

function renderPackInfoInModal(pack) {
  var box = document.getElementById('ansb-pack-info')
  var outer = document.getElementById('ansb-outer')
  var carSection = document.getElementById('ansb-car-section')
  if (!pack) { box.innerHTML = ''; outer.classList.remove('has-cars'); carSection.style.display = 'none'; return }

  var c = pack.currencies || {}
  var chips = []
  if (c.cash)       chips.push({val: fmtN(c.cash),       lbl: 'Cash',        em: '💵'})
  if (c.gold)       chips.push({val: fmtN(c.gold),       lbl: 'Gold',        em: '🪙'})
  if (c.bronzeKeys) chips.push({val: fmtN(c.bronzeKeys), lbl: 'Bronze Keys', em: '🔑'})
  if (c.silverKeys) chips.push({val: fmtN(c.silverKeys), lbl: 'Silver Keys', em: '🗝️'})
  if (c.goldKeys)   chips.push({val: fmtN(c.goldKeys),   lbl: 'Gold Keys',   em: '✨'})
  if (c.fuel)       chips.push({val: fmtN(c.fuel),       lbl: 'Fuel',        em: '⛽'})

  var html = '<div style="font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.7px;margin-bottom:8px">' + escH(pack.name || 'Pack Contents') + '</div>'

  if (chips.length) {
    html += '<div class="pack-stat-grid">'
    for (var i = 0; i < chips.length; i++) {
      html += '<div class="pack-stat-chip"><span class="psc-val">' + chips[i].em + ' ' + escH(chips[i].val) + '</span><span class="psc-lbl">' + escH(chips[i].lbl) + '</span></div>'
    }
    html += '</div>'
  }

  var fusion = []
  if (c.fusionGreen)  fusion.push('<span class="token-dot" style="background:#4caf50"></span><span>' + fmtN(c.fusionGreen) + ' Green</span>')
  if (c.fusionBlue)   fusion.push('<span class="token-dot" style="background:#2196F3"></span><span>' + fmtN(c.fusionBlue) + ' Blue</span>')
  if (c.fusionRed)    fusion.push('<span class="token-dot" style="background:#e05252"></span><span>' + fmtN(c.fusionRed) + ' Red</span>')
  if (c.fusionYellow) fusion.push('<span class="token-dot" style="background:#FFC107"></span><span>' + fmtN(c.fusionYellow) + ' Yellow</span>')
  if (fusion.length) {
    html += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:4px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:.5px">Fusion:</span>' + fusion.join('') + '</div>'
  }

  if (pack.cars && pack.cars.count) {
    html += '<div style="font-size:12px;color:var(--muted);margin-top:4px">🚗 ' + fmtN(pack.cars.count) + ' cars &middot; ' + escH(pack.cars.carMode || 'random') + (pack.cars.condition === 'maxed' ? ' &middot; maxed' : '') + '</div>'
  }

  box.innerHTML = html

  var isCustom = !!(pack.cars && pack.cars.carMode === 'customizable')
  carSection.style.display = isCustom ? '' : 'none'
  if (isCustom) {
    outer.classList.add('has-cars')
    renderCarFilterBar()
    setCarSectionLocked(!_nsbData.ansb)
  } else {
    outer.classList.remove('has-cars')
  }
}

function renderCarFilterBar() {
  var tierBar  = document.getElementById('ansb-tier-filters')
  var starBar  = document.getElementById('ansb-star-filters')
  var brandBar = document.getElementById('ansb-brand-filters')
  if (!tierBar) return
  var t = _carFilter.tier
  tierBar.innerHTML = ['All',1,2,3,4,5].map(function(v){
    var active = (v === 'All' && !t) || v === t
    return '<span class="car-filter-chip' + (active?' active':'') + '" onclick="setTierFilter(\\'' + v + '\\')">' + (v === 'All' ? 'All' : 'T'+v) + '</span>'
  }).join('')
  if (starBar) {
    var s = _carFilter.starType
    starBar.innerHTML = [
      {v:'All', l:'⭐ All Stars'}, {v:'Gold', l:'⭐ Gold'}, {v:'Purple', l:'💜 Purple'}, {v:'Legends', l:'🌟 Legends'},
    ].map(function(x){
      var active = (x.v === 'All' && !s) || x.v === s
      return '<span class="car-filter-chip' + (active?' active':'') + '" onclick="setStarFilter(\\'' + x.v + '\\')">' + x.l + '</span>'
    }).join('')
  }
  if (brandBar) {
    var b = _carFilter.brand
    var brands = []
    for (var i = 0; i < _csr2CarsDb.length; i++) {
      if (_csr2CarsDb[i].brand && brands.indexOf(_csr2CarsDb[i].brand) === -1) brands.push(_csr2CarsDb[i].brand)
    }
    brands.sort()
    brandBar.innerHTML = ['All'].concat(brands).map(function(v){
      var active = (v === 'All' && !b) || v === b
      return '<span class="car-filter-chip' + (active?' active':'') + '" onclick="setBrandFilter(\\'' + escH(v) + '\\')">' + escH(v === 'All' ? 'All Brands' : v) + '</span>'
    }).join('')
  }
}

function setTierFilter(val) {
  _carFilter.tier = (val === 'All' || val === 'null') ? null : +val
  renderCarFilterBar()
  searchCars(document.getElementById('ansb-car-search').value)
}

function setStarFilter(val) {
  _carFilter.starType = (val === 'All') ? null : val
  renderCarFilterBar()
  searchCars(document.getElementById('ansb-car-search').value)
}

function setBrandFilter(val) {
  _carFilter.brand = (val === 'All') ? null : val
  renderCarFilterBar()
  searchCars(document.getElementById('ansb-car-search').value)
}

function toggleAllowDuplicates() {
  _allowDuplicates = document.getElementById('ansb-allow-dup').checked
  searchCars(document.getElementById('ansb-car-search').value)
}

function setCarSectionLocked(locked) {
  var lockMsg = document.getElementById('ansb-car-locked')
  var controls = document.getElementById('ansb-car-controls')
  if (!lockMsg || !controls) return
  lockMsg.style.display = locked ? '' : 'none'
  controls.style.display = locked ? 'none' : ''
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

function bufToBase64(buf) {
  var bytes = new Uint8Array(buf), out = '', chunk = 8192
  for (var i = 0; i < bytes.length; i += chunk)
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  return btoa(out)
}

function readNsbFile(file, which) {
  var reader = new FileReader()
  reader.onload = function(e) {
    var base64 = bufToBase64(e.target.result)
    _nsbData[which] = { base64: base64, name: file.name }
    document.getElementById(which + '-file-name').textContent = file.name
    document.getElementById(which + '-file-name').style.display = ''
    if (which === 'ansb') {
      loadNsbComparison()
      document.getElementById('ansb-apply-btn').disabled = false
    } else if (which === 'ensb') {
      loadEnsbCurrent()
    } else {
      document.getElementById('unban-apply-btn').disabled = false
    }
  }
  reader.readAsArrayBuffer(file)
}

async function loadEnsbCurrent() {
  if (!_nsbData.ensb) return
  var res = await fetch('/csr2/read-nsb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nsbBase64: _nsbData.ensb.base64 })
  }).then(function(r){ return r.json() }).catch(function(){ return null })
  if (!res || res.error) { showNotice('ensb-notice', 'error', 'Could not read save file.'); return }
  _ensbCurrent = res
  document.getElementById('ensb-form').style.display = ''
  document.getElementById('ensb-apply-btn').disabled = false
  document.getElementById('ensb-unban-btn').disabled = false
  updateEnsbAfter()
}

async function loadNsbComparison() {
  var packId = document.getElementById('ansb-pack-select').dataset.forcedId || document.getElementById('ansb-pack-select').value
  var pack = _packs.find(function(p){ return p.id === packId })
  if (!pack || !_nsbData.ansb) return
  var res = await fetch('/csr2/read-nsb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nsbBase64: _nsbData.ansb.base64 })
  }).then(function(r){ return r.json() }).catch(function(){ return null })
  if (!res || res.error) return
  // Store owned car CRDBs so we can filter them from the search list
  _ownedCrdbs = new Set(Array.isArray(res.ownedCrdbs) ? res.ownedCrdbs : [])
  renderComparison(pack, res)
  setCarSectionLocked(false)
  searchCars(document.getElementById('ansb-car-search').value)
}

function renderComparison(pack, cur) {
  var c = pack.currencies || {}
  var rows = []
  function addRow(lbl, packVal, curVal) {
    if (!packVal) return
    rows.push({ lbl: lbl, delta: '+' + fmtN(packVal), curr: fmtN(curVal), after: fmtN(curVal + packVal) })
  }
  addRow('💵 Cash',        c.cash,       cur.cash       || 0)
  addRow('🪙 Gold',        c.gold,       cur.gold       || 0)
  addRow('🔑 Bronze Keys', c.bronzeKeys, cur.bronzeKeys || 0)
  addRow('🗝️ Silver Keys', c.silverKeys, cur.silverKeys || 0)
  addRow('✨ Gold Keys',   c.goldKeys,   cur.goldKeys   || 0)
  addRow('⛽ Fuel',        c.fuel,       cur.fuel       || 0)
  function addTkRow(color, lbl, packVal, curVal) {
    if (!packVal) return
    rows.push({ lbl: '<span class="token-dot" style="background:' + color + '"></span>' + lbl, delta: '+' + fmtN(packVal), curr: fmtN(curVal), after: fmtN(curVal + packVal), isHtml: true })
  }
  addTkRow('#4caf50', ' Green Tk', c.fusionGreen,  cur.fusionGreen  || 0)
  addTkRow('#2196F3', ' Blue Tk',  c.fusionBlue,   cur.fusionBlue   || 0)
  addTkRow('#e05252', ' Red Tk',   c.fusionRed,    cur.fusionRed    || 0)
  addTkRow('#FFC107', ' Yellow Tk',c.fusionYellow, cur.fusionYellow || 0)
  if (!rows.length) { document.getElementById('ansb-compare').style.display = 'none'; return }
  var html = '<table class="compare-table"><thead><tr>'
  html += '<th>Item</th><th style="text-align:right">Pack</th><th style="text-align:right">Current → After</th>'
  html += '</tr></thead><tbody>'
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i]
    var lblHtml = r.isHtml ? r.lbl : escH(r.lbl)
    html += '<tr><td class="comp-label">' + lblHtml + '</td>'
    html += '<td class="comp-delta">' + escH(r.delta) + '</td>'
    html += '<td class="comp-arrow"><span class="comp-curr">' + escH(r.curr) + '</span><span class="comp-arrow-sym">→</span><span class="comp-after">' + escH(r.after) + '</span></td></tr>'
  }
  html += '</tbody></table>'
  document.getElementById('ansb-compare-box').innerHTML = html
  document.getElementById('ansb-compare').style.display = ''
}

function searchCars(query) {
  var results = document.getElementById('ansb-car-results')
  if (!results) return

  if (_csr2CarsDb.length === 0) {
    results.innerHTML = '<div class="car-result-list"><div class="car-result-item" style="color:var(--muted)">Car database empty — click "↺ Car DB" to download.</div></div>'
    return
  }

  var q = query ? query.toLowerCase() : ''
  var matches = []
  for (var i = 0; i < _csr2CarsDb.length && matches.length < 16; i++) {
    var c = _csr2CarsDb[i]
    if (!_allowDuplicates && _ownedCrdbs.has(c.crdb)) continue
    if (_carFilter.tier && c.tier !== _carFilter.tier) continue
    if (_carFilter.brand && c.brand !== _carFilter.brand) continue
    if (_carFilter.starType && c.starType !== _carFilter.starType) continue
    if (q && c.name.toLowerCase().indexOf(q) === -1 && c.brand.toLowerCase().indexOf(q) === -1) continue
    matches.push({ car: c, idx: i })
  }

  if (!matches.length) {
    results.innerHTML = '<div class="car-result-list"><div class="car-result-item" style="color:var(--muted)">No cars found</div></div>'
    return
  }

  var selectedCrdbs = new Set(_selectedCars.map(function(c){ return c.crdb }))
  var starIcon = { Gold: '⭐', Purple: '💜', Legends: '🌟' }
  var html = '<div class="car-result-list">'
  for (var j = 0; j < matches.length; j++) {
    var car = matches[j].car, idx = matches[j].idx
    var added = selectedCrdbs.has(car.crdb)
    var si = starIcon[car.starType] || ''
    html += '<div class="car-result-item">'
    html += '<span class="car-tier-badge">T' + car.tier + '</span>'
    if (si) html += '<span style="font-size:11px">' + si + '</span>'
    html += '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escH(car.name) + '</span>'
    if (car.colors && car.colors.length > 1) html += '<span style="font-size:10px;color:var(--muted);flex-shrink:0">' + car.colors.length + ' clrs</span>'
    if (added) {
      html += '<span class="car-result-added">Added</span>'
    } else {
      html += '<button class="car-result-add" onclick="addCarToSelection(' + idx + ')">+ Add</button>'
    }
    html += '</div>'
  }
  html += '</div>'
  results.innerHTML = html
}

function addCarToSelection(carIdx) {
  var car = _csr2CarsDb[carIdx]
  if (!car) return
  // If already fully added (all colors selected for single-color car) skip
  if (car.colors && car.colors.length === 1) {
    if (_selectedCars.find(function(c){ return c.crdb === car.crdb && c.colorName === car.colors[0].name })) return
    addCarWithColor(car, car.colors[0])
  } else if (car.colors && car.colors.length > 1) {
    openColorPicker(carIdx)
  } else {
    // No color info (shouldn't happen with real DB)
    if (_selectedCars.find(function(c){ return c.crdb === car.crdb })) return
    _selectedCars.push({ crdb: car.crdb, name: car.name, tier: car.tier, colorName: '', photoUrl: '', stockTxtUrl: '', maxedTxtUrl: null })
    renderSelectedCars()
    searchCars(document.getElementById('ansb-car-search').value)
  }
}

async function addCarWithColor(car, color) {
  if (_selectingColor) return
  _selectingColor = true
  var packId = document.getElementById('ansb-pack-select').dataset.forcedId || document.getElementById('ansb-pack-select').value
  var pack = _packs.find(function(p){ return p.id === packId })
  var condition = (pack && pack.cars && pack.cars.condition === 'maxed') ? 'maxed' : 'stock'
  var txtUrl = condition === 'maxed' ? (color.maxedTxtUrl || color.stockTxtUrl) : color.stockTxtUrl

  // Show loading indicator on the swatch if color picker is open
  var grid = document.getElementById('cp2-colors-grid')
  if (grid) grid.style.opacity = '0.5'
  showLoading('Loading car data...')

  try {
    if (!txtUrl) throw new Error('No car data URL for this color.')
    var resp = await fetch(txtUrl)
    if (!resp.ok) throw new Error('HTTP ' + resp.status)
    var txt = await resp.text()
    JSON.parse(txt)  // validate it's real JSON before adding
    _selectedCars.push({
      crdb: car.crdb,
      name: car.name,
      tier: car.tier,
      colorName: color.name,
      photoUrl: color.photoUrl || '',
      stockTxtUrl: color.stockTxtUrl || '',
      maxedTxtUrl: color.maxedTxtUrl || null,
    })
    hideLoading()
    if (grid) grid.style.opacity = ''
    if (document.getElementById('color-picker-modal').classList.contains('on')) {
      hideModal('color-picker-modal')
    }
    renderSelectedCars()
    searchCars(document.getElementById('ansb-car-search').value)
  } catch (e) {
    hideLoading()
    if (grid) grid.style.opacity = ''
    showNotice('ansb-notice', 'error', 'Failed to load car: ' + e.message)
  }
  _selectingColor = false
}

function removeCarFromSelection(crdb, colorName) {
  _selectedCars = _selectedCars.filter(function(c){ return !(c.crdb === crdb && c.colorName === colorName) })
  renderSelectedCars()
  searchCars(document.getElementById('ansb-car-search').value)
}

function openColorPicker(carIdx) {
  var car = _csr2CarsDb[carIdx]
  if (!car) return
  _colorPickerCar = car
  _colorPickerCarIdx = carIdx
  document.getElementById('cp2-car-name').textContent = car.name
  document.getElementById('cp2-car-sub').textContent = 'T' + car.tier + ' · ' + (car.starType || '') + ' · ' + (car.colors ? car.colors.length : 0) + ' colors'
  hideNotice('cp2-notice')
  var grid = document.getElementById('cp2-colors-grid')
  if (!grid) return
  var selectedKeys = new Set(_selectedCars.map(function(c){ return c.crdb + '|' + c.colorName }))
  var html = ''
  var colors = car.colors || []
  for (var i = 0; i < colors.length; i++) {
    var col = colors[i]
    var alreadySelected = selectedKeys.has(car.crdb + '|' + col.name)
    html += '<div class="color-swatch' + (alreadySelected ? ' loading' : '') + '" onclick="selectColorByIdx(' + carIdx + ',' + i + ')" title="' + escH(col.name) + '">'
    html += '<img src="' + escH(col.photoUrl || '') + '" onerror="this.style.display=\\'none\\'" loading="lazy">'
    html += '<div class="color-swatch-name">' + escH(col.name) + (alreadySelected ? ' ✓' : '') + '</div>'
    html += '</div>'
  }
  grid.innerHTML = html
  showModal('color-picker-modal')
}

function selectColorByIdx(carIdx, colorIdx) {
  var car = _csr2CarsDb[carIdx]
  if (!car || !car.colors) return
  var color = car.colors[colorIdx]
  if (!color) return
  if (_selectedCars.find(function(c){ return c.crdb === car.crdb && c.colorName === color.name })) {
    showNotice('cp2-notice', 'info', 'This color is already in your selection.')
    return
  }
  addCarWithColor(car, color)
}

function renderSelectedCars() {
  var list = document.getElementById('ansb-selected-cars-list')
  var count = document.getElementById('ansb-selected-count')
  var badge = document.getElementById('ansb-car-count-badge')
  var noteEl = document.getElementById('ansb-cars-remaining-note')
  var n = _selectedCars.length
  if (count) count.textContent = n + ' car' + (n === 1 ? '' : 's') + ' selected'
  if (badge) badge.textContent = '(' + n + ' selected)'
  if (!list) return
  if (!n) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;margin-top:20px">No cars selected.<br>Search and add cars on the left.</div>'
    if (noteEl) noteEl.style.display = 'none'
    return
  }
  var html = ''
  for (var i = 0; i < _selectedCars.length; i++) {
    var car = _selectedCars[i]
    var crdbEsc = escH(car.crdb || '')
    var colEsc = escH(car.colorName || '')
    html += '<div class="selected-car-item">'
    if (car.photoUrl) {
      html += '<img class="selected-car-photo" src="' + escH(car.photoUrl) + '" onerror="this.style.display=\\'none\\'" loading="lazy">'
    } else {
      html += '<span class="car-tier-badge" style="width:44px;height:30px;display:flex;align-items:center;justify-content:center">T' + car.tier + '</span>'
    }
    html += '<div class="selected-car-info">'
    html += '<div class="scar-name">' + escH(car.name) + '</div>'
    if (car.colorName) html += '<div class="scar-color">' + escH(car.colorName) + '</div>'
    html += '</div>'
    html += '<button class="selected-car-remove" data-crdb="' + crdbEsc + '" data-col="' + colEsc + '" onclick="removeCarFromSelection(this.dataset.crdb,this.dataset.col)" title="Remove">&times;</button>'
    html += '</div>'
  }
  list.innerHTML = html
  if (noteEl) {
    var packId = document.getElementById('ansb-pack-select').dataset.forcedId || document.getElementById('ansb-pack-select').value
    var pack = _packs.find(function(p){ return p.id === packId })
    var total = pack && pack.cars && pack.cars.count ? pack.cars.count : 0
    if (total > 0) {
      var remaining = Math.max(0, total - n)
      noteEl.style.display = ''
      noteEl.textContent = n + '/' + total + ' selected. ' + (remaining > 0 ? 'Remaining ' + remaining + ' will be filled with cars you don\\'t own yet.' : 'All slots filled.')
    } else {
      noteEl.style.display = 'none'
    }
  }
}

async function applyNsb() {
  if (!_nsbData.ansb) return
  var packId = document.getElementById('ansb-pack-select').dataset.forcedId || document.getElementById('ansb-pack-select').value
  showLoading('Applying pack...')
  var payload = { nsbBase64: _nsbData.ansb.base64, packId: packId }
  if (_selectedCars.length > 0) payload.selectedCars = _selectedCars
  var res = await fetch('/csr2/apply-nsb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  hideLoading()
  if (res.error) { showNotice('ansb-notice', 'error', res.error); return }
  var fname = _nsbData.ansb.name || 'PlayerProfile'
  downloadNsb(res.resultBase64, fname)
  var desc = 'The modified save file has been downloaded.'
  if (res.note) desc += '\\n\\n' + res.note
  showApplyResult(true, 'Pack Applied!', desc)
  if (_csr2OutputFolder) { saveNsbToFolder(res.resultBase64, fname) }
}

async function applyManualEdit() {
  if (!_nsbData.ensb) return
  showLoading('Applying edits...')
  var additions = {
    cash:       parseInt(document.getElementById('ensb-cash').value)   || 0,
    gold:       parseInt(document.getElementById('ensb-gold').value)   || 0,
    bronzeKeys: parseInt(document.getElementById('ensb-bkeys').value)  || 0,
    silverKeys: parseInt(document.getElementById('ensb-skeys').value)  || 0,
    goldKeys:   parseInt(document.getElementById('ensb-gkeys').value)  || 0,
    fuel:       parseInt(document.getElementById('ensb-fuel').value)   || 0,
    fusionGreen:  parseInt(document.getElementById('ensb-fgreen').value)  || 0,
    fusionBlue:   parseInt(document.getElementById('ensb-fblue').value)   || 0,
    fusionRed:    parseInt(document.getElementById('ensb-fred').value)    || 0,
    fusionYellow: parseInt(document.getElementById('ensb-fyellow').value) || 0,
  }
  var res = await fetch('/csr2/edit-nsb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nsbBase64: _nsbData.ensb.base64, additions: additions })
  }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  hideLoading()
  if (res.error) { showNotice('ensb-notice', 'error', res.error); return }
  var fname = _nsbData.ensb.name || 'PlayerProfile'
  downloadNsb(res.resultBase64, fname)
  showApplyResult(true, 'Edits Applied!', 'The modified save file has been downloaded.')
  if (_csr2OutputFolder) { saveNsbToFolder(res.resultBase64, fname) }
}

function showApplyResult(ok, title, desc) {
  document.getElementById('apply-result-icon').textContent = ok ? '✅' : '❌'
  document.getElementById('apply-result-title').textContent = title
  document.getElementById('apply-result-desc').textContent = desc
  showModal('apply-result-modal')
}

function downloadNsb(b64, filename) {
  var bytes = Uint8Array.from(atob(b64), function(c){ return c.charCodeAt(0) })
  var blob = new Blob([bytes], { type: 'application/octet-stream' })
  var a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

async function saveNsbToFolder(b64, filename) {
  var res = await fetch('/csr2/save-nsb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64: b64, filename: filename })
  }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (res.conflict) {
    _pendingSavePack = { b64: b64, filename: filename }
    document.getElementById('nsb-conflict-name').textContent = res.existingFile || 'existing file'
    showModal('nsb-conflict-modal')
  }
}

async function confirmSaveToFolder() {
  hideModal('nsb-conflict-modal')
  if (!_pendingSavePack) return
  var p = _pendingSavePack
  _pendingSavePack = null
  await fetch('/csr2/save-nsb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64: p.b64, filename: p.filename, forceOverwrite: true })
  }).catch(function(){})
}

function openCsr2Settings() {
  document.getElementById('csr2-folder-input').value = _csr2OutputFolder || ''
  hideNotice('csr2-settings-notice')
  showModal('csr2-settings-modal')
}

async function saveCsr2Settings() {
  var folder = document.getElementById('csr2-folder-input').value.trim()
  _csr2OutputFolder = folder
  var cfg = await fetch('/local/config').then(function(r){ return r.json() }).catch(function(){ return {} })
  cfg.csr2OutputFolder = folder
  await fetch('/local/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) }).catch(function(){})
  showNotice('csr2-settings-notice', 'success', 'Saved!')
  setTimeout(function(){ hideModal('csr2-settings-modal') }, 700)
}

function confirmApplyUnban() {
  hideModal('unban-confirm-modal')
  if (_nsbData.ensb) {
    applyUnbanFromManual()
  } else {
    applyUnban()
  }
}

async function applyUnbanFromManual() {
  if (!_nsbData.ensb) return
  showLoading('Applying unban...')
  var res = await fetch('/csr2/unban', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nsbBase64: _nsbData.ensb.base64 })
  }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  hideLoading()
  if (res.error) { showNotice('ensb-notice', 'error', res.error); return }
  var fname = _nsbData.ensb.name || 'PlayerProfile'
  downloadNsb(res.resultBase64, fname)
  showApplyResult(true, 'Unban Applied!', 'The modified save file has been downloaded. The account has been unbanned.')
}

function updateEnsbAfter() {
  var fields = [
    { key:'cash',   cur:_ensbCurrent.cash||0,   id:'ensb-cash'   },
    { key:'gold',   cur:_ensbCurrent.gold||0,   id:'ensb-gold'   },
    { key:'bronzeKeys',cur:_ensbCurrent.bronzeKeys||0,id:'ensb-bkeys'},
    { key:'silverKeys',cur:_ensbCurrent.silverKeys||0,id:'ensb-skeys'},
    { key:'goldKeys',  cur:_ensbCurrent.goldKeys||0,  id:'ensb-gkeys'},
    { key:'fuel',   cur:_ensbCurrent.fuel||0,   id:'ensb-fuel'   },
    { key:'fusionGreen', cur:_ensbCurrent.fusionGreen||0,  id:'ensb-fgreen'},
    { key:'fusionBlue',  cur:_ensbCurrent.fusionBlue||0,   id:'ensb-fblue' },
    { key:'fusionRed',   cur:_ensbCurrent.fusionRed||0,    id:'ensb-fred'  },
    { key:'fusionYellow',cur:_ensbCurrent.fusionYellow||0, id:'ensb-fyellow'},
  ]
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i]
    var add = parseInt(document.getElementById(f.id) ? document.getElementById(f.id).value : '0') || 0
    var af = document.getElementById(f.id + '-after')
    if (af) af.textContent = add > 0 ? fmtN(f.cur + add) : '—'
  }
}

function toggleVersionSection() {
  var on = document.getElementById('cp-ver-toggle').checked
  document.getElementById('cp-ver-section').style.display = on ? '' : 'none'
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
  downloadNsb(res.resultBase64, _nsbData.unban.name || 'PlayerProfile')
  hideModal('unban-modal')
  showApplyResult(true, 'Unban Applied!', 'The account has been unbanned. The modified save file has been downloaded.')
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

  // CSR2 settings (output folder)
  if (req.method === 'GET' && pathname === '/csr2/settings') {
    const cfg = loadConfig()
    return json(res, 200, { outputFolder: cfg.csr2OutputFolder || '' })
  }

  // CSR2 save-nsb (write modified save to output folder)
  if (req.method === 'POST' && pathname === '/csr2/save-nsb') {
    const body = await readBody(req)
    if (!body.base64 || !body.filename) return json(res, 400, { error: 'Missing base64 or filename' })
    const cfg = loadConfig()
    const folder = cfg.csr2OutputFolder
    if (!folder) return json(res, 400, { error: 'No output folder configured' })
    if (!fs.existsSync(folder)) return json(res, 400, { error: 'Output folder not found: ' + folder })
    try {
      const files = fs.readdirSync(folder).filter(f => !f.startsWith('.'))
      if (files.length > 0 && !body.forceOverwrite) {
        return json(res, 200, { conflict: true, existingFile: files[0] })
      }
      if (body.forceOverwrite) {
        for (const f of files) {
          try { fs.unlinkSync(path.join(folder, f)) } catch {}
        }
      }
      fs.writeFileSync(path.join(folder, body.filename), Buffer.from(body.base64, 'base64'))
      log('[csr2/save-nsb] Saved to: ' + path.join(folder, body.filename))
      return json(res, 200, { ok: true })
    } catch (e) {
      return json(res, 500, { error: e.message })
    }
  }

  // CSR2 edit-nsb (manual add to existing values)
  if (req.method === 'POST' && pathname === '/csr2/edit-nsb') {
    const body = await readBody(req)
    if (!body.nsbBase64) return json(res, 400, { error: 'Missing nsbBase64' })
    try {
      const buf = Buffer.from(body.nsbBase64, 'base64')
      const data = csr2ReadSave(buf)
      const a = body.additions || {}
      if (a.cash)         data.caea = (data.caea || 0) + a.cash
      if (a.gold)         data.goea = (data.goea || 0) + a.gold
      if (a.bronzeKeys)   data.gbke = (data.gbke || 0) + a.bronzeKeys
      if (a.silverKeys)   data.gske = (data.gske || 0) + a.silverKeys
      if (a.goldKeys)     data.ggke = (data.ggke || 0) + a.goldKeys
      if (a.fuel)         data.fupi = (data.fupi || 0) + a.fuel
      if (a.fusionGreen || a.fusionBlue || a.fusionRed || a.fusionYellow) {
        if (!data.afme) data.afme = {}
        if (a.fusionGreen)  data.afme.Green  = (data.afme.Green  || 0) + a.fusionGreen
        if (a.fusionBlue)   data.afme.Blue   = (data.afme.Blue   || 0) + a.fusionBlue
        if (a.fusionRed)    data.afme.Red    = (data.afme.Red    || 0) + a.fusionRed
        if (a.fusionYellow) data.afme.Yellow = (data.afme.Yellow || 0) + a.fusionYellow
      }
      const out = csr2WriteSave(data)
      return json(res, 200, { resultBase64: out.toString('base64') })
    } catch (e) {
      log('[csr2/edit-nsb] Error: ' + e.message)
      return json(res, 500, { error: e.message })
    }
  }

  // CSR2 read-nsb (returns current account stats for comparison preview)
  if (req.method === 'POST' && pathname === '/csr2/read-nsb') {
    const body = await readBody(req)
    if (!body.nsbBase64) return json(res, 400, { error: 'Missing nsbBase64' })
    try {
      const buf = Buffer.from(body.nsbBase64, 'base64')
      return json(res, 200, csr2ReadSaveStats(buf))
    } catch (e) {
      log('[csr2/read-nsb] Error: ' + e.message)
      return json(res, 500, { error: e.message })
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
      const { note } = await csr2ApplyPack(data, pack, body.selectedCars || null)
      const out = csr2WriteSave(data)
      return json(res, 200, { resultBase64: out.toString('base64'), note: note || null })
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

  // CSR2 car database — return stored list
  if (req.method === 'GET' && pathname === '/csr2/cars') {
    return json(res, 200, loadCsr2Cars())
  }

  // CSR2 car database — check if GitHub has newer commit
  if (req.method === 'GET' && pathname === '/csr2/cars-check') {
    try {
      const stored = loadCsr2Sha()
      const commit = await fetchGithubApi('/repos/Nitro4CSR/CSR2-DataBase/commits/main')
      const remoteSha = commit.sha || ''
      return json(res, 200, {
        hasUpdate: remoteSha !== (stored.sha || ''),
        storedSha: stored.sha || '',
        remoteSha,
        carCount: loadCsr2Cars().length,
      })
    } catch (e) {
      return json(res, 200, { hasUpdate: false, error: e.message, carCount: loadCsr2Cars().length })
    }
  }

  // CSR2 car database — rebuild from GitHub
  if (req.method === 'POST' && pathname === '/csr2/cars-update') {
    try {
      log('[csr2/cars-update] Fetching latest commit SHA...')
      const commit = await fetchGithubApi('/repos/Nitro4CSR/CSR2-DataBase/commits/main')
      const sha = commit.sha || ''

      log('[csr2/cars-update] Fetching file tree...')
      const treeData = await fetchGithubApi('/repos/Nitro4CSR/CSR2-DataBase/git/trees/main?recursive=1')
      const tree = treeData.tree || []

      const enc = (s) => encodeURIComponent(s)
      const rawBase = 'https://raw.githubusercontent.com/Nitro4CSR/CSR2-DataBase/main/'
      const rawUrl = (parts) => rawBase + parts.map(enc).join('/')

      // Group Stock .txt files by brand+model+starType
      const carMap = new Map()
      for (const item of tree) {
        if (item.type !== 'blob') continue
        if (!item.path.startsWith('1.Cars/1.Stock/') || !item.path.endsWith('.txt')) continue
        const parts = item.path.split('/')
        if (parts.length < 6) continue
        const starRaw = parts[2], brand = parts[3], model = parts[4]
        const colorName = parts[5].replace(/\.txt$/, '')
        const starType = /gold/i.test(starRaw) ? 'Gold' : /purple/i.test(starRaw) ? 'Purple' : /legend/i.test(starRaw) ? 'Legends' : 'Other'
        const key = brand + '|' + model + '|' + starType
        const sUrl = rawUrl(parts)
        const pUrl = rawUrl(parts.slice(0, -1).concat(colorName + '.jpg'))
        if (!carMap.has(key)) {
          carMap.set(key, { brand, model, starType, colors: [], firstTxtUrl: sUrl })
        }
        carMap.get(key).colors.push({ name: colorName, photoUrl: pUrl, stockTxtUrl: sUrl, maxedTxtUrl: null })
      }

      // Map maxed .txt files by brand+model+colorName
      const maxedIdx = new Map()
      for (const item of tree) {
        if (item.type !== 'blob') continue
        if (!item.path.startsWith('1.Cars/2.Maxed/') || !item.path.endsWith('.txt')) continue
        const parts = item.path.split('/')
        // Handle with or without starType subfolder (depth 5 or 6)
        let brand, model, colorName
        if (parts.length >= 6) {
          brand = parts[parts.length - 3]; model = parts[parts.length - 2]
          colorName = parts[parts.length - 1].replace(/\.txt$/, '')
        } else continue
        maxedIdx.set(brand + '|' + model + '|' + colorName, rawUrl(parts))
      }

      for (const car of carMap.values()) {
        for (const c of car.colors) {
          c.maxedTxtUrl = maxedIdx.get(car.brand + '|' + car.model + '|' + c.name) || null
        }
      }

      // Fetch one .txt per car model to get crdb + tier
      const cars = [...carMap.values()]
      log('[csr2/cars-update] Resolving crdb+tier for ' + cars.length + ' models...')
      const BATCH = 20
      let done = 0
      for (let i = 0; i < cars.length; i += BATCH) {
        await Promise.all(cars.slice(i, i + BATCH).map(async (car) => {
          try {
            const txt = await fetchRawGithub(car.firstTxtUrl)
            const obj = JSON.parse(txt)
            car.crdb = obj.crdb || null
            car.tier = parseInt((obj.ctie || 'TIER_1').replace(/\D/g, '')) || 1
          } catch { car.crdb = null; car.tier = 1 }
          done++
        }))
        log('[csr2/cars-update] ' + done + '/' + cars.length)
      }

      const result = cars.filter(c => c.crdb).map(c => ({
        crdb: c.crdb,
        name: c.brand + ' ' + c.model,
        tier: c.tier,
        brand: c.brand,
        starType: c.starType,
        colors: c.colors.map(col => ({
          name: col.name,
          photoUrl: col.photoUrl,
          stockTxtUrl: col.stockTxtUrl,
          maxedTxtUrl: col.maxedTxtUrl,
        })),
      }))

      saveCsr2Cars(result)
      saveCsr2Sha({ sha, updatedAt: new Date().toISOString() })
      log('[csr2/cars-update] Done — ' + result.length + ' cars saved.')
      return json(res, 200, { ok: true, count: result.length })
    } catch (e) {
      log('[csr2/cars-update] Error: ' + e.message)
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

