const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const os = require('os')
const zlib = require('zlib')
const crypto = require('crypto')
const { exec } = require('child_process')

const PORT = 35199
const VERSION = '0.7.16'

// ─── Local Storage ────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.env.APPDATA || os.homedir(), 'aio-tool')
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json')
const CONFIG_FILE = path.join(DATA_DIR, 'config.json')
const PACKS_FILE     = path.join(DATA_DIR, 'csr2-packs.json')
const CAR_PACKS_FILE = path.join(DATA_DIR, 'csr2-car-packs.json')
const CSR2_CARS_FILE    = path.join(DATA_DIR, 'csr2-cars.json')
const CSR2_SHA_FILE     = path.join(DATA_DIR, 'csr2-cars-sha.json')
const CSR2_FUSIONS_FILE = path.join(DATA_DIR, 'csr2-fusions.json')
const CSR2_FUSIONS_SHA  = path.join(DATA_DIR, 'csr2-fusions-sha.json')
const CSR2_STAGE6_FILE  = path.join(DATA_DIR, 'csr2-stage6.json')
const CSR2_STAGE6_SHA   = path.join(DATA_DIR, 'csr2-stage6-sha.json')
const CSR2_BRANDS_FILE  = path.join(DATA_DIR, 'csr2-brands.json')
const CSR2_BRANDS_SHA   = path.join(DATA_DIR, 'csr2-brands-sha.json')
const INT32_MAX = 2147483647
const applyJobs = new Map()

const LEGEND_CARS = [
  { crdb: 'Ferrari_250GTOClassic_1962',            name: 'Ferrari 250 GTO',                amount: 14800 },
  { crdb: 'AstonMartin_DB5Classic_1964',            name: 'Aston Martin DB5',               amount: 17400 },
  { crdb: 'MercedesBenz_300SLClassic_1954',         name: 'Mercedes-Benz 300SL',            amount: 17400 },
  { crdb: 'Shelby_Cobra427SCClassic_1965',          name: 'Shelby Cobra',                   amount: 25800 },
  { crdb: 'Chevrolet_CorvetteZR1Classic_1970',      name: 'Chevy Corvette C3',              amount: 25800, tier: 3 },
  { crdb: 'Pontiac_GTOTheJudgeClassic_1969',        name: 'Pontiac GTO',                    amount: 29600 },
  { crdb: 'Honda_NSXRClassic_1992',                 name: 'Honda NSX-R',                    amount: 36000 },
  { crdb: 'Plymouth_HemiCudaClassic_1971',          name: 'Plymouth Hemi Cuda',             amount: 38200 },
  { crdb: 'Ford_GT40MkII_1966',                     name: 'Ford GT40',                      amount: 40400, tier: 4 },
  { crdb: 'Lamborghini_CountachClassic_1988',       name: 'Lamborghini Countach',           amount: 40400 },
  { crdb: 'Porsche_CarreraGTClassic_2003',          name: 'Porsche Carrera GT',             amount: 50000, tier: 5 },
  { crdb: 'Lamborghini_MiuraSVLPClassic_1971',      name: 'Lamborghini Miura SVL',          amount: 50000, tier: 5 },
  { crdb: 'Bugatti_EB110SSClassic_1992',            name: 'Bugatti EB110',                  amount: 50000 },
  { crdb: 'Jaguar_XJ220Classic_1993',               name: 'Jaguar XJ220',                   amount: 53400 },
  { crdb: 'Ford_MustangShelbyGT350LPClassic_1965',  name: 'Ford Mustang Shelby GT350LP',    amount: 56000, tier: 5 },
  { crdb: 'Saleen_S7Classic_2004',                  name: 'Saleen S7',                      amount: 56400 },
  { crdb: 'Plymouth_SuperbirdLPClassic_1970',       name: 'Plymouth Superbird LP',          amount: 65000, tier: 5 },
  { crdb: 'Porsche_911CarreraRS27LPClassic_1973',   name: 'Porsche 911 Carrera RS27 LP',    amount: 65000 },
  { crdb: 'Datsun_240ZLPClassic_1972',              name: 'Datsun 240Z LP',                 amount: 65000 },
  { crdb: 'Dodge_ChallengerRTLPClassic_1970',       name: 'Dodge Challenger R/T Classic',   amount: 64000 },
  { crdb: 'Chevrolet_CorvetteC1LPClassic_1958',     name: 'Chevrolet Corvette C1',          amount: 70000 },
  { crdb: 'Chevrolet_NovaSSLPClassic_1970',         name: 'Chevy Nova SS Classic',          amount: 70000, tier: 5 },
  { crdb: 'Ford_EscortMk1RS2000LPClassic_1973',     name: 'Ford Escort Mk1 RS2000 Classic', amount: 70000 },
  { crdb: 'Dodge_ViperSR1LPClassic_1995',           name: 'Dodge Viper SR1 LP',             amount: 75000, tier: 5 },
  { crdb: 'Ford_MustangSVTCobraRLPClassic_1993',    name: 'Ford Mustang SVT Cobra R',       amount: 75000, tier: 5 },
  { crdb: 'Porsche_911Turbo930LPClassic_1977',      name: 'Porsche 911 Turbo (930)',        amount: 75000, tier: 5 },
]

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
function loadConfig() { const c = loadJson(CONFIG_FILE, {}); if (!c.webappUrl) c.webappUrl = 'https://www.antlervaults.store'; return c }
function saveConfig(c) { saveJson(CONFIG_FILE, c) }
function loadPacks()     { return loadJson(PACKS_FILE, []) }
function savePacks(p)   { saveJson(PACKS_FILE, p) }
function loadCarPacks() { return loadJson(CAR_PACKS_FILE, []) }
function saveCarPacks(p){ saveJson(CAR_PACKS_FILE, p) }
function loadCsr2Cars() { return loadJson(CSR2_CARS_FILE, []) }
function saveCsr2Cars(d) { saveJson(CSR2_CARS_FILE, d) }
function saveCsr2Sha(d) { saveJson(CSR2_SHA_FILE, d) }
function loadFusionData() { return loadJson(CSR2_FUSIONS_FILE, {}) }
function saveFusionData(d) { saveJson(CSR2_FUSIONS_FILE, d) }
function loadFusionsSha() { return loadJson(CSR2_FUSIONS_SHA, {}) }
function saveFusionsSha(d) { saveJson(CSR2_FUSIONS_SHA, d) }
function loadStage6Data() { return loadJson(CSR2_STAGE6_FILE, {}) }
function saveStage6Data(d) { saveJson(CSR2_STAGE6_FILE, d) }
function loadStage6Sha() { return loadJson(CSR2_STAGE6_SHA, {}) }
function saveStage6Sha(d) { saveJson(CSR2_STAGE6_SHA, d) }
function loadBrandData() { return loadJson(CSR2_BRANDS_FILE, []) }
function saveBrandData(d) { saveJson(CSR2_BRANDS_FILE, d) }
function loadBrandsSha() { return loadJson(CSR2_BRANDS_SHA, {}) }
function saveBrandsSha(d) { saveJson(CSR2_BRANDS_SHA, d) }
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
  const [skinsRes, lootRes, emotesRes, iconsRes,
         wardsRes, wardsV1Res, wardsCollRes,
         finishersRes, finishersV1Res,
         walletRes, regionRes,
         tftCompanionsRes, tftTacticianRes, tftCompanionV1Res,
         tftMapSkinsRes, tftMapV1Res,
         tftDamageSkinsRes, tftBoomV1Res,
         masteryCollRes, masteryLocalRes, skinInvRes] = await Promise.all([
    lcuGet(lcuPort, password, `/lol-champions/v1/inventories/${summonerId}/skins-minimal`),
    lcuGet(lcuPort, password, '/lol-loot/v1/player-loot'),
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/EMOTE'),
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/SUMMONER_ICON'),
    // Wards — three approaches
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/WARD_SKIN'),
    lcuGet(lcuPort, password, '/lol-inventory/v1/inventory?inventoryTypes=%5B%22WARD_SKIN%22%5D'),
    lcuGet(lcuPort, password, `/lol-collections/v1/inventories/${summonerId}/ward-skins`),
    // Finishers — two approaches
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/NEXUS_FINISHER'),
    lcuGet(lcuPort, password, '/lol-inventory/v1/inventory?inventoryTypes=%5B%22NEXUS_FINISHER%22%5D'),
    lcuGet(lcuPort, password, '/lol-store/v1/wallet'),
    lcuGet(lcuPort, password, '/riotclient/region-locale'),
    // TFT companions
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/TFT_COMPANION'),
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/TFT_TACTICIAN'),
    lcuGet(lcuPort, password, '/lol-inventory/v1/inventory?inventoryTypes=%5B%22COMPANION%22%5D'),
    // TFT arenas
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/TFT_MAP_SKIN'),
    lcuGet(lcuPort, password, '/lol-inventory/v1/inventory?inventoryTypes=%5B%22TFT_MAP_SKIN%22%5D'),
    // TFT booms
    lcuGet(lcuPort, password, '/lol-inventory/v2/inventory/TFT_DAMAGE_SKIN'),
    lcuGet(lcuPort, password, '/lol-inventory/v1/inventory?inventoryTypes=%5B%22TFT_DAMAGE_SKIN%22%5D'),
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
  debugRes('wards (v2)', wardsRes)
  debugRes('wards (v1)', wardsV1Res)
  debugRes('wards (collections)', wardsCollRes)
  debugRes('finishers (NEXUS_FINISHER)', finishersRes)
  debugRes('finishers (v1)', finishersV1Res)
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

  // Wards — try v2, v1, then collections endpoint
  let ownedWardIds = extractIds(wardsRes.data)
  if (ownedWardIds.length === 0 && wardsV1Res.ok) ownedWardIds = extractIds(wardsV1Res.data)
  if (ownedWardIds.length === 0 && wardsCollRes.ok) {
    // lol-collections returns [{id, name, ...}] array
    const collArr = Array.isArray(wardsCollRes.data) ? wardsCollRes.data : []
    ownedWardIds = collArr.map(w => w.itemId ?? w.wardSkinId ?? w.id).filter(x => x != null && x !== 0)
  }
  log(`Found ${ownedWardIds.length} ward skins.`)

  // Finishers
  let ownedFinisherIds = extractIds(finishersRes.data)
  if (ownedFinisherIds.length === 0 && finishersV1Res.ok) ownedFinisherIds = extractIds(finishersV1Res.data)
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
  let tftMapSkinIds    = extractIds(tftMapSkinsRes.data)
  if (tftMapSkinIds.length === 0 && tftMapV1Res.ok) tftMapSkinIds = extractIds(tftMapV1Res.data)
  let tftDamageSkinIds = extractIds(tftDamageSkinsRes.data)
  if (tftDamageSkinIds.length === 0 && tftBoomV1Res.ok) tftDamageSkinIds = extractIds(tftBoomV1Res.data)
  log(`TFT: ${tftCompanionIds.length} companions, ${tftMapSkinIds.length} arenas, ${tftDamageSkinIds.length} booms (v2+v1 endpoints)`)

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

  // ─── Fallbacks for wards/TFT if dedicated endpoints returned empty ──────────
  // Riot sometimes changes endpoint behaviour; _discovery hits the same types and can substitute
  function extractIdsFromInvAll(type) {
    for (const invRes of [invAllV2Res, invAllV1Res, invPlayerRes]) {
      if (!invRes.ok) continue
      const raw = invRes.data
      const allData = Array.isArray(raw) ? raw
        : Array.isArray(raw?.items) ? raw.items
        : raw && typeof raw === 'object' ? Object.values(raw).flat().filter(x => typeof x === 'object' && x !== null)
        : []
      const ids = allData.filter(i => (i.inventoryType || i.type || '').toUpperCase() === type)
        .map(i => i.itemId ?? i.id).filter(x => x != null && x !== 0)
      if (ids.length > 0) return ids
    }
    return []
  }

  if (ownedWardIds.length === 0) {
    const fromDisc = extractIds(_discovery['WARD_SKIN']?.data)
    const fromAll  = extractIdsFromInvAll('WARD_SKIN')
    ownedWardIds = fromDisc.length > 0 ? fromDisc : fromAll
    if (ownedWardIds.length > 0) log(`Ward fallback: ${ownedWardIds.length} from ${fromDisc.length > 0 ? 'discovery' : 'all-inventory'}`)
  }
  if (tftCompanionIds.length === 0) {
    const discComp = extractIds(_discovery['TFT_COMPANION']?.data || _discovery['TFT_TACTICIAN']?.data || _discovery['COMPANION']?.data)
    const allComp  = extractIdsFromInvAll('TFT_COMPANION')
    tftCompanionIds = discComp.length > 0 ? discComp : allComp
    if (tftCompanionIds.length > 0) log(`TFT companion fallback: ${tftCompanionIds.length}`)
  }
  if (tftMapSkinIds.length === 0) {
    const fromDisc = extractIds(_discovery['TFT_MAP_SKIN']?.data)
    const fromAll  = extractIdsFromInvAll('TFT_MAP_SKIN')
    tftMapSkinIds = fromDisc.length > 0 ? fromDisc : fromAll
    if (tftMapSkinIds.length > 0) log(`TFT map skin fallback: ${tftMapSkinIds.length}`)
  }
  if (tftDamageSkinIds.length === 0) {
    const fromDisc = extractIds(_discovery['TFT_DAMAGE_SKIN']?.data)
    const fromAll  = extractIdsFromInvAll('TFT_DAMAGE_SKIN')
    tftDamageSkinIds = fromDisc.length > 0 ? fromDisc : fromAll
    if (tftDamageSkinIds.length > 0) log(`TFT damage skin fallback: ${tftDamageSkinIds.length}`)
  }
  log(`After fallbacks — wards=${ownedWardIds.length}, tftComp=${tftCompanionIds.length}, tftMap=${tftMapSkinIds.length}, tftBoom=${tftDamageSkinIds.length}`)

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

function fetchRawGithubWithEtag(rawUrl) {
  return new Promise((resolve, reject) => {
    const get = (url) => {
      https.get(url, { headers: { 'User-Agent': 'aio-tool-v' + VERSION } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) return get(res.headers.location)
        const etag = res.headers['etag'] || res.headers['last-modified'] || ''
        let data = ''
        res.on('data', c => data += c)
        res.on('end', () => resolve({ text: data, etag }))
      }).on('error', reject)
    }
    get(rawUrl)
  })
}

// Push a pack to the webapp's csr2_packs table. Fire-and-forget — never blocks a local save.
function syncPackToWebapp(pack) {
  function doPost(url, attempt) {
    try {
      const body = JSON.stringify({ name: pack.name, data: pack })
      const u = new URL(url)
      const opts = {
        hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'aio-tool-v' + VERSION },
      }
      const req = (u.protocol === 'https:' ? https : require('http')).request(opts, r => {
        if ((r.statusCode === 301 || r.statusCode === 302 || r.statusCode === 307 || r.statusCode === 308) && r.headers.location && attempt < 3) {
          r.resume()
          const redirectUrl = r.headers.location.startsWith('http') ? r.headers.location : new URL(r.headers.location, url).toString()
          log('[sync] Pack redirect ' + r.statusCode + ' → ' + redirectUrl)
          return doPost(redirectUrl, attempt + 1)
        }
        r.resume()
        log('[sync] Pack "' + pack.name + '" synced → webapp (' + r.statusCode + ')')
      })
      req.on('error', e => log('[sync] Pack sync error: ' + e.message))
      req.write(body)
      req.end()
    } catch (e) { log('[sync] Pack sync error: ' + e.message) }
  }
  try {
    const cfg = loadConfig()
    const base = (cfg.webappUrl || '').replace(/\/$/, '')
    if (!base) return
    doPost(base + '/api/csr2/packs', 0)
  } catch (e) { log('[sync] Pack sync error: ' + e.message) }
}

function deletePackFromWebapp(packName) {
  function doDelete(url, attempt) {
    try {
      const u = new URL(url)
      const opts = {
        hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search, method: 'DELETE',
        headers: { 'User-Agent': 'aio-tool-v' + VERSION },
      }
      const req = (u.protocol === 'https:' ? https : require('http')).request(opts, r => {
        if ((r.statusCode === 301 || r.statusCode === 302 || r.statusCode === 307 || r.statusCode === 308) && r.headers.location && attempt < 3) {
          r.resume()
          const redirectUrl = r.headers.location.startsWith('http') ? r.headers.location : new URL(r.headers.location, url).toString()
          return doDelete(redirectUrl, attempt + 1)
        }
        r.resume()
        log('[sync] Pack "' + packName + '" deleted from webapp (' + r.statusCode + ')')
      })
      req.on('error', e => log('[sync] Pack delete error: ' + e.message))
      req.end()
    } catch (e) { log('[sync] Pack delete error: ' + e.message) }
  }
  try {
    const cfg = loadConfig()
    const base = (cfg.webappUrl || '').replace(/\/$/, '')
    if (!base) return
    doDelete(base + '/api/csr2/packs?name=' + encodeURIComponent(packName), 0)
  } catch (e) { log('[sync] Pack delete error: ' + e.message) }
}

// Fetch what a HEAD request returns for a URL — used to store a consistent reference for update checks.
// GET and HEAD can return different ETags on GitHub's CDN (e.g. weak vs strong, compressed vs not).
// By always storing the HEAD result and always comparing HEAD results, the check stays consistent.
function headEtagCheck(url) {
  return new Promise(resolve => {
    try {
      const u = new URL(url)
      https.request({ hostname: u.hostname, path: u.pathname + (u.search || ''), method: 'HEAD',
        headers: { 'User-Agent': 'aio-tool-v' + VERSION } }, r => {
        resolve(r.headers['etag'] || r.headers['last-modified'] || '')
      }).on('error', () => resolve('')).end()
    } catch { resolve('') }
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

async function csr2ApplyPack(data, pack, selectedCars, allowDuplicates, jobId, opts) {
  opts = opts || {}
  const { applyLegends = true, applyFusions = true, applyStage6 = true, usePartialSelection = false } = opts
  // Currency override: merge override values on top of pack values
  const baseCurr = pack.currencies || {}
  const c = (opts.currencyOverride && Object.keys(opts.currencyOverride).length > 0)
    ? Object.assign({}, baseCurr, opts.currencyOverride)
    : baseCurr

  // Apply currencies — ADD to existing balance, clamp to INT32_MAX
  if ('cash'       in c) data.caea = Math.min((data.caea || 0) + c.cash,       INT32_MAX)
  if ('gold'       in c) data.goea = Math.min((data.goea || 0) + c.gold,       INT32_MAX)
  if ('bronzeKeys' in c) data.gbke = Math.min((data.gbke || 0) + c.bronzeKeys, INT32_MAX)
  if ('silverKeys' in c) data.gske = Math.min((data.gske || 0) + c.silverKeys, INT32_MAX)
  if ('goldKeys'   in c) data.ggke = Math.min((data.ggke || 0) + c.goldKeys,   INT32_MAX)
  if ('fuel'       in c) data.fupi = Math.min((data.fupi || 0) + c.fuel,       INT32_MAX)
  if (c.fusionGreen || c.fusionBlue || c.fusionRed || c.fusionYellow) {
    if (!data.afme) data.afme = {}
    if (c.fusionGreen)  data.afme.Green  = Math.min((data.afme.Green  || 0) + c.fusionGreen,  INT32_MAX)
    if (c.fusionBlue)   data.afme.Blue   = Math.min((data.afme.Blue   || 0) + c.fusionBlue,   INT32_MAX)
    if (c.fusionRed)    data.afme.Red    = Math.min((data.afme.Red    || 0) + c.fusionRed,    INT32_MAX)
    if (c.fusionYellow) data.afme.Yellow = Math.min((data.afme.Yellow || 0) + c.fusionYellow, INT32_MAX)
  }

  if (pack.version) { data.prvr = pack.version; data.adpvr = pack.version }

  let note = null
  const carConfig = pack.cars
  if (carConfig) {
    const carMode = carConfig.carMode || 'customizable'
    const isCustom = carMode === 'customizable' || (carMode === 'random' && usePartialSelection && Array.isArray(selectedCars) && selectedCars.length > 0)
    const hasSelection = isCustom && Array.isArray(selectedCars) && selectedCars.length > 0
    const needsCars = carMode === 'all' || (carMode === 'random' && carConfig.count > 0) || hasSelection

    if (needsCars) {
      if (!Array.isArray(data.caow)) data.caow = []
      if (typeof data.ncui !== 'number' || data.ncui < data.caow.length) data.ncui = data.caow.length

      const ownedCrdbs = new Set(data.caow.map(c => c.crdb).filter(Boolean))
      const allColors = !!(carConfig.allColors)
      // For all-colors mode: dedup by crdb|paid so each color variant is independent
      const ownedPairs = allColors
        ? new Set(data.caow.map(c => (c.crdb && c.paid != null) ? c.crdb + '|' + c.paid : null).filter(Boolean))
        : null
      const maxed = carConfig.condition === 'maxed'

      function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]]
        }
        return arr
      }

      // DB cars store URLs inside colors[] — flatten to first color for server-side picks
      function dbCarFlat(car) {
        const col = (car.colors && car.colors[0]) || {}
        return { crdb: car.crdb, name: car.name, stockTxtUrl: col.stockTxtUrl || '', maxedTxtUrl: col.maxedTxtUrl || null }
      }

      // Expand all color variants of a car into separate entries
      function dbCarAllColors(car) {
        return (car.colors || []).map(col => ({
          crdb: car.crdb,
          name: car.name + (col.name ? ' – ' + col.name : ''),
          stockTxtUrl: col.stockTxtUrl || '',
          maxedTxtUrl: col.maxedTxtUrl || null,
        }))
      }

      let toAdd = []
      if (carMode === 'all') {
        const db = loadCsr2Cars()
        if (allColors) {
          // Include every color variant; post-filter by crdb|paid after fetch
          toAdd = db.filter(car => car.crdb).flatMap(dbCarAllColors)
        } else {
          toAdd = db.filter(car => car.crdb && !ownedCrdbs.has(car.crdb)).map(dbCarFlat)
        }
      } else if (carMode === 'random' && !isCustom) {
        const db = loadCsr2Cars()
        const available = shuffle(db.filter(car => car.crdb && !ownedCrdbs.has(car.crdb)).map(dbCarFlat))
        toAdd = available.slice(0, carConfig.count)
      } else {
        // customizable (or random with partial selection) — selectedCars come from client
        if (allowDuplicates) {
          toAdd = selectedCars.filter(car => car.crdb).slice(0, carConfig.count)
        } else {
          const unique = selectedCars.filter(car => car.crdb && !ownedCrdbs.has(car.crdb))
          if (unique.length < carConfig.count) {
            // backfill duplicate slots with random cars from DB
            const db = loadCsr2Cars()
            const selectedSet = new Set(unique.map(c => c.crdb))
            const available = shuffle(db.filter(car => car.crdb && !ownedCrdbs.has(car.crdb) && !selectedSet.has(car.crdb)).map(dbCarFlat))
            toAdd = [...unique, ...available.slice(0, carConfig.count - unique.length)]
          } else {
            toAdd = unique.slice(0, carConfig.count)
          }
        }
      }

      // Fetch car JSONs — batches of 10, no inter-batch delay on first pass,
      // retry failed up to 3 rounds with 3s gap between rounds
      const BATCH = 10
      const MAX_RETRIES = 3
      const RETRY_DELAY = 3000

      function setProgress(msg) {
        const job = applyJobs.get(jobId)
        if (job) job.progress = msg
      }

      async function fetchBatch(cars, offset, total) {
        const results = []
        let soFar = offset
        for (let i = 0; i < cars.length; i += BATCH) {
          const batch = cars.slice(i, i + BATCH)
          const batchResults = await Promise.all(batch.map(async (car) => {
            try {
              const txtUrl = maxed ? (car.maxedTxtUrl || car.stockTxtUrl) : car.stockTxtUrl
              if (!txtUrl) throw new Error('no txtUrl')
              const txt = await fetchRawGithub(txtUrl)
              return { ok: true, carJson: JSON.parse(txt), crdb: car.crdb }
            } catch (e) {
              return { ok: false, crdb: car.crdb, car }
            }
          }))
          results.push(...batchResults)
          soFar += batchResults.filter(r => r.ok).length
          setProgress('Fetching car data... ' + soFar + ' / ' + total)
        }
        return results
      }

      setProgress('Fetching car data... 0 / ' + toAdd.length)
      let fetched = await fetchBatch(toAdd, 0, toAdd.length)
      let done = fetched.filter(r => r.ok).length

      for (let round = 1; round <= MAX_RETRIES; round++) {
        const failed = fetched.filter(r => !r.ok).map(r => r.car).filter(Boolean)
        if (failed.length === 0) break
        setProgress('Retrying ' + failed.length + ' failed... (' + round + '/' + MAX_RETRIES + ')')
        await new Promise(r => setTimeout(r, RETRY_DELAY))
        const retried = await fetchBatch(failed, done, toAdd.length)
        const retriedMap = new Map(retried.map(r => [r.crdb, r]))
        fetched = fetched.map(r => (!r.ok && retriedMap.has(r.crdb)) ? retriedMap.get(r.crdb) : r)
        done = fetched.filter(r => r.ok).length
        setProgress('Fetched ' + done + ' / ' + toAdd.length)
      }

      let added = 0
      for (const r of fetched) {
        if (!r.ok) continue
        const alreadyOwned = allColors
          ? ownedPairs.has(r.carJson.crdb + '|' + (r.carJson.paid != null ? r.carJson.paid : ''))
          : ownedCrdbs.has(r.crdb)
        if (allowDuplicates || !alreadyOwned) {
          r.carJson.unid = data.ncui
          data.ncui++
          data.caow.push(r.carJson)
          if (!allowDuplicates) {
            if (allColors) ownedPairs.add(r.carJson.crdb + '|' + (r.carJson.paid != null ? r.carJson.paid : ''))
            else ownedCrdbs.add(r.crdb)
          }
          added++
        }
      }

      // Rebuild garage position index — must always be [0..ncui-1, -1]
      data.cgpi = [...Array(data.ncui).keys(), -1]

      const expected = carMode === 'all' ? toAdd.length : (carConfig.count || toAdd.length)
      const remaining = expected - added
      if (remaining > 0) {
        note = added + ' car(s) added. ' + remaining + ' could not be fetched from GitHub.'
      } else if (added > 0) {
        note = added + ' car(s) added.'
      }
    }
  }

  // Stage 6 — replaces cues entirely
  if (applyStage6 && pack.stage6 && pack.stage6.mode === 'all') {
    const stage6Data = loadStage6Data()
    if (Array.isArray(stage6Data) && stage6Data.length > 0) {
      const amt = pack.stage6.amount || null
      data.cues = amt !== null
        ? stage6Data.map(entry => typeof entry === 'number' ? amt : entry)
        : stage6Data
    }
  } else if (applyStage6 && pack.stage6 && pack.stage6.mode === 'customizable') {
    const stage6Data = loadStage6Data()
    if (Array.isArray(stage6Data) && stage6Data.length > 0 && Array.isArray(opts.selectedS6Cars) && opts.selectedS6Cars.length > 0) {
      const selectedSet = new Set(opts.selectedS6Cars)
      const filtered = []
      let i = 0
      while (i < stage6Data.length) {
        const entry = stage6Data[i]
        if (typeof entry === 'object' && entry !== null) {
          const next = stage6Data[i + 1]
          if (entry.esdb && selectedSet.has(entry.esdb)) {
            filtered.push(entry)
            if (typeof next === 'number') filtered.push(next)
          }
          i += (typeof next === 'number') ? 2 : 1
        } else { i++ }
      }
      if (filtered.length > 0) data.cues = filtered
    }
  }

  // Fusions — replaces caup entirely with the cached array (optionally replacing amounts)
  if (applyFusions && pack.fusions && pack.fusions.mode === 'all') {
    const fusionData = loadFusionData()
    if (Array.isArray(fusionData) && fusionData.length > 0) {
      const amt = pack.fusions.amount || null
      data.caup = amt !== null
        ? fusionData.map(entry => typeof entry === 'number' ? amt : entry)
        : fusionData
    }
  } else if (applyFusions && pack.fusions && pack.fusions.mode === 'customizable') {
    const fusionData = loadFusionData()
    if (Array.isArray(fusionData) && fusionData.length > 0 && Array.isArray(opts.selectedBrands) && opts.selectedBrands.length > 0) {
      const selectedSet = new Set(opts.selectedBrands)
      const filtered = []
      let i = 0
      while (i < fusionData.length) {
        const entry = fusionData[i]
        if (typeof entry === 'object' && entry !== null) {
          const next = fusionData[i + 1]
          const brandId = entry.upma || ''
          const isSelected = selectedSet.has(brandId)
          if (isSelected) {
            filtered.push(entry)
            if (typeof next === 'number') filtered.push(next)
          }
          i += (typeof next === 'number') ? 2 : 1
        } else {
          i++
        }
      }
      if (filtered.length > 0) data.caup = filtered
    }
  }

  // Legends (crpe = legend restoration token amounts)
  if (applyLegends && pack.legends) {
    if (!data.crpe) data.crpe = {}
    if (pack.legends.mode === 'all') {
      for (const lc of LEGEND_CARS) {
        data.crpe[lc.crdb] = lc.amount
      }
    } else if (pack.legends.mode === 'customizable') {
      if (Array.isArray(opts.selectedLegends) && opts.selectedLegends.length > 0) {
        const count = Math.min(pack.legends.count || 0, opts.selectedLegends.length)
        for (let i = 0; i < count; i++) {
          const lc = LEGEND_CARS.find(l => l.crdb === opts.selectedLegends[i])
          if (lc) data.crpe[lc.crdb] = lc.amount
        }
      } else {
        // fallback: random selection
        const shuffled = [...LEGEND_CARS].sort(() => Math.random() - 0.5)
        const count = Math.min(pack.legends.count || 0, LEGEND_CARS.length)
        for (let i = 0; i < count; i++) {
          data.crpe[shuffled[i].crdb] = shuffled[i].amount
        }
      }
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
input[type=text],input[type=password],input[type=number],textarea,select{width:100%;padding:9px 12px;background:var(--surf2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none;transition:border-color .15s;font-family:inherit}
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
.file-drop{border:2px dashed var(--border);border-radius:10px;padding:24px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s,padding .15s}
.file-drop:hover,.file-drop.over{border-color:var(--accent);background:rgba(126,101,81,.08)}
.file-drop.has-file{padding:10px 14px;border-style:solid;border-color:var(--accent);background:rgba(126,101,81,.07);cursor:default;text-align:left}
.file-drop-label{font-size:13px;color:var(--muted)}
.file-drop-name{font-size:12px;color:var(--accent);margin-top:6px;font-weight:500}
.file-drop.has-file .file-drop-name{margin-top:0;color:var(--text)}
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
.ap-modal{display:flex;flex-direction:column;max-height:88vh;overflow:hidden;padding:0!important;width:860px;max-width:92vw}
.ap-body{padding:20px;overflow-y:auto;flex:1;min-height:260px;display:flex;flex-direction:column;gap:14px}
.ap-cars-body{padding:0;overflow:hidden;flex:1;display:flex;min-height:400px}
.ap-cars-left{flex:1;min-width:0;padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
.ap-cars-right{width:260px;border-left:1px solid var(--border);display:flex;flex-direction:column;padding:16px;gap:10px;overflow-y:auto}
.ap-footer{padding:10px 20px 16px;border-top:1px solid var(--border);flex-shrink:0}
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
input.car-search-input{width:100%;background:var(--surf2);border:1px solid var(--border);border-radius:8px;padding:8px 12px 8px 34px;color:var(--text);font-size:13px;outline:none;box-sizing:border-box}
input.car-search-input:focus{border-color:var(--accent)}
.car-search-icon{position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none;font-size:12px;display:inline-block;width:18px;text-align:center;overflow:hidden}
.car-result-list{border:1px solid var(--border);border-radius:8px;background:var(--surf2);overflow-y:auto;max-height:260px;margin-top:4px}
.car-result-item{display:flex;align-items:center;gap:8px;padding:7px 10px;font-size:12px}
.car-result-item:not(:last-child){border-bottom:1px solid rgba(255,255,255,.05)}
.car-tier-badge{font-size:10px;background:var(--surf);border:1px solid var(--border);padding:1px 5px;border-radius:4px;color:var(--muted);flex-shrink:0}
.car-result-add{background:var(--accent);border:none;color:#fff;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:11px;margin-left:auto;flex-shrink:0}
.car-result-add:hover{opacity:.8}
.car-result-added{font-size:11px;color:var(--muted);margin-left:auto;flex-shrink:0}
.selected-car-item{display:flex;align-items:center;gap:8px;padding:7px 8px;background:var(--surf2);border:1px solid var(--border);border-radius:6px;font-size:12px;overflow:hidden}
.selected-car-remove{background:none;border:none;color:var(--muted);cursor:pointer;font-size:17px;padding:0;line-height:1;margin-left:auto;flex-shrink:0}
.selected-car-remove:hover{color:var(--text)}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--muted)}
.pack-sect{background:var(--surf2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:10px}
.pack-sect-hdr{font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.cp-modal{display:flex;flex-direction:column;max-height:88vh;overflow:hidden;padding:0!important}
.cp-tab-bar{display:flex;align-items:flex-end;justify-content:space-between;padding:14px 16px 0;flex-shrink:0;gap:8px}
.cp-tabs{display:flex;gap:1px;flex-wrap:nowrap;flex:1}
.cp-tab{background:none;border:none;border-bottom:2px solid transparent;padding:7px 13px 8px;border-radius:6px 6px 0 0;color:var(--muted);cursor:pointer;font-size:12px;font-weight:600;letter-spacing:.3px;transition:color .12s,background .12s;white-space:nowrap}
.cp-tab.active{color:var(--accent);border-bottom-color:var(--accent);background:rgba(126,101,81,.09)}
.cp-tab:hover:not(.active):not(.nsb-locked){color:var(--text);background:rgba(255,255,255,.04)}
.cp-tab.nsb-locked{opacity:.35;pointer-events:none;cursor:default}
.cp-hdr-close{background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:4px 8px;border-radius:4px;line-height:1;flex-shrink:0;margin-bottom:3px}
.cp-hdr-close:hover{color:var(--text);background:rgba(255,255,255,.07)}
.cp-divider{height:1px;background:var(--border);flex-shrink:0;margin:0}
.cp-body{padding:20px;overflow-y:auto;flex:1;min-height:280px}
.cp-toggle-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}
.cp-toggle-row{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:500;background:var(--surf2);padding:10px 12px;border-radius:8px;border:1px solid var(--border)}
.cp-or-sep{display:flex;align-items:center;gap:10px;margin:14px 0;color:var(--muted);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.7px}
.cp-or-sep::before,.cp-or-sep::after{content:'';flex:1;height:1px;background:var(--border)}
.cp-pack-card{background:var(--surf2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;cursor:pointer;transition:border-color .15s,background .15s;position:relative;user-select:none}
.cp-pack-card:hover{border-color:var(--accent-hi)}
.cp-pack-card.selected{border-color:var(--accent);background:rgba(126,101,81,.12);box-shadow:0 0 0 1px var(--accent)}
.cp-pack-card-name{font-size:13px;font-weight:600;padding-right:52px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-pack-card-meta{font-size:11px;color:var(--muted);margin-top:2px}
.cp-pack-card-btns{position:absolute;top:50%;right:8px;transform:translateY(-50%);display:flex;gap:3px}
.cp-pack-card-btn{background:none;border:none;color:var(--muted);cursor:pointer;padding:3px 5px;border-radius:4px;font-size:13px;line-height:1}
.cp-pack-card-btn:hover{color:var(--text);background:rgba(255,255,255,.08)}
.cpp-modal{display:flex;flex-direction:column;max-height:90vh;overflow:hidden;padding:0!important}
.cpp-body{display:flex;flex:1;overflow:hidden;min-height:0}
.cpp-left{flex:1;display:flex;flex-direction:column;padding:16px;border-right:1px solid var(--border);overflow:hidden}
.cpp-right{width:260px;display:flex;flex-direction:column;padding:16px;gap:10px}
.cpp-right-cars{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;min-height:0}
.cpp-car-item{display:flex;align-items:center;gap:8px;background:var(--surf2);border-radius:6px;padding:6px 8px;font-size:12px}
.cpp-car-item-info{flex:1;min-width:0}
.cpp-car-item-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
.cpp-car-item-color{color:var(--muted);font-size:11px}
.cpp-remove-btn{background:none;border:none;color:var(--muted);cursor:pointer;padding:2px 4px;border-radius:3px;font-size:14px;line-height:1;flex-shrink:0}
.cpp-remove-btn:hover{color:var(--red)}
.car-filter-bar{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px}
.car-filter-chip{background:var(--surf2);border:1px solid var(--border);border-radius:20px;padding:3px 9px;font-size:11px;cursor:pointer;transition:background .15s,color .15s,border-color .15s;white-space:nowrap;color:var(--muted)}
.car-filter-chip.active{background:var(--accent);border-color:var(--accent);color:#fff}
.ensb-row{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surf2);border:1px solid var(--border);border-radius:8px}
.ensb-label{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);flex:1}
.ensb-input{width:100px;background:var(--surf);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text);font-size:13px;outline:none;text-align:right}
.ensb-input:focus{border-color:var(--accent)}
.ensb-after{font-size:13px;color:#4caf50;font-weight:600;min-width:90px;text-align:right}
.ensb-full-tab{background:none;border:none;border-bottom:2px solid transparent;color:var(--muted);cursor:pointer;font-size:13px;font-weight:500;padding:11px 14px;transition:color .15s,border-color .15s;white-space:nowrap}
.ensb-full-tab:hover{color:var(--text)}.ensb-full-tab.active{color:var(--accent);border-bottom-color:var(--accent)}
.result-icon{font-size:46px;text-align:center;margin:4px 0 10px}
.result-title{font-size:18px;font-weight:700;text-align:center;margin-bottom:6px}
.result-desc{font-size:13px;color:var(--muted);text-align:center;line-height:1.6;max-width:320px;margin:0 auto}
.confirm-desc{font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:16px}
.cars-remaining-note{margin-top:auto;padding-top:12px;border-top:1px solid var(--border);font-size:11px;color:var(--muted);line-height:1.5}
.color-swatches-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;max-height:340px;overflow-y:auto;padding-right:2px}
.color-swatch{background:var(--surf2);border:2px solid var(--border);border-radius:8px;overflow:hidden;cursor:pointer;transition:border-color .15s,transform .1s}
.color-swatch:hover{border-color:var(--accent);transform:scale(1.03)}
.color-swatch img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:var(--surf)}
.color-swatch-name{padding:4px 6px 6px;font-size:11px;text-align:center;color:var(--text);line-height:1.3}
.color-swatch.loading{opacity:.5;pointer-events:none}
.selected-car-photo{width:44px;height:30px;object-fit:cover;border-radius:4px;background:var(--surf2);flex-shrink:0}
.car-result-thumb{width:60px;height:38px;object-fit:cover;border-radius:4px;flex-shrink:0;background:var(--surf)}
.selected-car-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.selected-car-info .scar-name{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.selected-car-info .scar-color{font-size:10px;color:var(--muted)}
.cars-update-bar{background:var(--surf2);border-radius:4px;height:6px;margin:10px 0;overflow:hidden}
.cars-update-bar-fill{background:var(--accent);height:100%;width:0%;transition:width .4s}
.allow-dup-row{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;color:var(--muted)}
input[type=checkbox].chk-themed{accent-color:var(--accent);width:14px;height:14px;cursor:pointer;flex-shrink:0;margin:0}
.comp-after{color:var(--green)!important;font-weight:600}
.prev-sect-hdr{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-top:8px;margin-bottom:4px}
.upd-badge{position:absolute;top:-8px;right:-8px;background:#ef4444;color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:10px;white-space:nowrap;pointer-events:none;z-index:1;letter-spacing:.2px}
input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{opacity:.3;filter:invert(1)}
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
        <button class="btn btn-secondary btn-sm" id="cars-update-btn" onclick="openCarsUpdate()" style="display:flex;align-items:center;gap:5px;position:relative">↺ Car DB <span id="cars-db-count" style="font-size:10px;opacity:.6"></span><span class="upd-badge" id="cars-update-dot" style="display:none">Update</span></button>
        <button class="btn btn-secondary btn-sm" onclick="openCsr2Settings()">⚙ Settings</button>
        <button class="btn btn-secondary btn-sm" onclick="openEditNsbManual()">Edit NSB</button>
        <button class="btn btn-secondary btn-sm" id="sync-all-packs-btn" onclick="syncAllPacks()">↑ Sync All</button>
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
  <div class="modal cp-modal" style="width:560px;max-width:92vw">
    <div class="cp-tab-bar">
      <div class="cp-tabs">
        <button class="cp-tab active" id="cp-tab-general" onclick="cpSwitchTab('general')">General</button>
        <button class="cp-tab" id="cp-tab-currencies" onclick="cpSwitchTab('currencies')" style="display:none">Currencies</button>
        <button class="cp-tab" id="cp-tab-cars" onclick="cpSwitchTab('cars')" style="display:none">Cars</button>
        <button class="cp-tab" id="cp-tab-legends" onclick="cpSwitchTab('legends')" style="display:none">Legends</button>
        <button class="cp-tab" id="cp-tab-fusions" onclick="cpSwitchTab('fusions')" style="display:none">Fusions</button>
        <button class="cp-tab" id="cp-tab-stage6" onclick="cpSwitchTab('stage6')" style="display:none">Stage 6</button>
      </div>
      <button class="cp-hdr-close" onclick="confirmClosePack()" title="Close">✕</button>
    </div>
    <div class="cp-divider"></div>

    <div class="cp-body" id="cp-content-general">
      <div class="field" style="margin-bottom:16px">
        <label>Pack Title</label>
        <input type="text" id="cp-name" placeholder="e.g. Starter Pack">
      </div>
      <div class="section-title" style="margin-bottom:10px">Pack Contents</div>
      <div class="cp-toggle-grid">
        <div class="cp-toggle-row">
          <label class="toggle"><input type="checkbox" id="cp-toggle-currencies" onchange="cpOnToggle('currencies',this.checked)"><span class="tslider"></span></label>
          <span>💰 Currencies</span>
        </div>
        <div class="cp-toggle-row">
          <label class="toggle"><input type="checkbox" id="cp-toggle-cars" onchange="cpOnToggle('cars',this.checked)"><span class="tslider"></span></label>
          <span>🚗 Cars</span>
        </div>
        <div class="cp-toggle-row">
          <label class="toggle"><input type="checkbox" id="cp-toggle-legends" onchange="cpOnToggle('legends',this.checked)"><span class="tslider"></span></label>
          <span>⭐ Legend Tokens</span>
        </div>
        <div class="cp-toggle-row">
          <label class="toggle"><input type="checkbox" id="cp-toggle-fusions" onchange="cpOnToggle('fusions',this.checked)"><span class="tslider"></span></label>
          <span>⚗️ Fusions</span>
        </div>
        <div class="cp-toggle-row">
          <label class="toggle"><input type="checkbox" id="cp-toggle-stage6" onchange="cpOnToggle('stage6',this.checked)"><span class="tslider"></span></label>
          <span>6️⃣ Stage 6</span>
        </div>
      </div>
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
        <div class="section-title" style="margin-bottom:8px">Fusions &amp; Stage 6 Options</div>
        <div class="allow-dup-row" style="align-items:flex-start;gap:10px">
          <label class="toggle" style="flex-shrink:0;margin-top:1px"><input type="checkbox" id="cp-fusion-s6-choose-one"><span class="tslider"></span></label>
          <div>
            <div style="font-size:13px;color:var(--text)">User picks Fusions <strong>or</strong> Stage 6 — not both</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">Only applies when both are set to Customizable. User chooses one on the Pack Preview tab.</div>
          </div>
        </div>
      </div>
    </div>

    <div class="cp-body" id="cp-content-gifts" style="display:none">
      <div style="color:var(--muted);font-size:13px">Gifts configuration coming soon.</div>
    </div>

    <div class="cp-body" id="cp-content-currencies" style="display:none">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div class="section-title" style="margin:0">Currencies</div>
        <button class="btn btn-secondary btn-sm" onclick="cpClearCurrencies()">Clear All</button>
      </div>
      <div class="curr-grid" style="margin-bottom:16px">
        <div class="field"><label>💵 Cash</label><div class="field-wrap"><input type="text" id="cp-cash" placeholder="0" onblur="fmtInput(this)" onfocus="unfmtInput(this)"><span class="field-unit">$</span></div></div>
        <div class="field"><label>🪙 Gold</label><div class="field-wrap"><input type="text" id="cp-gold" placeholder="0" onblur="fmtInput(this)" onfocus="unfmtInput(this)"><span class="field-unit">G</span></div></div>
        <div class="field"><label>🔑 Bronze Keys</label><div class="field-wrap"><input type="text" id="cp-bkeys" placeholder="0" onblur="fmtInput(this)" onfocus="unfmtInput(this)"><span class="field-unit">Bk</span></div></div>
        <div class="field"><label>🗝️ Silver Keys</label><div class="field-wrap"><input type="text" id="cp-skeys" placeholder="0" onblur="fmtInput(this)" onfocus="unfmtInput(this)"><span class="field-unit">Sk</span></div></div>
        <div class="field"><label>✨ Gold Keys</label><div class="field-wrap"><input type="text" id="cp-gkeys" placeholder="0" onblur="fmtInput(this)" onfocus="unfmtInput(this)"><span class="field-unit">Gk</span></div></div>
        <div class="field"><label>⛽ Fuel</label><div class="field-wrap"><input type="text" id="cp-fuel" placeholder="0" onblur="fmtInput(this)" onfocus="unfmtInput(this)"><span class="field-unit">F</span></div></div>
      </div>
      <div class="section-title">Elite Tokens</div>
      <div class="curr-grid">
        <div class="field"><label><span class="token-dot" style="background:#4caf50"></span>Green</label><div class="field-wrap"><input type="text" id="cp-fgreen" placeholder="0" onblur="fmtInput(this)" onfocus="unfmtInput(this)"><span class="field-unit">Tk</span></div></div>
        <div class="field"><label><span class="token-dot" style="background:#2196F3"></span>Blue</label><div class="field-wrap"><input type="text" id="cp-fblue" placeholder="0" onblur="fmtInput(this)" onfocus="unfmtInput(this)"><span class="field-unit">Tk</span></div></div>
        <div class="field"><label><span class="token-dot" style="background:#e05252"></span>Red</label><div class="field-wrap"><input type="text" id="cp-fred" placeholder="0" onblur="fmtInput(this)" onfocus="unfmtInput(this)"><span class="field-unit">Tk</span></div></div>
        <div class="field"><label><span class="token-dot" style="background:#FFC107"></span>Yellow</label><div class="field-wrap"><input type="text" id="cp-fyellow" placeholder="0" onblur="fmtInput(this)" onfocus="unfmtInput(this)"><span class="field-unit">Tk</span></div></div>
      </div>
    </div>

    <div class="cp-body" id="cp-content-cars" style="display:none">
      <div class="field" style="margin-bottom:16px">
        <label>Selection Mode</label>
        <select id="cp-car-mode" onchange="onCarModeChange()">
          <option value="random">Random</option>
          <option value="customizable">Customizable (User Picks)</option>
          <option value="all">All available</option>
        </select>
      </div>

      <!-- Random section -->
      <div id="cp-random-section">
        <div class="section-title" style="margin-bottom:8px">Random Cars</div>
        <div class="curr-grid" style="margin-bottom:12px">
          <div class="field"><label>Count</label><input type="number" id="cp-car-count" placeholder="e.g. 60" min="1"></div>
          <div class="field"><label>Condition</label><select id="cp-car-condition"><option value="stock">Stock</option><option value="maxed">Maxed</option></select></div>
        </div>
        <div class="allow-dup-row" style="margin-bottom:0">
          <label class="toggle" style="flex-shrink:0"><input type="checkbox" id="cp-partial-toggle" onchange="onPartialToggle()"><span class="tslider"></span></label>
          <span style="font-weight:500;color:var(--text)">Allow Partial Selection</span>
        </div>
        <div id="cp-partial-section" style="display:none;margin-top:12px">
          <div class="cp-or-sep">OR</div>
          <div class="section-title" style="margin-bottom:8px">Partial Selection</div>
          <div class="curr-grid">
            <div class="field"><label>Count</label><input type="number" id="cp-partial-count" placeholder="e.g. 20" min="1"></div>
            <div class="field"><label>Condition</label><select id="cp-partial-condition"><option value="stock">Stock</option><option value="maxed">Maxed</option></select></div>
          </div>
        </div>
      </div>

      <!-- Customizable section -->
      <div id="cp-customizable-section" style="display:none">
        <div class="section-title" style="margin-bottom:8px">Customizable Cars</div>
        <div class="curr-grid">
          <div class="field"><label>Count</label><input type="number" id="cp-custom-count" placeholder="e.g. 100" min="1"></div>
          <div class="field"><label>Condition</label><select id="cp-custom-condition"><option value="stock">Stock</option><option value="maxed">Maxed</option></select></div>
        </div>
      </div>

      <!-- All section -->
      <div id="cp-all-section" style="display:none">
        <div class="section-title" style="margin-bottom:8px">All Available Cars</div>
        <div class="field" style="margin-bottom:10px">
          <label>Condition</label>
          <select id="cp-all-condition"><option value="stock">Stock</option><option value="maxed">Maxed</option></select>
        </div>
        <label class="allow-dup-row" style="cursor:pointer;margin-bottom:0">
          <input type="checkbox" id="cp-all-colors">
          <span>Include all color variants per car</span>
        </label>
      </div>

      <!-- Car Packs (shown for random+partial or customizable) -->
      <div id="cp-car-packs-section" style="display:none;margin-top:16px">
        <div style="height:1px;background:var(--border);margin-bottom:16px"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span class="section-title" style="margin:0">Car Packs <span id="cp-car-packs-hint" style="color:var(--muted);font-weight:400;text-transform:none;font-size:10px;letter-spacing:0">— click to include</span></span>
          <button class="btn btn-secondary btn-sm" onclick="openCreateCarPack()">+ Create</button>
        </div>
        <div id="cp-car-packs-list" style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow-y:auto"></div>
        <div id="cp-car-packs-empty" style="font-size:12px;color:var(--muted);text-align:center;padding:16px 0;display:none">No car packs yet. Create one above.</div>
      </div>
    </div>

    <div class="cp-body" id="cp-content-legends" style="display:none">
      <div style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:10px">Mode</div>
        <div style="display:flex;gap:10px">
          <label id="cp-legends-all-wrap" style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:8px;transition:border-color .15s">
            <input type="radio" name="cp-legends-mode" id="cp-legends-all" value="all" onchange="onLegendsToggle('all')" style="accent-color:var(--accent);width:16px;height:16px;flex-shrink:0">
            <div>
              <div style="font-weight:600;font-size:13px">Add All</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">Restore all 26 classic cars</div>
            </div>
          </label>
          <label id="cp-legends-custom-wrap" style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:8px;transition:border-color .15s">
            <input type="radio" name="cp-legends-mode" id="cp-legends-custom" value="customizable" onchange="onLegendsToggle('customizable')" style="accent-color:var(--accent);width:16px;height:16px;flex-shrink:0">
            <div>
              <div style="font-weight:600;font-size:13px">Customizable</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">Buyer picks how many (up to 26)</div>
            </div>
          </label>
        </div>
      </div>
      <div id="cp-legends-all-section" style="display:none">
        <div class="section-title" style="margin-bottom:8px">All 26 Legend Cars</div>
        <div style="max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px 8px" id="cp-legends-all-list"></div>
      </div>
      <div id="cp-legends-custom-section" style="display:none">
        <div class="field">
          <label>Count <span style="font-size:11px;color:var(--muted);font-weight:400">(1–26)</span></label>
          <input type="number" id="cp-legends-count" placeholder="e.g. 10" min="1" max="26">
        </div>
      </div>
    </div>

    <div class="cp-body" id="cp-content-fusions" style="display:none">
      <div style="display:flex;gap:10px;margin-bottom:16px">
        <label class="toggle-card" id="cp-fusions-all-card" onclick="onFusionsModeClick('all')" style="flex:1;cursor:pointer;padding:10px 14px;background:var(--surf2);border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;gap:10px">
          <input type="radio" name="cp-fusions-mode" id="cp-fusions-all" value="all" style="accent-color:var(--accent)">
          <div><div style="font-weight:600;font-size:13px">Add All Fusions</div><div style="font-size:11px;color:var(--muted);margin-top:2px">All fusion parts for all cars</div></div>
        </label>
        <label class="toggle-card" id="cp-fusions-custom-card" onclick="onFusionsModeClick('customizable')" style="flex:1;cursor:pointer;padding:10px 14px;background:var(--surf2);border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;gap:10px">
          <input type="radio" name="cp-fusions-mode" id="cp-fusions-custom" value="customizable" style="accent-color:var(--accent)">
          <div><div style="font-weight:600;font-size:13px">Customizable</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Buyer picks brand(s)</div></div>
        </label>
      </div>
      <div id="cp-fusions-all-opts" style="display:none;margin-bottom:14px">
        <div class="field"><label>Parts per fusion slot <span style="font-size:11px;color:var(--muted);font-weight:400">(max 300)</span></label><input type="number" id="cp-fusions-amount" placeholder="e.g. 100" min="1" max="300"></div>
      </div>
      <div id="cp-fusions-custom-opts" style="display:none;margin-bottom:14px">
        <div class="curr-grid">
          <div class="field"><label>Fusion Count <span style="font-size:11px;color:var(--muted);font-weight:400">(max 100)</span></label><input type="number" id="cp-fusions-count" placeholder="e.g. 50" min="1" max="100"></div>
          <div class="field"><label>Brand Picks</label><input type="number" id="cp-fusions-brand-amount" placeholder="e.g. 3" min="1"></div>
        </div>
      </div>
      <div id="cp-fusions-data-row" style="background:var(--surf2);border:1px solid var(--border);border-radius:8px;padding:10px 14px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:12px;font-weight:600;margin-bottom:3px">Fusion Data</div>
            <div id="cp-fusions-data-status" style="font-size:11px;color:var(--muted)">Checking...</div>
          </div>
          <button class="btn btn-secondary btn-sm" id="fusions-update-btn" onclick="openFusionsUpdate()" style="position:relative">Update<span class="upd-badge" id="fusions-update-dot" style="display:none">Update</span></button>
        </div>
      </div>
    </div>

    <div class="cp-body" id="cp-content-stage6" style="display:none">
      <div style="display:flex;gap:10px;margin-bottom:16px">
        <label class="toggle-card" id="cp-stage6-all-card" onclick="onStage6ModeClick('all')" style="flex:1;cursor:pointer;padding:10px 14px;background:var(--surf2);border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;gap:10px">
          <input type="radio" name="cp-stage6-mode" id="cp-stage6-all" value="all" style="accent-color:var(--accent)">
          <div><div style="font-weight:600;font-size:13px">Add All Stage 6</div><div style="font-size:11px;color:var(--muted);margin-top:2px">All Stage 6 upgrades for all cars</div></div>
        </label>
        <label class="toggle-card" id="cp-stage6-custom-card" onclick="onStage6ModeClick('customizable')" style="flex:1;cursor:pointer;padding:10px 14px;background:var(--surf2);border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;gap:10px">
          <input type="radio" name="cp-stage6-mode" id="cp-stage6-custom" value="customizable" style="accent-color:var(--accent)">
          <div><div style="font-weight:600;font-size:13px">Customizable</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Buyer picks specific car(s)</div></div>
        </label>
      </div>
      <div id="cp-stage6-all-opts" style="display:none;margin-bottom:14px">
        <div class="field"><label>Parts per Stage 6 slot <span style="font-size:11px;color:var(--muted);font-weight:400">(max 100)</span></label><input type="number" id="cp-stage6-amount" placeholder="e.g. 50" min="1" max="100"></div>
      </div>
      <div id="cp-stage6-custom-opts" style="display:none;margin-bottom:14px">
        <div class="curr-grid">
          <div class="field"><label>Car Count <span style="font-size:11px;color:var(--muted);font-weight:400">How many cars buyer can pick</span></label><input type="number" id="cp-stage6-count" placeholder="e.g. 5" min="1" max="50"></div>
        </div>
      </div>
      <div id="cp-stage6-data-row" style="background:var(--surf2);border:1px solid var(--border);border-radius:8px;padding:10px 14px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:12px;font-weight:600;margin-bottom:3px">Stage 6 Data</div>
            <div id="cp-stage6-data-status" style="font-size:11px;color:var(--muted)">Checking...</div>
          </div>
          <button class="btn btn-secondary btn-sm" id="stage6-update-btn" onclick="openStage6Update()" style="position:relative">Update<span class="upd-badge" id="stage6-update-dot" style="display:none">Update</span></button>
        </div>
      </div>
    </div>

    <div id="cp-notice" style="display:none;margin:0 20px"></div>
    <div class="cp-divider"></div>
    <div class="modal-actions" style="padding:14px 16px;margin:0">
      <button class="btn btn-secondary" onclick="confirmClosePack()">Close</button>
      <button class="btn btn-primary" onclick="savePack()" id="cp-save-btn">Save Pack</button>
    </div>
  </div>
</div>

<!-- Confirm Close Pack Modal -->
<div class="modal-bg" id="confirm-close-pack-modal" style="z-index:200">
  <div class="modal" style="max-width:380px">
    <div class="modal-title">Discard Pack?</div>
    <p class="confirm-desc">All entered values will be cleared and nothing will be saved.</p>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="hideModal('confirm-close-pack-modal')">Keep Editing</button>
      <button class="btn btn-danger" onclick="forceClosePack()">Discard & Close</button>
    </div>
  </div>
</div>

<!-- Pack Saved Modal -->
<div class="modal-bg" id="pack-saved-modal" style="z-index:200">
  <div class="modal" style="max-width:480px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
      <div class="modal-title" style="margin:0">Pack Saved</div>
      <span style="font-size:15px;color:#4caf50">✓</span>
    </div>
    <div style="font-size:15px;font-weight:700;margin-bottom:14px;color:var(--accent)" id="cp-saved-name"></div>
    <div id="cp-saved-summary"></div>
    <div class="modal-actions" style="margin-top:16px">
      <button class="btn btn-primary" onclick="hideModal('pack-saved-modal')">Done</button>
    </div>
  </div>
</div>

<!-- Create Car Pack Modal -->
<div class="modal-bg" id="create-car-pack-modal" style="z-index:150">
  <div class="modal cpp-modal" style="max-width:860px;width:95vw">
    <div class="cp-tab-bar" style="padding-bottom:12px">
      <div>
        <div style="font-size:15px;font-weight:600" id="cpp-modal-title">Create Car Pack</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px" id="cpp-subtitle">Select cars to include</div>
      </div>
      <button class="cp-hdr-close" onclick="closeCreateCarPack()" title="Close">✕</button>
    </div>
    <div class="cp-divider"></div>
    <div class="cpp-body">
      <!-- Left: car search -->
      <div class="cpp-left">
        <div class="allow-dup-row" style="margin-bottom:10px">
          <input type="checkbox" class="chk-themed" id="cpp-allow-dup" onchange="_cppAllowDupes=this.checked;searchCppCars(document.getElementById('cpp-car-search').value);updateCppSubtitle()">
          <span style="color:var(--text)">Allow Duplicates</span>
        </div>
        <div class="car-search-wrap" style="margin-bottom:8px">
          <span class="car-search-icon" style="font-size:13px;top:50%;transform:translateY(-50%);left:10px">🔍</span>
          <input type="text" class="car-search-input" id="cpp-car-search" placeholder="Search by name or brand..." oninput="searchCppCars(this.value)">
        </div>
        <div id="cpp-car-results" style="flex:1;overflow-y:auto"></div>
      </div>
      <!-- Right: pack being built -->
      <div class="cpp-right">
        <div class="field" style="margin-bottom:0">
          <label>Pack Name</label>
          <input type="text" id="cpp-pack-name" placeholder="e.g. Rosso Imperiale">
        </div>
        <div style="font-size:12px;color:var(--muted)" id="cpp-count-label">0 cars</div>
        <div class="cpp-right-cars" id="cpp-selected-list">
          <div style="font-size:12px;color:var(--muted);text-align:center;margin-top:20px">No cars yet.<br>Search and add on the left.</div>
        </div>
        <div id="cpp-notice" style="display:none"></div>
        <button class="btn btn-primary" onclick="saveCarPack()" style="width:100%;margin-top:auto">Save Car Pack</button>
      </div>
    </div>
  </div>
</div>

<!-- View Car Pack Modal -->
<div class="modal-bg" id="view-car-pack-modal" style="z-index:200">
  <div class="modal" style="max-width:420px">
    <div id="view-car-pack-body"></div>
    <div class="modal-actions" style="margin-top:14px">
      <button class="btn btn-primary" onclick="hideModal('view-car-pack-modal')">Close</button>
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
<div class="modal-bg" id="apply-result-modal" style="z-index:150">
  <div class="modal" style="max-width:360px;text-align:center">
    <div class="result-icon" id="apply-result-icon">✅</div>
    <div class="result-title" id="apply-result-title">Pack Applied!</div>
    <div class="result-desc" id="apply-result-desc" style="display:none"></div>
    <div class="modal-actions" id="apply-result-actions" style="justify-content:center;margin-top:18px">
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
<div class="modal-bg" id="nsb-conflict-modal" style="z-index:150">
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
  <div class="modal" style="max-width:480px">
    <div class="modal-title">Edit NSB</div>
    <div class="modal-sub">Load a save file to manually edit values or apply unban</div>
    <div class="field">
      <label>NSB File</label>
      <label class="file-drop" id="ensb-drop" ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="handleNsbDrop(event,'ensb')">
        <input type="file" id="ensb-file" style="display:none" onchange="handleNsbFile(event,'ensb')">
        <div class="file-drop-label">Click to select or drag &amp; drop your NSB file</div>
        <div class="file-drop-name" id="ensb-file-name" style="display:none"></div>
      </label>
    </div>
    <div id="ensb-notice" style="display:none"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="hideModal('edit-nsb-modal')">Cancel</button>
      <button class="btn btn-secondary" id="ensb-unban-btn" onclick="showModal('unban-confirm-modal')" disabled style="background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.4);color:#ef4444">🚫 Unban</button>
      <button class="btn btn-primary" id="ensb-apply-btn" onclick="openEnsbEditor()" disabled>Edit NSB →</button>
    </div>
  </div>
</div>

<!-- Edit NSB Full Editor Modal -->
<div class="modal-bg" id="ensb-editor-modal" style="align-items:stretch;padding:16px">
  <div style="display:flex;width:100%;height:100%;max-width:1100px;margin:auto;background:var(--surf);border-radius:12px;border:1px solid var(--border);overflow:hidden">
    <!-- Left panel: live stats -->
    <div id="ensb-left-panel" style="width:220px;min-width:220px;background:var(--surf2);border-right:1px solid var(--border);padding:16px 14px;overflow-y:auto;display:flex;flex-direction:column"></div>
    <!-- Right area -->
    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0">
      <!-- Tab bar -->
      <div style="display:flex;align-items:flex-end;border-bottom:1px solid var(--border);background:var(--surf2);padding:0 12px;flex-shrink:0">
        <button class="ensb-full-tab active" id="ensb-tab-currency" onclick="switchEnsbTab('currency')">💵 Currency</button>
        <button class="ensb-full-tab" id="ensb-tab-garage" onclick="switchEnsbTab('garage')">🚗 Garage</button>
        <button class="ensb-full-tab" id="ensb-tab-legends" onclick="switchEnsbTab('legends')">⭐ Legends</button>
        <button class="ensb-full-tab" id="ensb-tab-fusions" onclick="switchEnsbTab('fusions')">⚗️ Fusions</button>
        <button class="ensb-full-tab" id="ensb-tab-stage6" onclick="switchEnsbTab('stage6')">6️⃣ Stage 6</button>
        <button onclick="hideModal('ensb-editor-modal')" style="margin-left:auto;background:none;border:none;color:var(--muted);cursor:pointer;font-size:20px;padding:0 4px;line-height:1;align-self:center" title="Close">✕</button>
      </div>
      <!-- Tab content -->
      <div id="ensb-tab-content" style="flex:1;overflow-y:auto;padding:18px 20px"></div>
      <!-- Footer -->
      <div style="padding:10px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;flex-shrink:0">
        <button class="btn btn-secondary" onclick="hideModal('ensb-editor-modal')">Cancel</button>
        <button class="btn btn-primary" onclick="downloadEnsbFull()">⬇ Apply &amp; Download</button>
      </div>
    </div>
  </div>
</div>

<!-- Apply NSB Modal -->
<div class="modal-bg" id="apply-nsb-modal">
  <div class="modal ap-modal" id="ansb-outer">
    <div class="cp-tab-bar">
      <div class="cp-tabs">
        <button class="cp-tab active" id="ap-tab-preview" onclick="apSwitchTab('preview')">Pack Preview</button>
        <button class="cp-tab" id="ap-tab-currencies" onclick="apSwitchTab('currencies')" style="display:none">Currencies</button>
        <button class="cp-tab" id="ap-tab-cars" onclick="apSwitchTab('cars')" style="display:none">Cars</button>
        <button class="cp-tab" id="ap-tab-legends" onclick="apSwitchTab('legends')" style="display:none">Legends</button>
        <button class="cp-tab" id="ap-tab-fusions" onclick="apSwitchTab('fusions')" style="display:none">Fusions</button>
        <button class="cp-tab" id="ap-tab-stage6" onclick="apSwitchTab('stage6')" style="display:none">Stage 6</button>
      </div>
      <button class="cp-hdr-close" onclick="hideModal('apply-nsb-modal')" title="Close">✕</button>
    </div>
    <div class="cp-divider"></div>
    <!-- Pack Preview tab -->
    <div class="ap-body" id="ap-panel-preview">
      <div id="ansb-pack-title" style="font-size:16px;font-weight:700;color:var(--accent);margin-bottom:2px"></div>
      <div id="ansb-pack-info"></div>
      <!-- Fusions vs Stage 6 choice (choose-one mode) -->
      <div id="ap-fusion-s6-choice" style="display:none;margin-top:12px;padding:12px 14px;background:var(--surf2);border:1px solid var(--border);border-radius:8px">
        <div style="font-size:12px;font-weight:600;margin-bottom:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Choose one to include:</div>
        <div style="display:flex;gap:10px">
          <label id="ap-choice-fusions-wrap" style="flex:1;cursor:pointer;padding:10px 12px;border:1px solid var(--border);border-radius:7px;display:flex;align-items:center;gap:8px;transition:border-color .15s" onclick="onFusionS6Choice('fusions')">
            <input type="radio" name="ap-fusion-s6-radio" id="ap-choice-fusions" style="accent-color:var(--accent)">
            <span style="font-size:13px;font-weight:500">⚗️ Fusions</span>
          </label>
          <label id="ap-choice-stage6-wrap" style="flex:1;cursor:pointer;padding:10px 12px;border:1px solid var(--border);border-radius:7px;display:flex;align-items:center;gap:8px;transition:border-color .15s" onclick="onFusionS6Choice('stage6')">
            <input type="radio" name="ap-fusion-s6-radio" id="ap-choice-stage6" style="accent-color:var(--accent)">
            <span style="font-size:13px;font-weight:500">6️⃣ Stage 6</span>
          </label>
        </div>
      </div>
      <div class="field" id="ansb-pack-select-row" style="display:none;margin-bottom:0">
        <label>Pack</label>
        <select id="ansb-pack-select" onchange="onAnsbPackSelect(this.value)"></select>
      </div>
      <div class="field" style="margin-bottom:0">
        <label>NSB File</label>
        <label class="file-drop" id="ansb-drop" ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="handleNsbDrop(event,'ansb')">
          <input type="file" id="ansb-file" style="display:none" onchange="handleNsbFile(event,'ansb')">
          <div class="file-drop-label">Click to select or drag &amp; drop your NSB file</div>
          <div class="file-drop-name" id="ansb-file-name" style="display:none"></div>
        </label>
      </div>
    </div>
    <!-- Currencies tab -->
    <div class="ap-body" id="ap-panel-currencies" style="display:none">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:13px;font-weight:600">Currency Amounts</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" id="ap-curr-edit-btn" onclick="toggleCurrencyEdit()" style="font-size:11px;padding:3px 9px">✏️ Override</button>
          <button class="btn btn-secondary btn-sm" id="ap-curr-clear-btn" onclick="clearCurrencyOverride()" style="font-size:11px;padding:3px 9px;display:none">✕ Reset</button>
        </div>
      </div>
      <div id="ap-curr-override-warn" style="display:none;font-size:11px;color:#FFC107;margin-bottom:8px;padding:6px 10px;background:rgba(255,193,7,.08);border-radius:6px;border:1px solid rgba(255,193,7,.25)">⚠️ Amounts overridden for this apply only — pack is unchanged</div>
      <div id="ap-curr-table"></div>
      <div id="ap-curr-edit-form" style="display:none;margin-top:14px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:8px;padding:6px 0;border-top:1px solid var(--border)">Edit amounts for this apply only. Leave a field blank to use the pack default.</div>
        <div class="curr-grid" id="ap-curr-edit-grid"></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
          <button class="btn btn-secondary btn-sm" onclick="cancelCurrencyEdit()">Cancel</button>
          <button class="btn btn-primary btn-sm" onclick="saveCurrencyOverride()">Apply Override</button>
        </div>
      </div>
    </div>
    <!-- Cars tab -->
    <div class="ap-cars-body" id="ap-panel-cars" style="display:none">
      <div class="ap-cars-left">
        <div id="ap-cars-header" style="font-size:13px;color:var(--muted);margin-bottom:10px"></div>
        <div id="ap-partial-toggle-row" style="display:none;margin-bottom:10px">
          <div class="allow-dup-row">
            <input type="checkbox" class="chk-themed" id="ap-partial-sel" onchange="togglePartialSelection(this.checked)">
            <span style="color:var(--text)">Partial Selection — pick specific cars instead of random</span>
          </div>
        </div>
        <div id="ap-cars-picker" style="display:none">
          <div class="section-title" style="margin-bottom:6px;font-size:11px">Select Cars <span id="ansb-car-count-badge" style="font-weight:400;color:var(--muted);text-transform:none;font-size:11px;letter-spacing:0">(0 selected)</span></div>
          <!-- Car Packs quick-add -->
          <div id="ansb-car-packs-section" style="display:none;margin-bottom:10px">
            <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Car Packs</div>
            <div id="ansb-car-packs-list" style="display:flex;flex-direction:column;gap:6px;max-height:140px;overflow-y:auto"></div>
            <div style="height:1px;background:var(--border);margin-top:10px"></div>
          </div>
          <div id="ansb-car-locked" style="font-size:12px;color:var(--muted);padding:6px 0;display:none">📂 Upload an NSB file on the Pack Preview tab first.</div>
          <div id="ansb-car-controls" style="display:none">
            <div class="allow-dup-row">
              <input type="checkbox" class="chk-themed" id="ansb-allow-dup" onchange="toggleAllowDuplicates()">
              <span style="color:var(--text)">Allow Duplicates (show owned cars)</span>
            </div>
            <div class="car-filter-bar" id="ansb-tier-filters"></div>
            <div class="car-filter-bar" id="ansb-star-filters"></div>
            <div id="ansb-brand-filters" style="margin-bottom:4px"></div>
            <div class="car-search-wrap" style="margin-top:4px">
              <span class="car-search-icon" style="font-size:13px;top:50%;transform:translateY(-50%);left:10px">🔍</span>
              <input type="text" class="car-search-input" id="ansb-car-search" placeholder="Search by name or brand..." oninput="searchCars(this.value)">
            </div>
            <div id="ansb-car-results"></div>
          </div>
        </div>
      </div>
      <div class="ap-cars-right" id="ap-cars-right" style="display:none">
        <div style="font-weight:600;font-size:14px">Selected Cars</div>
        <div id="ansb-selected-count" style="font-size:12px;color:var(--muted);margin-top:-4px">0 cars selected</div>
        <div id="ansb-selected-cars-list" style="flex:1;display:flex;flex-direction:column;gap:6px;overflow-y:auto"></div>
        <div class="cars-remaining-note" id="ansb-cars-remaining-note" style="display:none"></div>
      </div>
    </div>
    <!-- Legends tab -->
    <div class="ap-body" id="ap-panel-legends" style="display:none">
      <div id="ap-legends-header" style="font-size:13px;color:var(--muted);margin-bottom:10px"></div>
      <div class="car-search-wrap" style="margin-bottom:8px">
        <span class="car-search-icon" style="font-size:13px;top:50%;transform:translateY(-50%);left:10px">🔍</span>
        <input type="text" class="car-search-input" id="ap-legends-search" placeholder="Search legend cars..." oninput="searchLegends(this.value)">
      </div>
      <div id="ap-legends-list" style="margin-bottom:12px"></div>
      <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;display:flex;justify-content:space-between">
        <span>Selected</span><span id="ap-legends-sel-count">0 / 0</span>
      </div>
      <div id="ap-legends-selected" style="display:flex;flex-direction:column;gap:4px"></div>
    </div>
    <!-- Fusions tab (brand picker) -->
    <div class="ap-body" id="ap-panel-fusions" style="display:none">
      <div id="ap-fusions-header" style="font-size:13px;color:var(--muted);margin-bottom:10px"></div>
      <div class="car-search-wrap" style="margin-bottom:8px">
        <span class="car-search-icon">🔍</span>
        <input type="text" class="car-search-input" id="ap-brands-search" placeholder="Search brands..." oninput="searchBrands(this.value)">
      </div>
      <div id="ap-brands-list" style="margin-bottom:10px"></div>
      <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;display:flex;justify-content:space-between">
        <span>Selected Brands</span><span id="ap-brands-sel-count">0 / 0</span>
      </div>
      <div id="ap-brands-selected" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>
    <!-- Stage 6 tab (car picker) -->
    <div class="ap-body" id="ap-panel-stage6" style="display:none">
      <div id="ap-s6-header" style="font-size:13px;color:var(--muted);margin-bottom:10px"></div>
      <div class="car-search-wrap" style="margin-bottom:8px">
        <span class="car-search-icon">🔍</span>
        <input type="text" class="car-search-input" id="ap-s6-search" placeholder="Search cars..." oninput="searchS6Cars(this.value)">
      </div>
      <div id="ap-s6-list" style="margin-bottom:10px"></div>
      <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;display:flex;justify-content:space-between">
        <span>Selected Cars</span><span id="ap-s6-sel-count">0 / 0</span>
      </div>
      <div id="ap-s6-selected" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>
    <!-- Footer -->
    <div class="ap-footer">
      <div id="ansb-notice" style="display:none"></div>
      <div class="modal-actions" style="margin-top:0">
        <button class="btn btn-secondary" onclick="hideModal('apply-nsb-modal')">Cancel</button>
        <button class="btn btn-primary" id="ansb-apply-btn" onclick="applyNsb()" disabled>Apply &amp; Download</button>
      </div>
    </div>
  </div>
</div>

<!-- Duplicate Cars Confirm Modal -->
<div class="modal-bg" id="dup-confirm-modal" style="z-index:250">
  <div class="modal" style="max-width:380px">
    <div class="modal-title">Duplicate Cars</div>
    <div class="modal-sub" id="dup-confirm-msg"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="confirmAddCarPack(false)">Skip Duplicates</button>
      <button class="btn btn-primary" onclick="confirmAddCarPack(true)">Add All</button>
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
      <label class="file-drop" id="unban-drop" ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="handleNsbDrop(event,'unban')">
        <input type="file" id="unban-file" style="display:none" onchange="handleNsbFile(event,'unban')">
        <div class="file-drop-label">Click to select or drag & drop your NSB file</div>
        <div class="file-drop-name" id="unban-file-name" style="display:none"></div>
      </label>
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
<div class="modal-bg" id="color-picker-modal" style="z-index:200">
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

<!-- Stage 6 Update Modal -->
<div class="modal-bg" id="stage6-update-modal">
  <div class="modal" style="max-width:440px">
    <div class="modal-title">Stage 6 Data</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Source: CSR2-DataBase / ##AllStage6's.txt</div>
    <div id="stage6-update-status" style="font-size:13px;color:var(--muted);margin:8px 0 4px">Click Fetch to load Stage 6 data.</div>
    <div class="cars-update-bar" style="display:none" id="stage6-update-bar"><div class="cars-update-bar-fill" id="stage6-update-bar-fill"></div></div>
    <div id="stage6-update-notice" style="display:none"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="hideModal('stage6-update-modal')" id="stage6-update-close-btn">Cancel</button>
      <button class="btn btn-primary" onclick="doStage6Update()" id="stage6-update-go-btn">Fetch & Cache</button>
    </div>
  </div>
</div>

<!-- Fusions Update Modal -->
<div class="modal-bg" id="fusions-update-modal">
  <div class="modal" style="max-width:440px">
    <div class="modal-title">Fusion Data</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Source: CSR2-DataBase / ##AllFusions.txt</div>
    <div id="fusions-update-status" style="font-size:13px;color:var(--muted);margin:8px 0 4px">Click Fetch to load fusion data.</div>
    <div class="cars-update-bar" style="display:none" id="fusions-update-bar"><div class="cars-update-bar-fill" id="fusions-update-bar-fill"></div></div>
    <div id="fusions-update-notice" style="display:none"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="hideModal('fusions-update-modal')" id="fusions-update-close-btn">Cancel</button>
      <button class="btn btn-primary" onclick="doFusionsUpdate()" id="fusions-update-go-btn">Fetch & Cache</button>
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
var _carPacks = [], _carPackCars = [], _carPackEditId = null, _selectedCarPackIds = new Set(), _cppAllowDupes = false
var _carFilter = { tier: null, brand: null, starType: null }
var _csr2OutputFolder = '', _ensbCurrent = {}, _pendingSavePack = null
var _ensbFullData = null
var _ensbEditorState = { currency: {}, garageQueue: [], legends: {}, fusions: {}, stage6: {} }
var _ensbActiveTab = 'currency'
var _currencyOverride = {}, _partialSelectionEnabled = false, _selectedLegends = []
var _nsbCurrentData = null, _applyPackRef = null, _currencyEditMode = false
var _selMode = false, _selected = new Set()
var LEGEND_CARS = [
  { crdb: 'Ferrari_250GTOClassic_1962',            name: 'Ferrari 250 GTO',                amount: 14800 },
  { crdb: 'AstonMartin_DB5Classic_1964',            name: 'Aston Martin DB5',               amount: 17400 },
  { crdb: 'MercedesBenz_300SLClassic_1954',         name: 'Mercedes-Benz 300SL',            amount: 17400 },
  { crdb: 'Shelby_Cobra427SCClassic_1965',          name: 'Shelby Cobra',                   amount: 25800 },
  { crdb: 'Chevrolet_CorvetteZR1Classic_1970',      name: 'Chevy Corvette C3',              amount: 25800, tier: 3 },
  { crdb: 'Pontiac_GTOTheJudgeClassic_1969',        name: 'Pontiac GTO',                    amount: 29600 },
  { crdb: 'Honda_NSXRClassic_1992',                 name: 'Honda NSX-R',                    amount: 36000 },
  { crdb: 'Plymouth_HemiCudaClassic_1971',          name: 'Plymouth Hemi Cuda',             amount: 38200 },
  { crdb: 'Ford_GT40MkII_1966',                     name: 'Ford GT40',                      amount: 40400, tier: 4 },
  { crdb: 'Lamborghini_CountachClassic_1988',       name: 'Lamborghini Countach',           amount: 40400 },
  { crdb: 'Porsche_CarreraGTClassic_2003',          name: 'Porsche Carrera GT',             amount: 50000, tier: 5 },
  { crdb: 'Lamborghini_MiuraSVLPClassic_1971',      name: 'Lamborghini Miura SVL',          amount: 50000, tier: 5 },
  { crdb: 'Bugatti_EB110SSClassic_1992',            name: 'Bugatti EB110',                  amount: 50000 },
  { crdb: 'Jaguar_XJ220Classic_1993',               name: 'Jaguar XJ220',                   amount: 53400 },
  { crdb: 'Ford_MustangShelbyGT350LPClassic_1965',  name: 'Ford Mustang Shelby GT350LP',    amount: 56000, tier: 5 },
  { crdb: 'Saleen_S7Classic_2004',                  name: 'Saleen S7',                      amount: 56400 },
  { crdb: 'Plymouth_SuperbirdLPClassic_1970',       name: 'Plymouth Superbird LP',          amount: 65000, tier: 5 },
  { crdb: 'Porsche_911CarreraRS27LPClassic_1973',   name: 'Porsche 911 Carrera RS27 LP',    amount: 65000 },
  { crdb: 'Datsun_240ZLPClassic_1972',              name: 'Datsun 240Z LP',                 amount: 65000 },
  { crdb: 'Dodge_ChallengerRTLPClassic_1970',       name: 'Dodge Challenger R/T Classic',   amount: 64000 },
  { crdb: 'Chevrolet_CorvetteC1LPClassic_1958',     name: 'Chevrolet Corvette C1',          amount: 70000 },
  { crdb: 'Chevrolet_NovaSSLPClassic_1970',         name: 'Chevy Nova SS Classic',          amount: 70000, tier: 5 },
  { crdb: 'Ford_EscortMk1RS2000LPClassic_1973',     name: 'Ford Escort Mk1 RS2000 Classic', amount: 70000 },
  { crdb: 'Dodge_ViperSR1LPClassic_1995',           name: 'Dodge Viper SR1 LP',             amount: 75000, tier: 5 },
  { crdb: 'Ford_MustangSVTCobraRLPClassic_1993',    name: 'Ford Mustang SVT Cobra R',       amount: 75000, tier: 5 },
  { crdb: 'Porsche_911Turbo930LPClassic_1977',      name: 'Porsche 911 Turbo (930)',        amount: 75000, tier: 5 },
]
var _debugOpen = false, _pollInterval = null
var _scanAbort = false, _multiAbort = false, _multiRunId = 0
var _previewAcct = null, _importAcct = null, _afterImportId = null
var _csr2CarsDb = [], _ownedCrdbs = new Set(), _allowDuplicates = false
var _colorPickerCar = null, _colorPickerCarIdx = -1, _selectingColor = false
var _selectedBrands = [], _brandsList = [], _selectedS6Cars = [], _s6CarsList = []
var _pendingCarPackId = null, _fusionS6Choice = null

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
  // Silently check for car DB updates and remote data updates after UI is ready
  setTimeout(checkCsr2CarsUpdate, 3000)
  setTimeout(checkFusionsUpdate, 4500)
  setTimeout(checkStage6Update, 6000)
  setTimeout(checkForDataUpdates, 7500)
  setTimeout(checkToolVersion, 9000)
}

async function checkForDataUpdates() {
  try {
    var res = await apiFetch('/csr2/updates-check', null)
    if (res && (res.fusions || res.stage6)) {
      showDataUpdateBanner(res.fusions, res.stage6)
    }
  } catch (e) {}
}

async function checkToolVersion() {
  if (!_url) return
  try {
    var res = await fetch(_url + '/api/tool-version').then(function(r){ return r.json() }).catch(function(){ return null })
    if (res && res.version && res.version !== VERSION) {
      showToolUpdateBanner(res.version)
    }
  } catch (e) {}
}

function showToolUpdateBanner(newVersion) {
  var existing = document.getElementById('tool-update-banner')
  if (existing) return
  var banner = document.createElement('div')
  banner.id = 'tool-update-banner'
  banner.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:9999;background:var(--surf2);border:1px solid var(--accent);border-radius:10px;padding:10px 14px;font-size:12px;max-width:280px;box-shadow:0 4px 20px rgba(0,0,0,.4)'
  banner.innerHTML = '<div style="font-weight:600;margin-bottom:4px">🔄 Tool Update Available</div>' +
    '<div style="color:var(--muted);margin-bottom:8px">v' + newVersion + ' is ready. Download and replace this exe.</div>' +
    '<div style="display:flex;gap:6px">' +
    '<a href="' + escH(_url) + '/aio-tool-v' + escH(newVersion) + '.exe" download class="btn btn-primary btn-sm" style="font-size:11px;padding:4px 10px;text-decoration:none">Download v' + escH(newVersion) + '</a>' +
    '<button class="btn btn-secondary btn-sm" onclick="document.getElementById(\\'tool-update-banner\\').remove()" style="font-size:11px;padding:4px 10px">Dismiss</button>' +
    '</div>'
  document.body.appendChild(banner)
}

function showDataUpdateBanner(hasFusions, hasStage6) {
  var existing = document.getElementById('data-update-banner')
  if (existing) return
  var labels = []
  if (hasFusions) labels.push('Fusions')
  if (hasStage6) labels.push('Stage 6')
  var banner = document.createElement('div')
  banner.id = 'data-update-banner'
  banner.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9999;background:var(--surf2);border:1px solid var(--accent);border-radius:10px;padding:10px 14px;font-size:12px;max-width:300px;box-shadow:0 4px 20px rgba(0,0,0,.4)'
  var btns = ''
  if (hasFusions) btns += '<button class="btn btn-primary btn-sm" onclick="document.getElementById(\\'data-update-banner\\').remove();openFusionsUpdate()" style="font-size:11px;padding:4px 10px">Update Fusions</button>'
  if (hasStage6) btns += '<button class="btn btn-primary btn-sm" onclick="document.getElementById(\\'data-update-banner\\').remove();openStage6Update()" style="font-size:11px;padding:4px 10px">Update Stage 6</button>'
  btns += '<button class="btn btn-secondary btn-sm" onclick="document.getElementById(\\'data-update-banner\\').remove()" style="font-size:11px;padding:4px 10px">Dismiss</button>'
  banner.innerHTML = '<div style="font-weight:600;margin-bottom:4px">📦 Data Update Available</div>' +
    '<div style="color:var(--muted);margin-bottom:8px">New ' + labels.join(' & ') + ' data on GitHub.</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap">' + btns + '</div>'
  document.body.appendChild(banner)
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
    puuid: d.puuid || null,
    profileIconId: d.profileIconId || null, summonerLevel: d.summonerLevel || null,
    soloRank: d.soloRank || null, flexRank: d.flexRank || null, tftRank: d.tftRank || null,
    soloPeakRank: d.soloPeakRank || null, flexPeakRank: d.flexPeakRank || null,
    soloPrevRank: d.soloPrevRank || null, flexPrevRank: d.flexPrevRank || null,
    rp: d.rp ?? null, be: d.be ?? null,
    ownedSkinIds: d.ownedSkinIds || [], ownedChromaIds: d.ownedChromaIds || [],
    ownedEmoteIds: d.ownedEmoteIds || [], ownedIconIds: d.ownedIconIds || [],
    ownedWardIds: d.ownedWardIds || [], ownedFinisherIds: d.ownedFinisherIds || [],
    tftCompanionIds: d.tftCompanionIds || [], tftMapSkinIds: d.tftMapSkinIds || [], tftDamageSkinIds: d.tftDamageSkinIds || [],
    lootSummary: d.lootSummary || null, rankHistory: d.rankHistory || null, rankHistoryPeak: d.rankHistoryPeak || null,
    champCount: d.champCount || null, championMastery: d.championMastery || null,
    vintageSkinIds: d.vintageSkinIds || [],
    accountCreatedEstimate: d.accountCreatedEstimate || null,
    firstRpPurchaseDate: d.firstRpPurchaseDate || null,
    firstRpPurchaseItemId: d.firstRpPurchaseItemId ?? null,
    firstRpPurchaseItemType: d.firstRpPurchaseItemType || null,
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
    puuid: d.puuid || null,
    profileIconId: d.profileIconId || null, summonerLevel: d.summonerLevel || null,
    soloRank: d.soloRank || null, flexRank: d.flexRank || null, tftRank: d.tftRank || null,
    soloPeakRank: d.soloPeakRank || null, flexPeakRank: d.flexPeakRank || null,
    soloPrevRank: d.soloPrevRank || null, flexPrevRank: d.flexPrevRank || null,
    rp: d.rp ?? null, be: d.be ?? null,
    ownedSkinIds: d.ownedSkinIds || [], ownedChromaIds: d.ownedChromaIds || [],
    ownedEmoteIds: d.ownedEmoteIds || [], ownedIconIds: d.ownedIconIds || [],
    ownedWardIds: d.ownedWardIds || [], ownedFinisherIds: d.ownedFinisherIds || [],
    tftCompanionIds: d.tftCompanionIds || [], tftMapSkinIds: d.tftMapSkinIds || [], tftDamageSkinIds: d.tftDamageSkinIds || [],
    lootSummary: d.lootSummary || null, rankHistory: d.rankHistory || null, rankHistoryPeak: d.rankHistoryPeak || null,
    champCount: d.champCount || null, championMastery: d.championMastery || null,
    vintageSkinIds: d.vintageSkinIds || [],
    accountCreatedEstimate: d.accountCreatedEstimate || null,
    firstRpPurchaseDate: d.firstRpPurchaseDate || null,
    firstRpPurchaseItemId: d.firstRpPurchaseItemId ?? null,
    firstRpPurchaseItemType: d.firstRpPurchaseItemType || null,
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

async function syncAllPacks() {
  var btn = document.getElementById('sync-all-packs-btn')
  if (btn) { btn.textContent = 'Syncing…'; btn.disabled = true }
  try {
    var res = await fetch('/csr2/packs/sync-all', { method: 'POST' })
    var data = await res.json()
    if (btn) btn.textContent = '✓ Synced ' + (data.synced || 0)
  } catch (e) {
    if (btn) btn.textContent = '✗ Failed'
  }
  setTimeout(function() {
    if (btn) { btn.textContent = '↑ Sync All'; btn.disabled = false }
  }, 3000)
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
    html += '<button class="ov-btn ov-preview" data-pid="' + p.id + '" onclick="openEditPack(this.dataset.pid)">Edit Pack</button>'
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
    var carsLabel = p.cars.carMode === 'all'
      ? 'All available cars' + (p.cars.allColors ? ' · All colors' : '') + (p.cars.condition === 'maxed' ? ' · Maxed' : '')
      : fmtN(p.cars.count) + ' cars · ' + p.cars.carMode + (p.cars.condition === 'maxed' ? ' · Maxed' : '')
    rows.push('<div class="pack-meta-row"><span>' + escH(carsLabel) + '</span></div>')
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

var _cpCurrentTab = 'general'

function cpSwitchTab(tab) {
  _cpCurrentTab = tab
  var tabs = ['general', 'currencies', 'cars', 'legends', 'fusions', 'stage6', 'gifts']
  for (var i = 0; i < tabs.length; i++) {
    var btn = document.getElementById('cp-tab-' + tabs[i])
    var body = document.getElementById('cp-content-' + tabs[i])
    if (btn) btn.classList.toggle('active', tabs[i] === tab)
    if (body) body.style.display = tabs[i] === tab ? '' : 'none'
  }
  if (tab === 'fusions') refreshFusionsDataStatus()
  if (tab === 'stage6') refreshStage6DataStatus()
}

function cpOnToggle(tab, on) {
  var btn = document.getElementById('cp-tab-' + tab)
  if (btn) btn.style.display = on ? '' : 'none'
  if (!on && _cpCurrentTab === tab) cpSwitchTab('general')
}

function fmtInput(el) {
  var raw = el.value.replace(/[^0-9]/g, '')
  if (!raw) { el.value = ''; return }
  var num = parseInt(raw, 10)
  if (!isNaN(num) && num > 0) el.value = num.toLocaleString('en-US')
}

function unfmtInput(el) {
  el.value = el.value.replace(/,/g, '')
}

function cpClearCurrencies() {
  var fields = ['cp-cash','cp-gold','cp-bkeys','cp-skeys','cp-gkeys','cp-fuel','cp-fgreen','cp-fblue','cp-fred','cp-fyellow']
  for (var i = 0; i < fields.length; i++) document.getElementById(fields[i]).value = ''
}

function confirmClosePack() {
  showModal('confirm-close-pack-modal')
}

function forceClosePack() {
  hideModal('confirm-close-pack-modal')
  resetCpModal()
  hideModal('create-pack-modal')
}

function resetCpModal() {
  _editingPackId = null
  _selectedCarPackIds = new Set()
  document.getElementById('cp-name').value = ''
  document.getElementById('cp-fusion-s6-choose-one').checked = false
  cpClearCurrencies()
  // reset all car fields
  var carFields = ['cp-car-count','cp-car-condition','cp-car-mode','cp-custom-count','cp-custom-condition','cp-all-condition','cp-partial-count','cp-partial-condition']
  for (var i = 0; i < carFields.length; i++) {
    var el = document.getElementById(carFields[i])
    if (!el) continue
    if (el.tagName === 'SELECT') el.value = el.options[0].value
    else el.value = ''
  }
  document.getElementById('cp-all-colors').checked = false
  document.getElementById('cp-partial-toggle').checked = false
  onCarModeChange()
  // reset legend fields
  var lcAll = document.getElementById('cp-legends-all')
  var lcCustom = document.getElementById('cp-legends-custom')
  if (lcAll) lcAll.checked = false
  if (lcCustom) lcCustom.checked = false
  document.getElementById('cp-legends-all-section').style.display = 'none'
  document.getElementById('cp-legends-custom-section').style.display = 'none'
  document.getElementById('cp-legends-count').value = ''
  // reset fusions fields
  document.getElementById('cp-fusions-all').checked = false
  document.getElementById('cp-fusions-custom').checked = false
  document.getElementById('cp-fusions-amount').value = ''
  document.getElementById('cp-fusions-count').value = ''
  document.getElementById('cp-fusions-brand-amount').value = ''
  document.getElementById('cp-fusions-all-opts').style.display = 'none'
  document.getElementById('cp-fusions-custom-opts').style.display = 'none'
  // reset stage6 fields
  document.getElementById('cp-stage6-all').checked = false
  document.getElementById('cp-stage6-custom').checked = false
  document.getElementById('cp-stage6-amount').value = ''
  document.getElementById('cp-stage6-count').value = ''
  document.getElementById('cp-stage6-all-opts').style.display = 'none'
  document.getElementById('cp-stage6-custom-opts').style.display = 'none'
  var sections = ['currencies', 'cars', 'legends', 'fusions', 'stage6', 'gifts']
  for (var i = 0; i < sections.length; i++) {
    var toggle = document.getElementById('cp-toggle-' + sections[i])
    if (toggle) toggle.checked = false
    cpOnToggle(sections[i], false)
  }
  hideNotice('cp-notice')
  cpSwitchTab('general')
}

function onCarModeChange() {
  var mode = document.getElementById('cp-car-mode').value
  var sections = { random: 'cp-random-section', customizable: 'cp-customizable-section', all: 'cp-all-section' }
  for (var key in sections) {
    var el = document.getElementById(sections[key])
    if (el) el.style.display = key === mode ? '' : 'none'
  }
  var packsSection = document.getElementById('cp-car-packs-section')
  if (packsSection) {
    var showPacks = mode === 'customizable' || (mode === 'random' && document.getElementById('cp-partial-toggle').checked)
    packsSection.style.display = showPacks ? '' : 'none'
  }
}

function onPartialToggle() {
  var on = document.getElementById('cp-partial-toggle').checked
  var partialSection = document.getElementById('cp-partial-section')
  if (partialSection) partialSection.style.display = on ? '' : 'none'
  var packsSection = document.getElementById('cp-car-packs-section')
  if (packsSection) packsSection.style.display = on ? '' : 'none'
}

function onLegendsToggle(which) {
  document.getElementById('cp-legends-all-section').style.display = which === 'all' ? '' : 'none'
  document.getElementById('cp-legends-custom-section').style.display = which === 'customizable' ? '' : 'none'
  if (which === 'all') {
    var list = document.getElementById('cp-legends-all-list')
    if (list && !list.innerHTML) {
      var tierMap = buildLegendTierMap()
      var html = ''
      for (var i = 0; i < LEGEND_CARS.length; i++) {
        var lc = LEGEND_CARS[i]
        var tier = tierMap[lc.crdb]
        html += '<div style="display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:5px;' + (i % 2 === 0 ? 'background:rgba(255,255,255,.04)' : '') + '">'
        if (tier) html += '<span style="font-size:10px;font-weight:700;color:var(--accent);background:rgba(255,165,0,.15);border-radius:4px;padding:1px 5px;flex-shrink:0">T' + tier + '</span>'
        html += '<span style="font-size:12px;flex:1">' + escH(lc.name) + '</span>'
        html += '<span style="font-size:11px;color:var(--muted)">' + lc.amount.toLocaleString() + ' tokens</span>'
        html += '</div>'
      }
      list.innerHTML = html
    }
  }
}

function onFusionsModeClick(mode) {
  var allRad = document.getElementById('cp-fusions-all')
  var custRad = document.getElementById('cp-fusions-custom')
  if (allRad) allRad.checked = mode === 'all'
  if (custRad) custRad.checked = mode === 'customizable'
  document.getElementById('cp-fusions-all-opts').style.display = mode === 'all' ? '' : 'none'
  document.getElementById('cp-fusions-custom-opts').style.display = mode === 'customizable' ? '' : 'none'
  refreshFusionsDataStatus()
}

function onFusionsToggle(on) {
  if (on) refreshFusionsDataStatus()
}

async function refreshFusionsDataStatus() {
  var el = document.getElementById('cp-fusions-data-status')
  if (!el) return
  try {
    var res = await apiFetch('/csr2/fusions', { count: 0 })
    el.textContent = res.count > 0 ? res.count + ' car entries cached' : 'No data — click Update to load'
    el.style.color = res.count > 0 ? 'var(--green)' : 'var(--muted)'
  } catch { el.textContent = 'Could not check' }
}

async function openFusionsUpdate() {
  var stored = await apiFetch('/csr2/fusions', { count: 0 })
  document.getElementById('fusions-update-status').textContent = stored.count > 0
    ? stored.count + ' entries currently cached. Click Fetch to refresh.'
    : 'No fusion data cached yet. Click Fetch to load.'
  document.getElementById('fusions-update-status').style.color = 'var(--muted)'
  document.getElementById('fusions-update-bar').style.display = 'none'
  hideNotice('fusions-update-notice')
  document.getElementById('fusions-update-close-btn').textContent = 'Cancel'
  document.getElementById('fusions-update-go-btn').style.display = ''
  showModal('fusions-update-modal')
}

async function doFusionsUpdate() {
  document.getElementById('fusions-update-go-btn').style.display = 'none'
  document.getElementById('fusions-update-bar').style.display = ''
  document.getElementById('fusions-update-bar-fill').style.width = '40%'
  document.getElementById('fusions-update-status').textContent = 'Fetching...'
  hideNotice('fusions-update-notice')
  try {
    var res = await fetch('/csr2/fusions-update', { method: 'POST' }).then(function(r){ return r.json() })
    document.getElementById('fusions-update-bar-fill').style.width = '100%'
    if (res.error) {
      showNotice('fusions-update-notice', 'error', res.error)
      document.getElementById('fusions-update-go-btn').style.display = ''
    } else {
      document.getElementById('fusions-update-status').textContent = 'Done! ' + res.count + ' entries loaded.'
      document.getElementById('fusions-update-close-btn').textContent = 'Close'
      var fdot = document.getElementById('fusions-update-dot')
      if (fdot) fdot.style.display = 'none'
      showNotice('fusions-update-notice', 'success', res.count + ' car fusions ready.')
      refreshFusionsDataStatus()
    }
  } catch (e) {
    showNotice('fusions-update-notice', 'error', 'Failed: ' + e.message)
    document.getElementById('fusions-update-go-btn').style.display = ''
  }
}

function onStage6ModeClick(mode) {
  var allRad = document.getElementById('cp-stage6-all')
  var custRad = document.getElementById('cp-stage6-custom')
  if (allRad) allRad.checked = mode === 'all'
  if (custRad) custRad.checked = mode === 'customizable'
  document.getElementById('cp-stage6-all-opts').style.display = mode === 'all' ? '' : 'none'
  document.getElementById('cp-stage6-custom-opts').style.display = mode === 'customizable' ? '' : 'none'
  refreshStage6DataStatus()
}

function onStage6Toggle(on) {
  if (on) refreshStage6DataStatus()
}

async function refreshStage6DataStatus() {
  var el = document.getElementById('cp-stage6-data-status')
  if (!el) return
  try {
    var res = await apiFetch('/csr2/stage6', { count: 0 })
    el.textContent = res.count > 0 ? res.count + ' car entries cached' : 'No data — click Update to load'
    el.style.color = res.count > 0 ? 'var(--green)' : 'var(--muted)'
  } catch { el.textContent = 'Could not check' }
}

async function openStage6Update() {
  var stored = await apiFetch('/csr2/stage6', { count: 0 })
  document.getElementById('stage6-update-status').textContent = stored.count > 0
    ? stored.count + ' entries currently cached. Click Fetch to refresh.'
    : 'No Stage 6 data cached yet. Click Fetch to load.'
  document.getElementById('stage6-update-status').style.color = 'var(--muted)'
  document.getElementById('stage6-update-bar').style.display = 'none'
  hideNotice('stage6-update-notice')
  document.getElementById('stage6-update-close-btn').textContent = 'Cancel'
  document.getElementById('stage6-update-go-btn').style.display = ''
  showModal('stage6-update-modal')
}

async function doStage6Update() {
  document.getElementById('stage6-update-go-btn').style.display = 'none'
  document.getElementById('stage6-update-bar').style.display = ''
  document.getElementById('stage6-update-bar-fill').style.width = '40%'
  document.getElementById('stage6-update-status').textContent = 'Fetching...'
  hideNotice('stage6-update-notice')
  try {
    var res = await fetch('/csr2/stage6-update', { method: 'POST' }).then(function(r){ return r.json() })
    document.getElementById('stage6-update-bar-fill').style.width = '100%'
    if (res.error) {
      showNotice('stage6-update-notice', 'error', res.error)
      document.getElementById('stage6-update-go-btn').style.display = ''
    } else {
      document.getElementById('stage6-update-status').textContent = 'Done! ' + res.count + ' entries loaded.'
      document.getElementById('stage6-update-close-btn').textContent = 'Close'
      var s6dot = document.getElementById('stage6-update-dot')
      if (s6dot) s6dot.style.display = 'none'
      showNotice('stage6-update-notice', 'success', res.count + ' Stage 6 entries ready.')
      refreshStage6DataStatus()
    }
  } catch (e) {
    showNotice('stage6-update-notice', 'error', 'Failed: ' + e.message)
    document.getElementById('stage6-update-go-btn').style.display = ''
  }
}

async function openCreatePack() {
  resetCpModal()
  await reloadCarPacks()
  renderCarPackCards()
  showModal('create-pack-modal')
}

async function openEditPack(packId) {
  var pack = _packs.find(function(p){ return p.id === packId })
  if (!pack) return
  resetCpModal()
  _editingPackId = packId
  document.getElementById('cp-name').value = pack.name || ''
  var c = pack.currencies || {}
  var hasCurr = !!(c.cash || c.gold || c.bronzeKeys || c.silverKeys || c.goldKeys || c.fuel || c.fusionGreen || c.fusionBlue || c.fusionRed || c.fusionYellow)
  if (hasCurr) {
    document.getElementById('cp-toggle-currencies').checked = true
    cpOnToggle('currencies', true)
    function sv(id, n) { document.getElementById(id).value = (n > 0) ? n.toLocaleString('en-US') : '' }
    sv('cp-cash',    c.cash)
    sv('cp-gold',    c.gold)
    sv('cp-bkeys',   c.bronzeKeys)
    sv('cp-skeys',   c.silverKeys)
    sv('cp-gkeys',   c.goldKeys)
    sv('cp-fuel',    c.fuel)
    sv('cp-fgreen',  c.fusionGreen)
    sv('cp-fblue',   c.fusionBlue)
    sv('cp-fred',    c.fusionRed)
    sv('cp-fyellow', c.fusionYellow)
  }
  var carsOn = !!(pack.cars)
  if (carsOn) {
    document.getElementById('cp-toggle-cars').checked = true
    cpOnToggle('cars', true)
    var cm = pack.cars.carMode || 'random'
    document.getElementById('cp-car-mode').value = cm
    if (cm === 'random') {
      document.getElementById('cp-car-count').value = pack.cars.count || ''
      document.getElementById('cp-car-condition').value = pack.cars.condition || 'stock'
      var hasPartial = !!(pack.cars.partial)
      document.getElementById('cp-partial-toggle').checked = hasPartial
      if (hasPartial) {
        document.getElementById('cp-partial-count').value = pack.cars.partial.count || ''
        document.getElementById('cp-partial-condition').value = pack.cars.partial.condition || 'stock'
      }
      if (pack.cars.selectedCarPacks) {
        _selectedCarPackIds = new Set(pack.cars.selectedCarPacks)
      }
    } else if (cm === 'customizable') {
      document.getElementById('cp-custom-count').value = pack.cars.count || ''
      document.getElementById('cp-custom-condition').value = pack.cars.condition || 'stock'
      if (pack.cars.selectedCarPacks) {
        _selectedCarPackIds = new Set(pack.cars.selectedCarPacks)
      }
    } else {
      document.getElementById('cp-all-condition').value = pack.cars.condition || 'stock'
      document.getElementById('cp-all-colors').checked = !!(pack.cars.allColors)
    }
    onCarModeChange()
  }
  var legendsOn = !!(pack.legends)
  if (legendsOn) {
    document.getElementById('cp-toggle-legends').checked = true
    cpOnToggle('legends', true)
    if (pack.legends.mode === 'all') {
      document.getElementById('cp-legends-all').checked = true
      onLegendsToggle('all')
    } else if (pack.legends.mode === 'customizable') {
      document.getElementById('cp-legends-custom').checked = true
      onLegendsToggle('customizable')
      document.getElementById('cp-legends-count').value = pack.legends.count || ''
    }
  }
  var fusionsOn = !!(pack.fusions)
  if (fusionsOn) {
    document.getElementById('cp-toggle-fusions').checked = true
    cpOnToggle('fusions', true)
    onFusionsModeClick(pack.fusions.mode || 'all')
    if (pack.fusions.mode === 'all') {
      if (pack.fusions.amount) document.getElementById('cp-fusions-amount').value = pack.fusions.amount
    } else if (pack.fusions.mode === 'customizable') {
      if (pack.fusions.count) document.getElementById('cp-fusions-count').value = pack.fusions.count
      if (pack.fusions.brandAmount) document.getElementById('cp-fusions-brand-amount').value = pack.fusions.brandAmount
    }
    refreshFusionsDataStatus()
  }
  var stage6On = !!(pack.stage6)
  if (stage6On) {
    document.getElementById('cp-toggle-stage6').checked = true
    cpOnToggle('stage6', true)
    onStage6ModeClick(pack.stage6.mode || 'all')
    if (pack.stage6.mode === 'all') {
      if (pack.stage6.amount) document.getElementById('cp-stage6-amount').value = pack.stage6.amount
    } else if (pack.stage6.mode === 'customizable') {
      if (pack.stage6.count) document.getElementById('cp-stage6-count').value = pack.stage6.count
    }
    refreshStage6DataStatus()
  }
  document.getElementById('cp-fusion-s6-choose-one').checked = pack.fusionS6Mode === 'choose-one'
  await reloadCarPacks()
  renderCarPackCards()
  showModal('create-pack-modal')
}

async function savePack() {
  var name = document.getElementById('cp-name').value.trim()
  if (!name) { showNotice('cp-notice', 'error', 'Enter a pack name.'); return }
  var currencies = {}
  if (document.getElementById('cp-toggle-currencies').checked) {
    function rv(id) { return parseInt((document.getElementById(id).value || '').replace(/,/g, ''), 10) || 0 }
    var cash = rv('cp-cash')
    var gold = rv('cp-gold')
    var bkeys = rv('cp-bkeys')
    var skeys = rv('cp-skeys')
    var gkeys = rv('cp-gkeys')
    var fuel = rv('cp-fuel')
    var fgreen = rv('cp-fgreen')
    var fblue = rv('cp-fblue')
    var fred = rv('cp-fred')
    var fyellow = rv('cp-fyellow')
    if (cash) currencies.cash = cash
    if (gold) currencies.gold = gold
    if (bkeys) currencies.bronzeKeys = bkeys
    if (skeys) currencies.silverKeys = skeys
    if (gkeys) currencies.goldKeys = gkeys
    if (fuel) currencies.fuel = fuel
    if (fgreen) currencies.fusionGreen = fgreen
    if (fblue) currencies.fusionBlue = fblue
    if (fred) currencies.fusionRed = fred
    if (fyellow) currencies.fusionYellow = fyellow
  }
  var carsOn = document.getElementById('cp-toggle-cars').checked
  var cpCarMode = document.getElementById('cp-car-mode').value
  var cars = null
  if (carsOn) {
    var selPackIds = Array.from(_selectedCarPackIds)
    if (cpCarMode === 'random') {
      var partialOn = document.getElementById('cp-partial-toggle').checked
      cars = {
        carMode: 'random',
        count: parseInt(document.getElementById('cp-car-count').value) || 0,
        condition: document.getElementById('cp-car-condition').value,
        partial: partialOn ? {
          count: parseInt(document.getElementById('cp-partial-count').value) || 0,
          condition: document.getElementById('cp-partial-condition').value
        } : null,
        selectedCarPacks: partialOn ? selPackIds : []
      }
    } else if (cpCarMode === 'customizable') {
      cars = {
        carMode: 'customizable',
        count: parseInt(document.getElementById('cp-custom-count').value) || 0,
        condition: document.getElementById('cp-custom-condition').value,
        selectedCarPacks: selPackIds
      }
    } else {
      cars = {
        carMode: 'all',
        condition: document.getElementById('cp-all-condition').value,
        allColors: document.getElementById('cp-all-colors').checked
      }
    }
  }
  var legendsOn = document.getElementById('cp-toggle-legends').checked
  var legends = null
  if (legendsOn) {
    var legendModeEl = document.querySelector('input[name="cp-legends-mode"]:checked')
    if (legendModeEl) {
      if (legendModeEl.value === 'all') {
        legends = { mode: 'all' }
      } else {
        legends = { mode: 'customizable', count: Math.min(26, parseInt(document.getElementById('cp-legends-count').value) || 0) }
      }
    }
  }
  var fusionsOn = document.getElementById('cp-toggle-fusions').checked
  var fusions = null
  if (fusionsOn) {
    var fusAllRad = document.getElementById('cp-fusions-all')
    var fusCustRad = document.getElementById('cp-fusions-custom')
    if (fusAllRad && fusAllRad.checked) {
      var fusAmt = parseInt(document.getElementById('cp-fusions-amount').value) || null
      fusions = { mode: 'all', amount: fusAmt }
    } else if (fusCustRad && fusCustRad.checked) {
      fusions = {
        mode: 'customizable',
        count: parseInt(document.getElementById('cp-fusions-count').value) || 0,
        brandAmount: parseInt(document.getElementById('cp-fusions-brand-amount').value) || 1
      }
    }
  }
  var stage6On = document.getElementById('cp-toggle-stage6').checked
  var stage6 = null
  if (stage6On) {
    var s6AllRad = document.getElementById('cp-stage6-all')
    var s6CustRad = document.getElementById('cp-stage6-custom')
    if (s6AllRad && s6AllRad.checked) {
      var s6Amt = parseInt(document.getElementById('cp-stage6-amount').value) || null
      stage6 = { mode: 'all', amount: s6Amt }
    } else if (s6CustRad && s6CustRad.checked) {
      stage6 = {
        mode: 'customizable',
        count: parseInt(document.getElementById('cp-stage6-count').value) || 0,
      }
    }
  }
  var fusionS6Mode = document.getElementById('cp-fusion-s6-choose-one').checked ? 'choose-one' : 'independent'
  var pack = { name, currencies, cars, legends, fusions, stage6, fusionS6Mode }
  var url = _editingPackId ? '/csr2/packs/' + _editingPackId : '/csr2/packs'
  var method = _editingPackId ? 'PATCH' : 'POST'
  var res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pack) }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (res.error) { showNotice('cp-notice', 'error', res.error); return }
  var summaryHtml = ''
  var currKeys = [
    { k: 'cash',        lbl: 'Cash',        em: '💵' },
    { k: 'gold',        lbl: 'Gold',        em: '🪙' },
    { k: 'bronzeKeys',  lbl: 'Bronze Keys', em: '🔑' },
    { k: 'silverKeys',  lbl: 'Silver Keys', em: '🗝️' },
    { k: 'goldKeys',    lbl: 'Gold Keys',   em: '✨' },
    { k: 'fuel',        lbl: 'Fuel',        em: '⛽' },
    { k: 'fusionGreen', lbl: 'Green Tk',    em: '<span class="token-dot" style="background:#4caf50;display:inline-block"></span>' },
    { k: 'fusionBlue',  lbl: 'Blue Tk',     em: '<span class="token-dot" style="background:#2196F3;display:inline-block"></span>' },
    { k: 'fusionRed',   lbl: 'Red Tk',      em: '<span class="token-dot" style="background:#e05252;display:inline-block"></span>' },
    { k: 'fusionYellow',lbl: 'Yellow Tk',   em: '<span class="token-dot" style="background:#FFC107;display:inline-block"></span>' },
  ]
  var hasCurr = false
  var chipsHtml = ''
  for (var ci = 0; ci < currKeys.length; ci++) {
    var ck = currKeys[ci]
    if (currencies[ck.k]) {
      hasCurr = true
      chipsHtml += '<div class="pack-stat-chip"><span class="psc-val">' + ck.em + ' ' + fmtN(currencies[ck.k]) + '</span><span class="psc-lbl">' + ck.lbl + '</span></div>'
    }
  }
  if (hasCurr) summaryHtml += '<div class="pack-sect"><div class="pack-sect-hdr">💰 Currencies</div><div class="pack-stat-grid">' + chipsHtml + '</div></div>'
  if (cars) {
    var carsDesc = cars.carMode === 'all'
      ? 'All available cars' + (cars.condition === 'maxed' ? ' · maxed' : '')
      : fmtN(cars.count) + ' cars — ' + cars.carMode + (cars.condition === 'maxed' ? ' · maxed' : '')
    summaryHtml += '<div class="pack-sect"><div class="pack-sect-hdr">🚗 Cars</div><div style="font-size:13px">' + escH(carsDesc) + '</div></div>'
  }
  if (legends) {
    var legendDesc = legends.mode === 'all' ? 'All 26 classic legend cars' : fmtN(legends.count) + " classic cars (User's Choice)"
    summaryHtml += '<div class="pack-sect"><div class="pack-sect-hdr">⭐ Legend Tokens</div><div style="font-size:13px">' + escH(legendDesc) + '</div></div>'
  }
  if (fusions) {
    var fusDesc = fusions.mode === 'all'
      ? 'All fusions' + (fusions.amount ? ' · ' + fmtN(fusions.amount) + ' per part' : ' · max')
      : 'Customizable · ' + (fusions.count || 0) + ' parts · ' + (fusions.brandAmount || 1) + ' brand(s)'
    summaryHtml += '<div class="pack-sect"><div class="pack-sect-hdr">⚗️ Fusions</div><div style="font-size:13px">' + escH(fusDesc) + '</div></div>'
  }
  if (stage6) {
    var s6Desc = stage6.mode === 'all'
      ? 'All Stage 6' + (stage6.amount ? ' · ' + fmtN(stage6.amount) + ' per part' : ' · max')
      : 'Customizable · User picks up to ' + (stage6.count || 0) + ' car(s)'
    summaryHtml += '<div class="pack-sect"><div class="pack-sect-hdr">6️⃣ Stage 6</div><div style="font-size:13px">' + escH(s6Desc) + '</div></div>'
  }
  document.getElementById('cp-saved-name').textContent = name
  document.getElementById('cp-saved-summary').innerHTML = summaryHtml || '<div style="color:var(--muted);font-size:13px">No contents configured</div>'
  hideModal('create-pack-modal')
  showModal('pack-saved-modal')
  resetCpModal()
  await reloadPacks()
  renderPacks()
}

// ─── Car Packs ────────────────────────────────────────────────────────────────

async function reloadCarPacks() {
  _carPacks = await apiFetch('/csr2/car-packs', [])
}

function renderCarPackCards() {
  var list = document.getElementById('cp-car-packs-list')
  var empty = document.getElementById('cp-car-packs-empty')
  if (!list) return
  if (!_carPacks.length) {
    list.innerHTML = ''
    if (empty) empty.style.display = ''
    return
  }
  if (empty) empty.style.display = 'none'
  var html = ''
  for (var i = 0; i < _carPacks.length; i++) {
    var p = _carPacks[i]
    var sel = _selectedCarPackIds.has(p.id)
    var carCount = Array.isArray(p.cars) ? p.cars.length : 0
    html += '<div class="cp-pack-card' + (sel ? ' selected' : '') + '" onclick="toggleCarPackSelection(\\'' + p.id + '\\')" data-id="' + p.id + '">'
    html += '<div class="cp-pack-card-name">' + escH(p.name || 'Unnamed Pack') + '</div>'
    html += '<div class="cp-pack-card-meta">' + carCount + ' Car' + (carCount !== 1 ? 's' : '') + '</div>'
    html += '<div class="cp-pack-card-btns">'
    html += '<button class="cp-pack-card-btn" onclick="event.stopPropagation();openViewCarPack(\\'' + p.id + '\\')" title="View">👁</button>'
    html += '<button class="cp-pack-card-btn" onclick="event.stopPropagation();openEditCarPack(\\'' + p.id + '\\')" title="Edit">✏️</button>'
    html += '</div>'
    html += '</div>'
  }
  list.innerHTML = html
}

function toggleCarPackSelection(id) {
  if (_selectedCarPackIds.has(id)) {
    _selectedCarPackIds.delete(id)
  } else {
    _selectedCarPackIds.add(id)
  }
  renderCarPackCards()
}

function updateCppSubtitle() {
  var el = document.getElementById('cpp-subtitle')
  if (el) el.textContent = _cppAllowDupes ? 'Select cars to include · duplicates allowed' : 'Select cars to include'
}

function openCreateCarPack() {
  _carPackEditId = null
  _carPackCars = []
  _cppAllowDupes = false
  document.getElementById('cpp-pack-name').value = ''
  document.getElementById('cpp-allow-dup').checked = false
  document.getElementById('cpp-car-search').value = ''
  document.getElementById('cpp-modal-title').textContent = 'Create Car Pack'
  updateCppSubtitle()
  hideNotice('cpp-notice')
  renderCppSelectedCars()
  searchCppCars('')
  showModal('create-car-pack-modal')
}

function openEditCarPack(id) {
  var pack = _carPacks.find(function(p){ return p.id === id })
  if (!pack) return
  _carPackEditId = id
  _carPackCars = (pack.cars || []).slice()
  _cppAllowDupes = false
  document.getElementById('cpp-pack-name').value = pack.name || ''
  document.getElementById('cpp-allow-dup').checked = false
  document.getElementById('cpp-car-search').value = ''
  document.getElementById('cpp-modal-title').textContent = 'Edit Car Pack'
  updateCppSubtitle()
  hideNotice('cpp-notice')
  renderCppSelectedCars()
  searchCppCars('')
  showModal('create-car-pack-modal')
}

function openViewCarPack(id) {
  var pack = _carPacks.find(function(p){ return p.id === id })
  if (!pack) return
  var cars = pack.cars || []
  var html = '<div style="font-size:14px;font-weight:600;margin-bottom:12px">' + escH(pack.name || 'Unnamed') + ' — ' + cars.length + ' car' + (cars.length !== 1 ? 's' : '') + '</div>'
  if (!cars.length) {
    html += '<div style="color:var(--muted);font-size:13px">No cars in this pack.</div>'
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto">'
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i]
      html += '<div class="cpp-car-item">'
      if (c.photoUrl) html += '<img src="' + escH(c.photoUrl) + '" style="width:44px;height:30px;object-fit:cover;border-radius:4px" onerror="this.style.display=\\'none\\'" loading="lazy">'
      html += '<div class="cpp-car-item-info"><div class="cpp-car-item-name">' + escH(c.name || c.crdb) + '</div>'
      if (c.colorName) html += '<div class="cpp-car-item-color">' + escH(c.colorName) + '</div>'
      html += '</div></div>'
    }
    html += '</div>'
  }
  document.getElementById('view-car-pack-body').innerHTML = html
  showModal('view-car-pack-modal')
}

function closeCreateCarPack() {
  hideModal('create-car-pack-modal')
  _carPackCars = []
  _carPackEditId = null
}

async function saveCarPack() {
  var name = document.getElementById('cpp-pack-name').value.trim()
  if (!name) { showNotice('cpp-notice', 'error', 'Enter a pack name.'); return }
  var pack = { name: name, cars: _carPackCars }
  var url = _carPackEditId ? '/csr2/car-packs/' + _carPackEditId : '/csr2/car-packs'
  var method = _carPackEditId ? 'PATCH' : 'POST'
  var res = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pack) })
    .then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (res.error) { showNotice('cpp-notice', 'error', res.error); return }
  closeCreateCarPack()
  await reloadCarPacks()
  renderCarPackCards()
}

function searchCppCars(query) {
  var results = document.getElementById('cpp-car-results')
  if (!results) return
  var q = query.trim().toLowerCase()
  var selectedKeys = new Set(_carPackCars.map(function(c){ return c.crdb + '|' + (c.colorName || '') }))
  var matches = []
  for (var i = 0; i < _csr2CarsDb.length; i++) {
    var car = _csr2CarsDb[i]
    if (!car.crdb) continue
    if (q && car.name.toLowerCase().indexOf(q) === -1 && (car.brand || '').toLowerCase().indexOf(q) === -1) continue
    matches.push({ car: car, idx: i })
    if (matches.length >= 60) break
  }
  if (!matches.length) { results.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:10px 0">No results</div>'; return }
  var starIcon = { Gold: '⭐', Purple: '💜', Legends: '🌟' }
  var html = '<div class="car-result-list">'
  for (var j = 0; j < matches.length; j++) {
    var car = matches[j].car
    var idx = matches[j].idx
    var alreadyAdded = !_cppAllowDupes && car.colors && car.colors.length === 1 && selectedKeys.has(car.crdb + '|' + car.colors[0].name)
    var col0 = (car.colors && car.colors[0]) || {}
    var thumb = col0.photoUrl || ''
    html += '<div class="car-result-item">'
    if (thumb) html += '<img class="car-result-thumb" src="' + escH(thumb) + '" onerror="this.style.display=\\'none\\'" loading="lazy">'
    else html += '<span class="car-tier-badge">T' + car.tier + '</span>'
    html += '<div class="car-result-info"><div class="car-result-name">' + escH(car.name) + '</div>'
    html += '<div class="car-result-meta">' + (starIcon[car.starType] || '') + ' T' + car.tier + (car.brand ? ' · ' + escH(car.brand) : '') + '</div></div>'
    if (alreadyAdded) {
      html += '<span class="car-result-added">Added</span>'
    } else {
      html += '<button class="car-result-add" onclick="addCarToCarPack(' + idx + ')">+ Add</button>'
    }
    html += '</div>'
  }
  html += '</div>'
  results.innerHTML = html
}

function addCarToCarPack(carIdx) {
  var car = _csr2CarsDb[carIdx]
  if (!car) return
  if (car.colors && car.colors.length === 1) {
    var col = car.colors[0]
    if (!_cppAllowDupes && _carPackCars.find(function(c){ return c.crdb === car.crdb && c.colorName === col.name })) return
    _carPackCars.push({ crdb: car.crdb, name: car.name, tier: car.tier, colorName: col.name, photoUrl: col.photoUrl || '', stockTxtUrl: col.stockTxtUrl || '', maxedTxtUrl: col.maxedTxtUrl || null })
    renderCppSelectedCars()
    searchCppCars(document.getElementById('cpp-car-search').value)
  } else if (car.colors && car.colors.length > 1) {
    openCppColorPicker(carIdx)
  } else {
    if (!_cppAllowDupes && _carPackCars.find(function(c){ return c.crdb === car.crdb })) return
    _carPackCars.push({ crdb: car.crdb, name: car.name, tier: car.tier, colorName: '', photoUrl: '', stockTxtUrl: '', maxedTxtUrl: null })
    renderCppSelectedCars()
    searchCppCars(document.getElementById('cpp-car-search').value)
  }
}

function openCppColorPicker(carIdx) {
  var car = _csr2CarsDb[carIdx]
  if (!car) return
  var selectedKeys = new Set(_carPackCars.map(function(c){ return c.crdb + '|' + c.colorName }))
  var html = ''
  var colors = car.colors || []
  for (var i = 0; i < colors.length; i++) {
    var col = colors[i]
    var already = !_cppAllowDupes && selectedKeys.has(car.crdb + '|' + col.name)
    html += '<div class="color-swatch' + (already ? ' loading' : '') + '" onclick="selectCppColor(' + carIdx + ',' + i + ')" title="' + escH(col.name) + '">'
    html += '<img src="' + escH(col.photoUrl || '') + '" onerror="this.style.display=\\'none\\'" loading="lazy">'
    html += '<div class="color-swatch-name">' + escH(col.name) + (already ? ' ✓' : '') + '</div>'
    html += '</div>'
  }
  document.getElementById('cp2-car-name').textContent = car.name
  document.getElementById('cp2-colors-grid').innerHTML = html
  hideNotice('cp2-notice')
  document.getElementById('cp2-car-name').dataset.cppMode = '1'
  document.getElementById('cp2-car-name').dataset.cppIdx = carIdx
  showModal('color-picker-modal')
}

function selectCppColor(carIdx, colorIdx) {
  var car = _csr2CarsDb[carIdx]
  if (!car || !car.colors) return
  var color = car.colors[colorIdx]
  if (!color) return
  if (!_cppAllowDupes && _carPackCars.find(function(c){ return c.crdb === car.crdb && c.colorName === color.name })) {
    showNotice('cp2-notice', 'info', 'This color is already in the pack.')
    return
  }
  _carPackCars.push({ crdb: car.crdb, name: car.name, tier: car.tier, colorName: color.name, photoUrl: color.photoUrl || '', stockTxtUrl: color.stockTxtUrl || '', maxedTxtUrl: color.maxedTxtUrl || null })
  hideModal('color-picker-modal')
  renderCppSelectedCars()
  searchCppCars(document.getElementById('cpp-car-search').value)
}

function removeCarFromCarPack(crdb, colorName) {
  _carPackCars = _carPackCars.filter(function(c){ return !(c.crdb === crdb && c.colorName === colorName) })
  renderCppSelectedCars()
  searchCppCars(document.getElementById('cpp-car-search').value)
}

function renderCppSelectedCars() {
  var list = document.getElementById('cpp-selected-list')
  var countLabel = document.getElementById('cpp-count-label')
  if (!list) return
  var n = _carPackCars.length
  if (countLabel) countLabel.textContent = n + ' car' + (n !== 1 ? 's' : '')
  if (!n) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;margin-top:20px">No cars yet.<br>Search and add on the left.</div>'
    return
  }
  var html = ''
  for (var i = 0; i < _carPackCars.length; i++) {
    var car = _carPackCars[i]
    var crdbEsc = escH(car.crdb || '')
    var colEsc = escH(car.colorName || '')
    html += '<div class="cpp-car-item">'
    if (car.photoUrl) html += '<img src="' + escH(car.photoUrl) + '" style="width:44px;height:30px;object-fit:cover;border-radius:4px;flex-shrink:0" onerror="this.style.display=\\'none\\'" loading="lazy">'
    else html += '<span class="car-tier-badge" style="width:44px;height:30px;display:flex;align-items:center;justify-content:center;flex-shrink:0">T' + car.tier + '</span>'
    html += '<div class="cpp-car-item-info"><div class="cpp-car-item-name">' + escH(car.name) + '</div>'
    if (car.colorName) html += '<div class="cpp-car-item-color">' + escH(car.colorName) + '</div>'
    html += '</div>'
    html += '<button class="cpp-remove-btn" onclick="removeCarFromCarPack(\\'' + crdbEsc + '\\',\\'' + colEsc + '\\')" title="Remove">×</button>'
    html += '</div>'
  }
  list.innerHTML = html
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
    var dot = document.getElementById('cars-update-dot')
    if (dot) dot.style.display = 'none'
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
  if (_csr2CarsDb.length === 0) return
  try {
    var res = await fetch('/csr2/cars-check').then(function(r){ return r.json() })
    var dot = document.getElementById('cars-update-dot')
    if (dot) dot.style.display = res.hasUpdate ? 'inline-block' : 'none'
  } catch {}
}

async function checkFusionsUpdate() {
  try {
    var res = await fetch('/csr2/fusions-check').then(function(r){ return r.json() })
    var dot = document.getElementById('fusions-update-dot')
    if (dot) dot.style.display = res.hasUpdate ? 'inline-block' : 'none'
  } catch {}
}

async function checkStage6Update() {
  try {
    var res = await fetch('/csr2/stage6-check').then(function(r){ return r.json() })
    var dot = document.getElementById('stage6-update-dot')
    if (dot) dot.style.display = res.hasUpdate ? 'inline-block' : 'none'
  } catch {}
}

function openEditNsb(packId) {
  _nsbData.ansb = null
  _selectedCars = []
  _carFilter = { tier: null, brand: null, starType: null }
  _ownedCrdbs = new Set()
  _allowDuplicates = false
  document.getElementById('ansb-file-name').style.display = 'none'
  var ansbLabelEl = document.getElementById('ansb-drop').querySelector('.file-drop-label')
  if (ansbLabelEl) ansbLabelEl.style.display = ''
  document.getElementById('ansb-apply-btn').disabled = true
  document.getElementById('ansb-drop').classList.remove('over')
  document.getElementById('ansb-car-search').value = ''
  document.getElementById('ansb-car-results').innerHTML = ''
  var dupChk = document.getElementById('ansb-allow-dup')
  if (dupChk) dupChk.checked = false
  hideNotice('ansb-notice')
  renderSelectedCars()
  _currencyOverride = {}
  _partialSelectionEnabled = false
  _selectedLegends = []
  _selectedBrands = []
  _brandsList = []
  _selectedS6Cars = []
  _s6CarsList = []
  _fusionS6Choice = null
  _nsbCurrentData = null
  _applyPackRef = null
  _currencyEditMode = false
  apSwitchTab('preview')

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
  _ensbFullData = null
  document.getElementById('ensb-file-name').style.display = 'none'
  var ensbLabelEl = document.getElementById('ensb-drop').querySelector('.file-drop-label')
  if (ensbLabelEl) ensbLabelEl.style.display = ''
  document.getElementById('ensb-apply-btn').disabled = true
  document.getElementById('ensb-unban-btn').disabled = true
  document.getElementById('ensb-drop').classList.remove('over')
  hideNotice('ensb-notice')
  showModal('edit-nsb-modal')
}

function apSwitchTab(tab) {
  var tabs = ['preview','currencies','cars','legends','fusions','stage6']
  for (var i = 0; i < tabs.length; i++) {
    var btn = document.getElementById('ap-tab-' + tabs[i])
    var panel = document.getElementById('ap-panel-' + tabs[i])
    if (btn) btn.classList.toggle('active', tabs[i] === tab)
    if (panel) panel.style.display = tabs[i] === tab ? (tabs[i] === 'cars' ? 'flex' : '') : 'none'
  }
}

function onAnsbPackSelect(packId) {
  var pack = _packs.find(function(p){ return p.id === packId }) || null
  renderPackInfoInModal(pack)
  apSwitchTab('general')
}

function renderPackInfoInModal(pack) {
  _applyPackRef = pack
  var box = document.getElementById('ansb-pack-info')
  var titleEl = document.getElementById('ansb-pack-title')
  if (!pack) { box.innerHTML = ''; if (titleEl) titleEl.textContent = ''; _renderApplyTabs(null); return }
  if (titleEl) titleEl.textContent = pack.name || 'Unnamed Pack'

  var c = pack.currencies || {}
  var chips = []
  if (c.cash)       chips.push({val: fmtN(c.cash),       lbl: 'Cash',        em: '💵'})
  if (c.gold)       chips.push({val: fmtN(c.gold),       lbl: 'Gold',        em: '🪙'})
  if (c.bronzeKeys) chips.push({val: fmtN(c.bronzeKeys), lbl: 'Bronze Keys', em: '🔑'})
  if (c.silverKeys) chips.push({val: fmtN(c.silverKeys), lbl: 'Silver Keys', em: '🗝️'})
  if (c.goldKeys)   chips.push({val: fmtN(c.goldKeys),   lbl: 'Gold Keys',   em: '✨'})
  if (c.fuel)       chips.push({val: fmtN(c.fuel),       lbl: 'Fuel',        em: '⛽'})

  var hasCurr = chips.length > 0
  var hasFusionTok = !!(c.fusionGreen || c.fusionBlue || c.fusionRed || c.fusionYellow)
  var extraChips = []
  if (pack.cars && (pack.cars.count || pack.cars.carMode === 'all')) {
    var carsVal = pack.cars.carMode === 'all' ? 'All' : fmtN(pack.cars.count)
    var carsMeta = pack.cars.carMode === 'all' ? 'Cars' + (pack.cars.condition === 'maxed' ? ' · Maxed' : '') : (pack.cars.carMode === 'customizable' ? 'Cars · User Picks' : 'Cars · Random') + (pack.cars.condition === 'maxed' ? ' · Maxed' : '')
    extraChips.push('<div class="pack-stat-chip"><span class="psc-val">🚗 ' + escH(carsVal) + '</span><span class="psc-lbl">' + escH(carsMeta) + '</span></div>')
  }
  if (pack.legends && pack.legends.mode === 'all') {
    extraChips.push('<div class="pack-stat-chip"><span class="psc-val">⭐ All 26</span><span class="psc-lbl">Legend Tokens</span></div>')
  } else if (pack.legends && pack.legends.mode === 'customizable') {
    extraChips.push('<div class="pack-stat-chip"><span class="psc-val">⭐ ' + (pack.legends.count || 0) + '</span><span class="psc-lbl">Legends · User\\'s Choice</span></div>')
  }
  if (pack.fusions && pack.fusions.mode === 'all') {
    extraChips.push('<div class="pack-stat-chip"><span class="psc-val">⚗️ All</span><span class="psc-lbl">Fusions' + (pack.fusions.amount ? ' · ' + fmtN(pack.fusions.amount) + '/part' : '') + '</span></div>')
  }
  if (pack.stage6 && pack.stage6.mode === 'all') {
    extraChips.push('<div class="pack-stat-chip"><span class="psc-val">6️⃣ All</span><span class="psc-lbl">Stage 6' + (pack.stage6.amount ? ' · ' + fmtN(pack.stage6.amount) + '/part' : '') + '</span></div>')
  }

  var html = ''

  if (hasCurr || hasFusionTok) {
    html += '<div class="prev-sect-hdr">💰 Currencies</div>'
    if (hasCurr) {
      html += '<div class="pack-stat-grid">'
      for (var i = 0; i < chips.length; i++) {
        html += '<div class="pack-stat-chip"><span class="psc-val">' + chips[i].em + ' ' + escH(chips[i].val) + '</span><span class="psc-lbl">' + escH(chips[i].lbl) + '</span></div>'
      }
      html += '</div>'
    }
    if (hasFusionTok) {
      html += '<div class="prev-sect-hdr" style="margin-top:6px">⚡ Elite Tokens</div><div class="pack-stat-grid">'
      if (c.fusionGreen)  html += '<div class="pack-stat-chip"><span class="psc-val"><span class="token-dot" style="background:#4caf50;display:inline-block;vertical-align:middle;margin-right:3px"></span>' + fmtN(c.fusionGreen) + '</span><span class="psc-lbl">Green</span></div>'
      if (c.fusionBlue)   html += '<div class="pack-stat-chip"><span class="psc-val"><span class="token-dot" style="background:#2196F3;display:inline-block;vertical-align:middle;margin-right:3px"></span>' + fmtN(c.fusionBlue) + '</span><span class="psc-lbl">Blue</span></div>'
      if (c.fusionRed)    html += '<div class="pack-stat-chip"><span class="psc-val"><span class="token-dot" style="background:#e05252;display:inline-block;vertical-align:middle;margin-right:3px"></span>' + fmtN(c.fusionRed) + '</span><span class="psc-lbl">Red</span></div>'
      if (c.fusionYellow) html += '<div class="pack-stat-chip"><span class="psc-val"><span class="token-dot" style="background:#FFC107;display:inline-block;vertical-align:middle;margin-right:3px"></span>' + fmtN(c.fusionYellow) + '</span><span class="psc-lbl">Yellow</span></div>'
      html += '</div>'
    }
  }

  if (extraChips.length) {
    html += '<div class="prev-sect-hdr"' + ((hasCurr || hasFusionTok) ? ' style="margin-top:10px"' : '') + '>🚗 Cars &amp; Upgrades</div>'
    html += '<div class="pack-stat-grid">' + extraChips.join('') + '</div>'
  }

  box.innerHTML = html
  _renderApplyTabs(pack)
}

function _renderApplyTabs(pack) {
  var extraTabs = ['currencies','cars','legends','fusions','stage6']
  for (var i = 0; i < extraTabs.length; i++) {
    var btn = document.getElementById('ap-tab-' + extraTabs[i])
    if (btn) { btn.style.display = 'none'; btn.classList.remove('nsb-locked') }
  }
  if (!pack) return

  // Currencies tab — show if pack has any currencies
  var c = pack.currencies || {}
  var hasCurr = !!(c.cash || c.gold || c.bronzeKeys || c.silverKeys || c.goldKeys || c.fuel ||
    c.fusionGreen || c.fusionBlue || c.fusionRed || c.fusionYellow)
  var currBtn = document.getElementById('ap-tab-currencies')
  if (currBtn) currBtn.style.display = hasCurr ? '' : 'none'
  if (hasCurr) renderCurrencyTab(pack, _nsbCurrentData)

  // Cars tab — show for random or customizable
  var carMode = pack.cars && pack.cars.carMode
  var showCars = carMode === 'random' || carMode === 'customizable'
  var carBtn = document.getElementById('ap-tab-cars')
  if (carBtn) carBtn.style.display = showCars ? '' : 'none'
  if (showCars) {
    var hdr = document.getElementById('ap-cars-header')
    var partialRow = document.getElementById('ap-partial-toggle-row')
    var picker = document.getElementById('ap-cars-picker')
    var right = document.getElementById('ap-cars-right')
    if (carMode === 'random') {
      var partialCount = (pack.cars.partial && pack.cars.partial.count) ? pack.cars.partial.count : pack.cars.count
      if (hdr) hdr.innerHTML = 'This pack will add <strong style="color:var(--text)">' + fmtN(pack.cars.count) + ' random' + (pack.cars.condition === 'maxed' ? ' maxed' : '') + ' cars</strong>. Enable Partial Selection to hand-pick up to <strong style="color:var(--text)">' + fmtN(partialCount) + '</strong> instead.'
      if (partialRow) partialRow.style.display = ''
      _partialSelectionEnabled = false
      var partialChk = document.getElementById('ap-partial-sel')
      if (partialChk) partialChk.checked = false
      if (picker) picker.style.display = 'none'
      if (right) right.style.display = 'none'
    } else {
      if (hdr) hdr.innerHTML = 'Select up to <strong style="color:var(--text)">' + fmtN(pack.cars.count) + ' cars</strong> to include in this pack.'
      if (partialRow) partialRow.style.display = 'none'
      if (picker) picker.style.display = ''
      if (right) { right.style.display = 'flex'; right.style.flexShrink = '0' }
      renderCarFilterBar()
      setCarSectionLocked(!_nsbData.ansb)
    }
    // Car packs section — always rendered when Cars tab is shown
    renderApCarPacks(pack)
  }

  // Legends tab — only for customizable (buyer picks)
  var showLegends = !!(pack.legends && pack.legends.mode === 'customizable')
  var legBtn = document.getElementById('ap-tab-legends')
  if (legBtn) legBtn.style.display = showLegends ? '' : 'none'
  if (showLegends) {
    _selectedLegends = []
    var hdrEl = document.getElementById('ap-legends-header')
    if (hdrEl) hdrEl.textContent = 'Select up to ' + (pack.legends.count || 0) + ' legend cars to include.'
    renderSelectedLegends(pack)
    searchLegends('')
  }

  // Fusions & Stage 6 — check choose-one mode
  var fusCust = !!(pack.fusions && pack.fusions.mode === 'customizable')
  var s6Cust  = !!(pack.stage6  && pack.stage6.mode  === 'customizable')
  var chooseOne = pack.fusionS6Mode === 'choose-one' && fusCust && s6Cust
  var choiceEl = document.getElementById('ap-fusion-s6-choice')
  if (choiceEl) choiceEl.style.display = chooseOne ? '' : 'none'

  if (chooseOne) {
    // Reset choice state — tabs only shown after buyer picks one
    _fusionS6Choice = null
    _selectedBrands = []
    _selectedS6Cars = []
    var fusBtnC = document.getElementById('ap-tab-fusions')
    var s6BtnC  = document.getElementById('ap-tab-stage6')
    if (fusBtnC) fusBtnC.style.display = 'none'
    if (s6BtnC)  s6BtnC.style.display  = 'none'
    var rFus = document.getElementById('ap-choice-fusions')
    var rS6  = document.getElementById('ap-choice-stage6')
    if (rFus) rFus.checked = false
    if (rS6)  rS6.checked  = false
    // Pre-load lists in background so pickers are instant once buyer chooses
    loadAndSearchBrands('')
    loadAndSearchS6Cars('')
  } else {
    // Independent mode — show each tab based on its own setting
    var showFusionsTab = fusCust
    var fusBtn = document.getElementById('ap-tab-fusions')
    if (fusBtn) fusBtn.style.display = showFusionsTab ? '' : 'none'
    if (showFusionsTab) {
      _selectedBrands = []
      var fusHdr = document.getElementById('ap-fusions-header')
      if (fusHdr) fusHdr.textContent = 'Select up to ' + (pack.fusions.brandAmount || 1) + ' brand(s) to include fusions for.'
      renderSelectedBrands(pack)
      loadAndSearchBrands('')
    }

    var showS6Tab = s6Cust
    var s6Btn = document.getElementById('ap-tab-stage6')
    if (s6Btn) s6Btn.style.display = showS6Tab ? '' : 'none'
    if (showS6Tab) {
      _selectedS6Cars = []
      var s6Hdr = document.getElementById('ap-s6-header')
      if (s6Hdr) s6Hdr.textContent = 'Select up to ' + (pack.stage6.count || 0) + ' car(s) to include Stage 6 upgrades for.'
      renderSelectedS6Cars(pack)
      loadAndSearchS6Cars('')
    }
  }
  // Lock non-preview tabs until NSB file is uploaded
  _updateApplyTabsNsbState(!!_nsbData.ansb)
}

function onFusionS6Choice(choice) {
  _fusionS6Choice = choice
  var pack = _applyPackRef
  // Clear the other option's selections
  if (choice === 'fusions') {
    _selectedS6Cars = []
    renderSelectedS6Cars(pack)
  } else {
    _selectedBrands = []
    renderSelectedBrands(pack)
  }
  // Update radio visuals
  var rFus = document.getElementById('ap-choice-fusions')
  var rS6  = document.getElementById('ap-choice-stage6')
  if (rFus) rFus.checked = choice === 'fusions'
  if (rS6)  rS6.checked  = choice === 'stage6'
  var wFus = document.getElementById('ap-choice-fusions-wrap')
  var wS6  = document.getElementById('ap-choice-stage6-wrap')
  if (wFus) wFus.style.borderColor = choice === 'fusions' ? 'var(--accent)' : 'var(--border)'
  if (wS6)  wS6.style.borderColor  = choice === 'stage6'  ? 'var(--accent)' : 'var(--border)'
  // Enable only the chosen tab (don't auto-switch — user navigates manually)
  var fusBtn = document.getElementById('ap-tab-fusions')
  var s6Btn  = document.getElementById('ap-tab-stage6')
  if (fusBtn) fusBtn.style.display = choice === 'fusions' ? '' : 'none'
  if (s6Btn)  s6Btn.style.display  = choice === 'stage6'  ? '' : 'none'
  // Pre-initialize the chosen picker so it's ready when user switches
  if (choice === 'fusions' && pack && pack.fusions) {
    var fusHdr = document.getElementById('ap-fusions-header')
    if (fusHdr) fusHdr.textContent = 'Select up to ' + (pack.fusions.brandAmount || 1) + ' brand(s) to include fusions for.'
    renderSelectedBrands(pack)
    searchBrands(document.getElementById('ap-brands-search') ? document.getElementById('ap-brands-search').value : '')
  } else if (choice === 'stage6' && pack && pack.stage6) {
    var s6Hdr = document.getElementById('ap-s6-header')
    if (s6Hdr) s6Hdr.textContent = 'Select up to ' + (pack.stage6.count || 0) + ' car(s) to include Stage 6 upgrades for.'
    renderSelectedS6Cars(pack)
    searchS6Cars(document.getElementById('ap-s6-search') ? document.getElementById('ap-s6-search').value : '')
  }
}

// ─── Currencies Tab ───────────────────────────────────────────────────────────

var AP_CURR_KEYS = [
  { k: 'cash',        lbl: 'Cash',        em: '💵' },
  { k: 'gold',        lbl: 'Gold',        em: '🪙' },
  { k: 'bronzeKeys',  lbl: 'Bronze Keys', em: '🔑' },
  { k: 'silverKeys',  lbl: 'Silver Keys', em: '🗝️' },
  { k: 'goldKeys',    lbl: 'Gold Keys',   em: '✨' },
  { k: 'fuel',        lbl: 'Fuel',        em: '⛽' },
  { k: 'fusionGreen', lbl: 'Green Tk',    em: '<span class="token-dot" style="background:#4caf50;display:inline-block;vertical-align:middle"></span>' },
  { k: 'fusionBlue',  lbl: 'Blue Tk',     em: '<span class="token-dot" style="background:#2196F3;display:inline-block;vertical-align:middle"></span>' },
  { k: 'fusionRed',   lbl: 'Red Tk',      em: '<span class="token-dot" style="background:#e05252;display:inline-block;vertical-align:middle"></span>' },
  { k: 'fusionYellow',lbl: 'Yellow Tk',   em: '<span class="token-dot" style="background:#FFC107;display:inline-block;vertical-align:middle"></span>' },
]

function renderCurrencyTab(pack, nsbData) {
  var tableEl = document.getElementById('ap-curr-table')
  if (!tableEl || !pack) return
  var c = pack.currencies || {}
  var hasOverride = Object.keys(_currencyOverride).length > 0
  var warnEl = document.getElementById('ap-curr-override-warn')
  var clearBtn = document.getElementById('ap-curr-clear-btn')
  if (warnEl) warnEl.style.display = hasOverride ? '' : 'none'
  if (clearBtn) clearBtn.style.display = hasOverride ? '' : 'none'

  var rows = []
  for (var i = 0; i < AP_CURR_KEYS.length; i++) {
    var ck = AP_CURR_KEYS[i]
    var packVal = c[ck.k] || 0
    var overVal = _currencyOverride[ck.k]
    var effectiveVal = (overVal !== undefined) ? overVal : packVal
    if (!packVal && !overVal) continue
    rows.push({ ck: ck, packVal: packVal, effectiveVal: effectiveVal, overridden: overVal !== undefined })
  }

  if (!rows.length) { tableEl.innerHTML = '<div style="font-size:12px;color:var(--muted)">No currencies in this pack.</div>'; return }

  var html = '<table class="compare-table"><thead><tr>'
  if (nsbData) {
    html += '<th>Currency</th><th style="text-align:right">Current</th><th style="text-align:right">+Adding</th><th style="text-align:right">After</th>'
  } else {
    html += '<th>Currency</th><th style="text-align:right">Amount</th>'
  }
  html += '</tr></thead><tbody>'
  for (var j = 0; j < rows.length; j++) {
    var r = rows[j]
    var addStyle = r.overridden ? 'color:var(--accent);font-weight:600' : ''
    html += '<tr><td class="comp-label">' + r.ck.em + ' ' + escH(r.ck.lbl) + '</td>'
    if (nsbData) {
      var cur = nsbData[r.ck.k] || 0
      html += '<td class="comp-delta" style="text-align:right">' + fmtN(cur) + '</td>'
      html += '<td class="comp-delta" style="text-align:right;' + addStyle + '">+' + fmtN(r.effectiveVal) + '</td>'
      html += '<td class="comp-arrow comp-after" style="text-align:right">' + fmtN(cur + r.effectiveVal) + '</td>'
    } else {
      html += '<td class="comp-delta" style="text-align:right;' + addStyle + '">' + fmtN(r.effectiveVal) + '</td>'
    }
    html += '</tr>'
  }
  html += '</tbody></table>'
  tableEl.innerHTML = html
}

function toggleCurrencyEdit() {
  _currencyEditMode = !_currencyEditMode
  var form = document.getElementById('ap-curr-edit-form')
  var grid = document.getElementById('ap-curr-edit-grid')
  if (!form || !grid) return
  if (_currencyEditMode) {
    var pack = _applyPackRef
    if (!pack) return
    var c = pack.currencies || {}
    var fieldsHtml = ''
    for (var i = 0; i < AP_CURR_KEYS.length; i++) {
      var ck = AP_CURR_KEYS[i]
      var packVal = c[ck.k] || 0
      if (!packVal) continue
      var overVal = _currencyOverride[ck.k]
      var displayVal = (overVal !== undefined) ? overVal.toLocaleString('en-US') : (packVal > 0 ? packVal.toLocaleString('en-US') : '')
      fieldsHtml += '<div class="field"><label>' + ck.em + ' ' + escH(ck.lbl) + '</label>'
      fieldsHtml += '<input type="text" id="ap-ov-' + ck.k + '" value="' + escH(displayVal) + '" placeholder="' + fmtN(packVal) + ' (pack default)" onblur="fmtInput(this)" onfocus="unfmtInput(this)"></div>'
    }
    grid.innerHTML = fieldsHtml
    form.style.display = ''
    var editBtn = document.getElementById('ap-curr-edit-btn')
    if (editBtn) editBtn.textContent = '✏️ Editing...'
  } else {
    form.style.display = 'none'
    var editBtn2 = document.getElementById('ap-curr-edit-btn')
    if (editBtn2) editBtn2.textContent = '✏️ Override'
  }
}

function cancelCurrencyEdit() {
  _currencyEditMode = false
  var form = document.getElementById('ap-curr-edit-form')
  if (form) form.style.display = 'none'
  var editBtn = document.getElementById('ap-curr-edit-btn')
  if (editBtn) editBtn.textContent = '✏️ Override'
}

function saveCurrencyOverride() {
  var pack = _applyPackRef
  if (!pack) return
  var c = pack.currencies || {}
  var newOverride = {}
  for (var i = 0; i < AP_CURR_KEYS.length; i++) {
    var ck = AP_CURR_KEYS[i]
    var packVal = c[ck.k] || 0
    if (!packVal) continue
    var input = document.getElementById('ap-ov-' + ck.k)
    if (!input) continue
    var raw = parseInt(input.value.replace(/,/g, ''), 10)
    if (!isNaN(raw) && raw !== packVal) newOverride[ck.k] = raw
  }
  _currencyOverride = newOverride
  cancelCurrencyEdit()
  renderCurrencyTab(pack, _nsbCurrentData)
}

function clearCurrencyOverride() {
  _currencyOverride = {}
  cancelCurrencyEdit()
  renderCurrencyTab(_applyPackRef, _nsbCurrentData)
}

// ─── Cars Tab ─────────────────────────────────────────────────────────────────

function togglePartialSelection(enabled) {
  _partialSelectionEnabled = enabled
  var picker = document.getElementById('ap-cars-picker')
  var right = document.getElementById('ap-cars-right')
  if (!enabled) {
    if (picker) picker.style.display = 'none'
    if (right) right.style.display = 'none'
    _selectedCars = []
    renderSelectedCars()
  } else {
    if (picker) picker.style.display = ''
    if (right) { right.style.display = 'flex'; right.style.flexShrink = '0' }
    renderCarFilterBar()
    setCarSectionLocked(!_nsbData.ansb)
  }
  renderApCarPacks(_applyPackRef)
}

// ─── Legends Tab ──────────────────────────────────────────────────────────────

function buildLegendTierMap() {
  var m = {}
  for (var i = 0; i < LEGEND_CARS.length; i++) {
    if (LEGEND_CARS[i].tier) m[LEGEND_CARS[i].crdb] = LEGEND_CARS[i].tier
  }
  for (var j = 0; j < _csr2CarsDb.length; j++) {
    if (_csr2CarsDb[j].crdb && _csr2CarsDb[j].tier) m[_csr2CarsDb[j].crdb] = _csr2CarsDb[j].tier
  }
  return m
}

function searchLegends(query) {
  var listEl = document.getElementById('ap-legends-list')
  if (!listEl) return
  var pack = _applyPackRef
  var maxCount = pack && pack.legends ? (pack.legends.count || 0) : 0
  var q = query ? query.toLowerCase() : ''
  var selCrdbs = new Set(_selectedLegends.map(function(l){ return l.crdb }))
  var tierMap = buildLegendTierMap()
  var html = '<div class="car-result-list">'
  var shown = 0
  for (var i = 0; i < LEGEND_CARS.length; i++) {
    var lc = LEGEND_CARS[i]
    if (q && lc.name.toLowerCase().indexOf(q) === -1) continue
    var added = selCrdbs.has(lc.crdb)
    var atCap = _selectedLegends.length >= maxCount
    var tier = tierMap[lc.crdb]
    html += '<div class="car-result-item">'
    if (tier) html += '<span style="font-size:10px;font-weight:700;color:var(--accent);background:rgba(255,165,0,.15);border-radius:4px;padding:1px 5px;margin-right:6px;flex-shrink:0">T' + tier + '</span>'
    html += '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escH(lc.name) + '</span>'
    html += '<span style="font-size:11px;color:var(--muted);margin-right:8px">' + fmtN(lc.amount) + ' tk</span>'
    if (added) {
      html += '<span class="car-result-added">Added</span>'
    } else if (atCap) {
      html += '<span class="car-result-added" style="color:var(--muted)">Full</span>'
    } else {
      html += '<button class="car-result-add" onclick="addLegend(\\'' + lc.crdb + '\\')">+ Add</button>'
    }
    html += '</div>'
    shown++
  }
  if (!shown) html += '<div class="car-result-item" style="color:var(--muted)">No legends found</div>'
  html += '</div>'
  listEl.innerHTML = html
}

function addLegend(crdb) {
  var lc = LEGEND_CARS.find(function(l){ return l.crdb === crdb })
  if (!lc) return
  var pack = _applyPackRef
  var maxCount = pack && pack.legends ? (pack.legends.count || 0) : 0
  if (_selectedLegends.length >= maxCount) return
  if (_selectedLegends.find(function(l){ return l.crdb === crdb })) return
  _selectedLegends.push(lc)
  renderSelectedLegends(pack)
  searchLegends(document.getElementById('ap-legends-search').value)
}

function removeLegend(crdb) {
  _selectedLegends = _selectedLegends.filter(function(l){ return l.crdb !== crdb })
  var pack = _applyPackRef
  renderSelectedLegends(pack)
  searchLegends(document.getElementById('ap-legends-search').value)
}

function renderSelectedLegends(pack) {
  var selEl = document.getElementById('ap-legends-selected')
  var countEl = document.getElementById('ap-legends-sel-count')
  var maxCount = pack && pack.legends ? (pack.legends.count || 0) : 0
  if (countEl) countEl.textContent = _selectedLegends.length + ' / ' + maxCount
  if (!selEl) return
  if (!_selectedLegends.length) {
    selEl.innerHTML = '<div style="font-size:12px;color:var(--muted)">No legends selected yet. Search and add above.</div>'
    return
  }
  var tierMap = buildLegendTierMap()
  selEl.innerHTML = _selectedLegends.map(function(lc) {
    var tier = tierMap[lc.crdb]
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--surf2);border-radius:6px;font-size:12px">' +
      (tier ? '<span style="font-size:10px;font-weight:700;color:var(--accent);background:rgba(255,165,0,.15);border-radius:4px;padding:1px 5px;flex-shrink:0">T' + tier + '</span>' : '') +
      '<span style="flex:1">' + escH(lc.name) + '</span>' +
      '<span style="color:var(--muted)">' + fmtN(lc.amount) + ' tk</span>' +
      '<button onclick="removeLegend(\\'' + lc.crdb + '\\')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;line-height:1;padding:0 2px">×</button>' +
      '</div>'
  }).join('')
}

// ─── Brands Tab (Fusions & S6) ────────────────────────────────────────────────

function formatBrandId(id) {
  if (!id) return id
  var idx = id.indexOf('_')
  if (idx !== -1 && idx < id.length - 1) {
    var brand = id.slice(idx + 1)
    return brand.charAt(0).toUpperCase() + brand.slice(1)
  }
  return id.charAt(0).toUpperCase() + id.slice(1)
}

function _updateApplyTabsNsbState(hasNsb) {
  var tabs = ['currencies','cars','legends','fusions','stage6']
  for (var i = 0; i < tabs.length; i++) {
    var btn = document.getElementById('ap-tab-' + tabs[i])
    if (btn && btn.style.display !== 'none') {
      if (hasNsb) btn.classList.remove('nsb-locked')
      else btn.classList.add('nsb-locked')
    }
  }
}

async function loadAndSearchBrands(query) {
  if (!_brandsList.length) {
    try {
      var res = await apiFetch('/csr2/brands', null)
      _brandsList = Array.isArray(res.data) ? res.data : []
    } catch (e) { _brandsList = [] }
  }
  searchBrands(query)
}

function searchBrands(query) {
  var listEl = document.getElementById('ap-brands-list')
  if (!listEl) return
  if (!_brandsList.length) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px">No brand data. Go to Tools → CSR2 → Fusions Data to fetch brands.</div>'
    return
  }
  var pack = _applyPackRef
  var maxCount = pack && pack.fusions ? (pack.fusions.brandAmount || 1) : 1
  var q = query ? query.toLowerCase() : ''
  var selIds = new Set(_selectedBrands.map(function(b){ return b.id }))
  var html = '<div class="car-result-list">'
  var shown = 0
  for (var i = 0; i < _brandsList.length; i++) {
    var b = _brandsList[i]
    var rawId = b.id || ''
    var displayName = formatBrandId(rawId) || b.name || rawId
    if (q && displayName.toLowerCase().indexOf(q) === -1) continue
    var added = selIds.has(b.id)
    var atCap = _selectedBrands.length >= maxCount
    html += '<div class="car-result-item">'
    html += '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escH(displayName) + '</span>'
    if (added) {
      html += '<span class="car-result-added">Added</span>'
    } else if (atCap) {
      html += '<span class="car-result-added" style="color:var(--muted)">Full</span>'
    } else {
      html += '<button class="car-result-add" onclick="addBrand(\\'' + b.id + '\\')">+ Add</button>'
    }
    html += '</div>'
    shown++
  }
  if (!shown) html += '<div class="car-result-item" style="color:var(--muted)">No brands found</div>'
  html += '</div>'
  listEl.innerHTML = html
}

function addBrand(id) {
  var b = _brandsList.find(function(x){ return x.id === id })
  if (!b) return
  var pack = _applyPackRef
  var maxCount = pack && pack.fusions ? (pack.fusions.brandAmount || 1) : 1
  if (_selectedBrands.length >= maxCount) return
  if (_selectedBrands.find(function(x){ return x.id === id })) return
  _selectedBrands.push(b)
  renderSelectedBrands(pack)
  searchBrands(document.getElementById('ap-brands-search').value)
}

function removeBrand(id) {
  _selectedBrands = _selectedBrands.filter(function(b){ return b.id !== id })
  var pack = _applyPackRef
  renderSelectedBrands(pack)
  searchBrands(document.getElementById('ap-brands-search').value)
}

function renderSelectedBrands(pack) {
  var selEl = document.getElementById('ap-brands-selected')
  var countEl = document.getElementById('ap-brands-sel-count')
  var maxCount = pack && pack.fusions ? (pack.fusions.brandAmount || 1) : 1
  if (countEl) countEl.textContent = _selectedBrands.length + ' / ' + maxCount
  if (!selEl) return
  if (!_selectedBrands.length) {
    selEl.innerHTML = '<div style="font-size:12px;color:var(--muted)">No brands selected yet. Search and add above.</div>'
    return
  }
  selEl.innerHTML = _selectedBrands.map(function(b) {
    var displayName = formatBrandId(b.id) || b.name || b.id || ''
    return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:var(--surf2);border:1px solid var(--border);border-radius:16px;font-size:12px">' +
      escH(displayName) +
      '<button onclick="removeBrand(\\'' + b.id + '\\')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;line-height:1;padding:0 0 0 2px">×</button>' +
      '</span>'
  }).join('')
}

// ─── Stage 6 Car Picker ───────────────────────────────────────────────────────

async function loadAndSearchS6Cars(query) {
  if (!_s6CarsList.length) {
    try {
      var res = await apiFetch('/csr2/stage6-cars', null)
      _s6CarsList = Array.isArray(res.data) ? res.data : []
    } catch (e) { _s6CarsList = [] }
  }
  searchS6Cars(query)
}

function searchS6Cars(query) {
  var listEl = document.getElementById('ap-s6-list')
  if (!listEl) return
  if (!_s6CarsList.length) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px">No Stage 6 data loaded — fetch it in Tools → CSR2.</div>'
    return
  }
  var pack = _applyPackRef
  var maxCount = pack && pack.stage6 ? (pack.stage6.count || 0) : 0
  var q = query ? query.toLowerCase() : ''
  var selCrdbs = new Set(_selectedS6Cars.map(function(c){ return c.crdb }))
  var html = '<div class="car-result-list">'
  var shown = 0
  for (var i = 0; i < _s6CarsList.length; i++) {
    var c = _s6CarsList[i]
    var displayName = c.name || c.crdb || ''
    if (q && displayName.toLowerCase().indexOf(q) === -1) continue
    var added = selCrdbs.has(c.crdb)
    var atCap = _selectedS6Cars.length >= maxCount
    html += '<div class="car-result-item">'
    if (c.tier) html += '<span style="font-size:10px;font-weight:700;color:var(--accent);background:rgba(255,165,0,.15);border-radius:4px;padding:1px 5px;margin-right:4px;flex-shrink:0">T' + c.tier + '</span>'
    html += '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escH(displayName) + '</span>'
    if (added) {
      html += '<span class="car-result-added">Added</span>'
    } else if (atCap) {
      html += '<span class="car-result-added" style="color:var(--muted)">Full</span>'
    } else {
      html += '<button class="car-result-add" onclick="addS6Car(\\'' + c.crdb + '\\')">+ Add</button>'
    }
    html += '</div>'
    shown++
  }
  if (!shown) html += '<div class="car-result-item" style="color:var(--muted)">No cars found</div>'
  html += '</div>'
  listEl.innerHTML = html
}

function addS6Car(crdb) {
  var c = _s6CarsList.find(function(x){ return x.crdb === crdb })
  if (!c) return
  var pack = _applyPackRef
  var maxCount = pack && pack.stage6 ? (pack.stage6.count || 0) : 0
  if (_selectedS6Cars.length >= maxCount) return
  if (_selectedS6Cars.find(function(x){ return x.crdb === crdb })) return
  _selectedS6Cars.push(c)
  renderSelectedS6Cars(pack)
  searchS6Cars(document.getElementById('ap-s6-search').value)
}

function removeS6Car(crdb) {
  _selectedS6Cars = _selectedS6Cars.filter(function(c){ return c.crdb !== crdb })
  var pack = _applyPackRef
  renderSelectedS6Cars(pack)
  searchS6Cars(document.getElementById('ap-s6-search').value)
}

function renderSelectedS6Cars(pack) {
  var selEl = document.getElementById('ap-s6-selected')
  var countEl = document.getElementById('ap-s6-sel-count')
  var maxCount = pack && pack.stage6 ? (pack.stage6.count || 0) : 0
  if (countEl) countEl.textContent = _selectedS6Cars.length + ' / ' + maxCount
  if (!selEl) return
  if (!_selectedS6Cars.length) {
    selEl.innerHTML = '<div style="font-size:12px;color:var(--muted)">No cars selected yet.</div>'
    return
  }
  selEl.innerHTML = _selectedS6Cars.map(function(c) {
    var displayName = c.name || c.crdb || ''
    return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:var(--surf2);border:1px solid var(--border);border-radius:16px;font-size:12px">' +
      (c.tier ? '<span style="font-size:10px;font-weight:700;color:var(--accent)">T' + c.tier + '</span>' : '') +
      escH(displayName) +
      '<button onclick="removeS6Car(\\'' + c.crdb + '\\')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;line-height:1;padding:0 0 0 2px">×</button>' +
      '</span>'
  }).join('')
}

// ─── Car Packs in Apply Pack Cars tab ─────────────────────────────────────────

function renderApCarPacks(pack) {
  var sect = document.getElementById('ansb-car-packs-section')
  if (!sect) return
  if (!_carPacks.length) { sect.style.display = 'none'; return }
  sect.style.display = ''
  var limit = _partialSelectionEnabled && pack && pack.cars && pack.cars.partial && pack.cars.partial.count
    ? pack.cars.partial.count
    : (pack && pack.cars && pack.cars.count ? pack.cars.count : 0)
  var html = ''
  for (var i = 0; i < _carPacks.length; i++) {
    var cp = _carPacks[i]
    var packCars = cp.cars || []
    var selCrdbs = _selectedCars.map(function(c){ return c.crdb + '|' + (c.colorName || '') })
    var selSet = new Set(selCrdbs)
    var dupCount = 0
    for (var j = 0; j < packCars.length; j++) {
      var key = packCars[j].crdb + '|' + (packCars[j].colorName || '')
      if (selSet.has(key)) dupCount++
    }
    var addedCount = dupCount
    var remaining = Math.max(0, limit - _selectedCars.length)
    var atLimit = remaining === 0
    html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surf2);border:1px solid var(--border);border-radius:7px;font-size:12px">'
    html += '<div style="flex:1;min-width:0"><div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escH(cp.name || 'Unnamed Pack') + '</div>'
    html += '<div style="font-size:11px;color:var(--muted);margin-top:1px">' + packCars.length + ' cars' + (addedCount > 0 ? ' · <span style="color:var(--accent)">' + addedCount + ' already added</span>' : '') + '</div></div>'
    if (atLimit) {
      html += '<span class="car-result-added" style="color:var(--muted)">Limit reached</span>'
    } else {
      html += '<button class="car-result-add" onclick="addCarPackToSelection(\\'' + cp.id + '\\')">+ Add All</button>'
    }
    html += '</div>'
  }
  document.getElementById('ansb-car-packs-list').innerHTML = html
}

function addCarPackToSelection(packId) {
  var cp = _carPacks.find(function(p){ return p.id === packId })
  if (!cp) return
  var pack = _applyPackRef
  var limit = _partialSelectionEnabled && pack && pack.cars && pack.cars.partial && pack.cars.partial.count
    ? pack.cars.partial.count
    : (pack && pack.cars && pack.cars.count ? pack.cars.count : 0)
  var selSet = new Set(_selectedCars.map(function(c){ return c.crdb + '|' + (c.colorName || '') }))
  var packCars = cp.cars || []
  var dupes = packCars.filter(function(c){ return selSet.has(c.crdb + '|' + (c.colorName || '')) })
  if (_allowDuplicates && dupes.length > 0) {
    _pendingCarPackId = packId
    var msgEl = document.getElementById('dup-confirm-msg')
    if (msgEl) msgEl.textContent = dupes.length + ' car' + (dupes.length === 1 ? '' : 's') + ' in this pack ' + (dupes.length === 1 ? 'is' : 'are') + ' already selected. Add them again as duplicates?'
    showModal('dup-confirm-modal')
  } else {
    _doAddCarPack(packId, false)
  }
}

function confirmAddCarPack(includeDupes) {
  hideModal('dup-confirm-modal')
  if (_pendingCarPackId) _doAddCarPack(_pendingCarPackId, includeDupes)
  _pendingCarPackId = null
}

function _doAddCarPack(packId, includeDupes) {
  var cp = _carPacks.find(function(p){ return p.id === packId })
  if (!cp) return
  var pack = _applyPackRef
  var limit = _partialSelectionEnabled && pack && pack.cars && pack.cars.partial && pack.cars.partial.count
    ? pack.cars.partial.count
    : (pack && pack.cars && pack.cars.count ? pack.cars.count : 0)
  var packCars = cp.cars || []
  var added = 0
  for (var i = 0; i < packCars.length; i++) {
    if (limit && _selectedCars.length >= limit) break
    var c = packCars[i]
    var key = c.crdb + '|' + (c.colorName || '')
    var isDupe = _selectedCars.some(function(s){ return s.crdb + '|' + (s.colorName || '') === key })
    if (isDupe && !includeDupes) continue
    _selectedCars.push({ crdb: c.crdb, name: c.name, tier: c.tier, colorName: c.colorName || '', photoUrl: c.photoUrl || '', stockTxtUrl: c.stockTxtUrl || '', maxedTxtUrl: c.maxedTxtUrl || null })
    added++
  }
  renderSelectedCars()
  renderApCarPacks(pack)
  if (document.getElementById('ansb-car-controls').style.display !== 'none') {
    searchCars(document.getElementById('ansb-car-search').value)
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
    var opts = ['All'].concat(brands).map(function(v){
      var sel = ((v === 'All' && !b) || v === b) ? ' selected' : ''
      return '<option value="' + escH(v) + '"' + sel + '>' + escH(v === 'All' ? 'All Brands' : v) + '</option>'
    }).join('')
    brandBar.innerHTML = '<select onchange="setBrandFilter(this.value)" style="width:auto;padding:4px 8px;font-size:12px;border-radius:6px">' + opts + '</select>'
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
  renderSelectedCars()
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
    var nameEl = document.getElementById(which + '-file-name')
    nameEl.innerHTML = '<svg width="13" height="15" viewBox="0 0 13 15" fill="none" style="flex-shrink:0;margin-right:8px;opacity:.85" xmlns="http://www.w3.org/2000/svg"><path d="M2 1h6l3 3v10H2V1z" fill="rgba(126,101,81,.25)" stroke="var(--accent)" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 1v3h3" stroke="var(--accent)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><line x1="4" y1="7" x2="9" y2="7" stroke="var(--accent)" stroke-width="1" stroke-linecap="round" opacity=".6"/><line x1="4" y1="9.5" x2="8" y2="9.5" stroke="var(--accent)" stroke-width="1" stroke-linecap="round" opacity=".6"/></svg><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px">' + escH(file.name) + '</span><button onclick="event.stopPropagation();clearNsbFile(\\'' + which + '\\')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;line-height:1;padding:0 0 0 10px;flex-shrink:0;display:flex;align-items:center" title="Remove">×</button>'
    nameEl.style.display = 'flex'
    nameEl.style.alignItems = 'center'
    var labelEl = document.getElementById(which + '-drop').querySelector('.file-drop-label')
    if (labelEl) labelEl.style.display = 'none'
    document.getElementById(which + '-drop').classList.add('has-file')
    if (which === 'ansb') {
      loadNsbComparison()
      document.getElementById('ansb-apply-btn').disabled = false
      _updateApplyTabsNsbState(true)
    } else if (which === 'ensb') {
      loadEnsbCurrent()
    } else {
      document.getElementById('unban-apply-btn').disabled = false
    }
  }
  reader.onerror = function() {
    var noticeId = which === 'ansb' ? 'ansb-notice' : which === 'ensb' ? 'ensb-notice' : 'unban-notice'
    showNotice(noticeId, 'error', 'Could not read file: ' + (reader.error ? reader.error.message : 'unknown error'))
  }
  reader.readAsArrayBuffer(file)
}

function clearNsbFile(which) {
  _nsbData[which] = null
  var nameEl = document.getElementById(which + '-file-name')
  nameEl.innerHTML = ''
  nameEl.style.display = 'none'
  var dropEl = document.getElementById(which + '-drop')
  dropEl.classList.remove('has-file')
  var labelEl = dropEl.querySelector('.file-drop-label')
  if (labelEl) labelEl.style.display = ''
  var fileInput = document.getElementById(which + '-file')
  if (fileInput) fileInput.value = ''
  if (which === 'ansb') {
    document.getElementById('ansb-apply-btn').disabled = true
    _nsbCurrentData = null
    _ownedCrdbs = new Set()
    renderCurrencyTab(_applyPackRef, null)
    setCarSectionLocked(true)
    renderSelectedCars()
    searchCars('')
    _updateApplyTabsNsbState(false)
  } else if (which === 'ensb') {
    document.getElementById('ensb-apply-btn').disabled = true
    document.getElementById('ensb-unban-btn').disabled = true
    _ensbCurrent = {}
    _ensbFullData = null
  } else {
    document.getElementById('unban-apply-btn').disabled = true
  }
}

async function openOutputFolder() {
  await fetch('/csr2/open-folder', { method: 'POST' }).catch(function(){})
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
  document.getElementById('ensb-apply-btn').disabled = false
  document.getElementById('ensb-unban-btn').disabled = false
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
  _ownedCrdbs = new Set(Array.isArray(res.ownedCrdbs) ? res.ownedCrdbs : [])
  _nsbCurrentData = res
  renderCurrencyTab(pack, res)
  setCarSectionLocked(false)
  searchCars(document.getElementById('ansb-car-search').value)
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
  for (var i = 0; i < _csr2CarsDb.length; i++) {
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

  var packId = document.getElementById('ansb-pack-select').dataset.forcedId || document.getElementById('ansb-pack-select').value
  var curPack = _packs.find(function(p){ return p.id === packId })
  var maxCars = curPack && curPack.cars && curPack.cars.count ? curPack.cars.count : 0
  var atCap = maxCars > 0 && _selectedCars.length >= maxCars
  var selectedCrdbs = new Set(_selectedCars.map(function(c){ return c.crdb }))
  var starIcon = { Gold: '⭐', Purple: '💜', Legends: '🌟' }
  var html = '<div class="car-result-list">'
  for (var j = 0; j < matches.length; j++) {
    var car = matches[j].car, idx = matches[j].idx
    var added = !_allowDuplicates && selectedCrdbs.has(car.crdb)
    var si = starIcon[car.starType] || ''
    html += '<div class="car-result-item">'
    html += '<span class="car-tier-badge">T' + car.tier + '</span>'
    if (si) html += '<span style="font-size:11px">' + si + '</span>'
    html += '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escH(car.name) + '</span>'
    if (car.colors && car.colors.length > 1) html += '<span style="font-size:10px;color:var(--muted);flex-shrink:0">' + car.colors.length + ' clrs</span>'
    if (atCap) {
      html += '<span class="car-result-added" style="color:var(--muted)">Full</span>'
    } else if (added) {
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
  // Check max cap
  var packId = document.getElementById('ansb-pack-select').dataset.forcedId || document.getElementById('ansb-pack-select').value
  var curPack = _packs.find(function(p){ return p.id === packId })
  var maxCars = curPack && curPack.cars && curPack.cars.count ? curPack.cars.count : 0
  if (maxCars > 0 && _selectedCars.length >= maxCars) {
    showNotice('ansb-notice', 'info', 'Maximum of ' + maxCars + ' cars reached.')
    return
  }
  if (car.colors && car.colors.length === 1) {
    if (!_allowDuplicates && _selectedCars.find(function(c){ return c.crdb === car.crdb && c.colorName === car.colors[0].name })) return
    addCarWithColor(car, car.colors[0])
  } else if (car.colors && car.colors.length > 1) {
    openColorPicker(carIdx)
  } else {
    if (!_allowDuplicates && _selectedCars.find(function(c){ return c.crdb === car.crdb })) return
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
    var alreadySelected = !_allowDuplicates && selectedKeys.has(car.crdb + '|' + col.name)
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
  if (!_allowDuplicates && _selectedCars.find(function(c){ return c.crdb === car.crdb && c.colorName === color.name })) {
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
  if (!list) { if (count) count.textContent = '0 cars selected'; if (badge) badge.textContent = '(0 selected)'; return }
  if (!n) {
    if (count) count.textContent = '0 cars selected'
    if (badge) badge.textContent = '(0 selected)'
    list.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;margin-top:20px">No cars selected.<br>Search and add cars on the left.</div>'
    if (noteEl) noteEl.style.display = 'none'
    return
  }
  var html = ''
  var eligibleCount = 0
  for (var i = 0; i < _selectedCars.length; i++) {
    var car = _selectedCars[i]
    var isOwned = !_allowDuplicates && _ownedCrdbs.size > 0 && _ownedCrdbs.has(car.crdb)
    if (!isOwned) eligibleCount++
    var crdbEsc = escH(car.crdb || '')
    var colEsc = escH(car.colorName || '')
    html += '<div class="selected-car-item" style="position:relative">'
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
    if (isOwned) html += '<div style="position:absolute;inset:0;background:rgba(0,0,0,.6);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;pointer-events:none"><span style="font-size:11px;color:#ef4444;font-weight:600">Duplicate car</span><span style="font-size:10px;color:rgba(239,68,68,.8)">Enable Allow Duplicates</span></div>'
    html += '</div>'
  }
  list.innerHTML = html
  var displayCount = (!_allowDuplicates && _ownedCrdbs.size > 0) ? eligibleCount : n
  var carLimit = _applyPackRef
    ? (_partialSelectionEnabled && _applyPackRef.cars && _applyPackRef.cars.partial && _applyPackRef.cars.partial.count
        ? _applyPackRef.cars.partial.count
        : (_applyPackRef.cars ? _applyPackRef.cars.count : null))
    : null
  var limitStr = carLimit ? ' / ' + fmtN(carLimit) : ''
  if (count) count.textContent = displayCount + limitStr + ' car' + (displayCount === 1 && !carLimit ? '' : 's') + ' selected' + (displayCount < n ? ' (' + n + ' chosen, ' + (n - displayCount) + ' skipped)' : '')
  if (badge) badge.textContent = '(' + displayCount + limitStr + ' selected)'
  if (noteEl) {
    var packId = document.getElementById('ansb-pack-select').dataset.forcedId || document.getElementById('ansb-pack-select').value
    var pack = _packs.find(function(p){ return p.id === packId })
    var rawTotal = pack && pack.cars && pack.cars.count ? pack.cars.count : 0
    var total = (_partialSelectionEnabled && pack && pack.cars && pack.cars.partial && pack.cars.partial.count)
      ? pack.cars.partial.count
      : rawTotal
    if (total > 0) {
      var remaining = Math.max(0, total - displayCount)
      noteEl.style.display = ''
      if (remaining > 0) {
        // Check if all selectable (non-owned, not already selected) cars have been added
        var selCrdbSet = new Set(_selectedCars.map(function(c){ return c.crdb + '|' + (c.colorName || '') }))
        var moreAvail = 0
        for (var ci = 0; ci < _csr2CarsDb.length; ci++) {
          var dbCar = _csr2CarsDb[ci]
          if (!dbCar.crdb) continue
          if (!_allowDuplicates && _ownedCrdbs.has(dbCar.crdb)) continue
          var carKey = dbCar.crdb + '|' + (dbCar.colors && dbCar.colors[0] ? dbCar.colors[0].name : '')
          if (!selCrdbSet.has(dbCar.crdb + '|' + (dbCar.colors && dbCar.colors[0] ? dbCar.colors[0].name || '' : ''))) { moreAvail++; break }
        }
        if (moreAvail === 0 && displayCount > 0) {
          noteEl.textContent = displayCount + '/' + total + ' selected — all available cars added! Remaining ' + remaining + ' will be filled randomly.'
        } else {
          noteEl.textContent = displayCount + '/' + total + ' selected. Remaining ' + remaining + ' will be filled randomly.'
        }
      } else {
        noteEl.textContent = displayCount + '/' + total + ' selected. All slots filled!'
      }
    } else {
      noteEl.style.display = 'none'
    }
  }
}

async function applyNsb() {
  if (!_nsbData.ansb) return
  var packId = document.getElementById('ansb-pack-select').dataset.forcedId || document.getElementById('ansb-pack-select').value
  showLoading('Applying pack...')
  var payload = {
    nsbBase64: _nsbData.ansb.base64,
    packId: packId,
    allowDuplicates: _allowDuplicates,
    usePartialSelection: _partialSelectionEnabled,
    currencyOverride: Object.keys(_currencyOverride).length > 0 ? _currencyOverride : undefined,
    selectedLegends: _selectedLegends.length > 0 ? _selectedLegends.map(function(l){ return l.crdb }) : undefined,
    selectedBrands: (_fusionS6Choice !== 'stage6' && _selectedBrands.length > 0) ? _selectedBrands.map(function(b){ return b.id }) : undefined,
    selectedS6Cars: (_fusionS6Choice !== 'fusions' && _selectedS6Cars.length > 0) ? _selectedS6Cars.map(function(c){ return c.crdb }) : undefined
  }
  if (_selectedCars.length > 0 && (_partialSelectionEnabled || (_applyPackRef && _applyPackRef.cars && _applyPackRef.cars.carMode === 'customizable'))) {
    payload.selectedCars = _selectedCars
  }
  var startRes = await fetch('/csr2/apply-nsb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (startRes.error) { hideLoading(); showNotice('ansb-notice', 'error', startRes.error); return }
  var res = await pollApplyJob(startRes.jobId)
  hideLoading()
  if (res.error) { showNotice('ansb-notice', 'error', res.error); return }
  var fname = _nsbData.ansb.name || 'PlayerProfile'
  var ansbInput = document.getElementById('ansb-file')
  if (ansbInput) ansbInput.value = ''
  if (_csr2OutputFolder) {
    var saved = await saveNsbToFolder(res.resultBase64, fname, { title: 'Pack Applied!', desc: res.note || '', folderMode: true, whichNsb: 'ansb' })
    if (!saved.conflict) showApplyResult(true, 'Pack Applied!', res.note || '', true, 'ansb')
  } else {
    downloadNsb(res.resultBase64, fname)
    showApplyResult(true, 'Pack Applied!', 'The modified save file has been downloaded.' + (res.note ? '\\n\\n' + res.note : ''), false, 'ansb')
  }
}

async function pollApplyJob(jobId) {
  while (true) {
    await new Promise(function(r){ setTimeout(r, 500) })
    var poll = await fetch('/csr2/apply-progress?jobId=' + encodeURIComponent(jobId))
      .then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
    if (poll.error) return poll
    if (poll.done) return poll
    document.getElementById('loading-msg').textContent = poll.progress || 'Applying pack...'
  }
}

// ─── NSB Full Editor ──────────────────────────────────────────────────────────

async function openEnsbEditor() {
  if (!_nsbData.ensb) return
  showLoading('Reading save file...')
  var res = await fetch('/csr2/read-nsb-full', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nsbBase64: _nsbData.ensb.base64 })
  }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  hideLoading()
  if (res.error) { showNotice('ensb-notice', 'error', 'Could not read save: ' + res.error); return }
  _ensbFullData = res
  var c = res.currencies || {}
  _ensbEditorState = {
    currency: {
      cash: c.cash || 0, gold: c.gold || 0,
      bronzeKeys: c.bronzeKeys || 0, silverKeys: c.silverKeys || 0, goldKeys: c.goldKeys || 0,
      fuel: c.fuel || 0, fusionGreen: c.fusionGreen || 0, fusionBlue: c.fusionBlue || 0,
      fusionRed: c.fusionRed || 0, fusionYellow: c.fusionYellow || 0,
    },
    garageQueue: [],
    legends: {},
    fusions: {},
    stage6: {},
  }
  var owned = (res.legends && res.legends.owned) || []
  for (var i = 0; i < owned.length; i++) _ensbEditorState.legends[owned[i].crdb] = owned[i].amount
  var brands = (res.fusions && res.fusions.brands) || []
  for (var j = 0; j < brands.length; j++) _ensbEditorState.fusions[brands[j].id] = brands[j].amount
  var s6cars = (res.stage6 && res.stage6.cars) || []
  for (var k = 0; k < s6cars.length; k++) _ensbEditorState.stage6[s6cars[k].id] = s6cars[k].amount
  _ensbActiveTab = 'currency'
  showModal('ensb-editor-modal')
  renderEnsbLeftPanel()
  switchEnsbTab('currency')
}

function switchEnsbTab(tab) {
  _ensbActiveTab = tab
  var tabs = ['currency','garage','legends','fusions','stage6']
  for (var i = 0; i < tabs.length; i++) {
    var btn = document.getElementById('ensb-tab-' + tabs[i])
    if (btn) btn.classList.toggle('active', tabs[i] === tab)
  }
  if (tab === 'currency') renderEnsbCurrencyTab()
  else if (tab === 'garage') renderEnsbGarageTab()
  else if (tab === 'legends') renderEnsbLegendsTab()
  else if (tab === 'fusions') renderEnsbFusionsTab()
  else if (tab === 'stage6') renderEnsbStage6Tab()
}

function renderEnsbLeftPanel() {
  var c = _ensbEditorState.currency
  var baseCarCount = _ensbFullData ? (_ensbFullData.garage && _ensbFullData.garage.carCount || 0) : 0
  var carCount = baseCarCount + _ensbEditorState.garageQueue.length
  var legendCount = Object.keys(_ensbEditorState.legends).length
  var fusionBrands = Object.values(_ensbEditorState.fusions).filter(function(v){ return v > 0 }).length
  var s6Cars = Object.values(_ensbEditorState.stage6).filter(function(v){ return v > 0 }).length
  var accountName = (_nsbData && _nsbData.ensb && _nsbData.ensb.name) || ''
  var playerName = (_ensbFullData && _ensbFullData.playerName) || ''
  var rows = [
    ['💵 Cash', fmtN(c.cash || 0)],
    ['🪙 Gold', fmtN(c.gold || 0)],
    ['🔑 Bronze Keys', fmtN(c.bronzeKeys || 0)],
    ['🗝️ Silver Keys', fmtN(c.silverKeys || 0)],
    ['✨ Gold Keys', fmtN(c.goldKeys || 0)],
    ['⛽ Fuel', fmtN(c.fuel || 0)],
    ['🟢 Green Tokens', fmtN(c.fusionGreen || 0)],
    ['🔵 Blue Tokens', fmtN(c.fusionBlue || 0)],
    ['🔴 Red Tokens', fmtN(c.fusionRed || 0)],
    ['🟡 Yellow Tokens', fmtN(c.fusionYellow || 0)],
    null,
    ['🚗 Cars', carCount],
    ['⭐ Legends', legendCount],
    ['⚗️ Fusion Brands', fusionBrands],
    ['6️⃣ Stage 6 Cars', s6Cars],
  ]
  var html = ''
  if (accountName) {
    html += '<div style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)">'
    html += '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);margin-bottom:4px">Save File</div>'
    html += '<div style="font-size:13px;font-weight:600;word-break:break-all;line-height:1.3">' + escH(accountName) + '</div>'
    if (playerName) html += '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + escH(playerName) + '</div>'
    html += '</div>'
  }
  html += '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);margin-bottom:10px">Account Stats</div>'
  for (var i = 0; i < rows.length; i++) {
    if (!rows[i]) { html += '<div style="height:1px;background:var(--border);margin:10px 0"></div>'; continue }
    html += '<div style="padding:5px 0;display:flex;flex-direction:column;gap:1px">'
    html += '<div style="font-size:10px;color:var(--muted);line-height:1.2">' + rows[i][0] + '</div>'
    html += '<div style="font-size:13px;font-weight:600;line-height:1.3">' + rows[i][1] + '</div>'
    html += '</div>'
  }
  var panel = document.getElementById('ensb-left-panel')
  if (panel) panel.innerHTML = html
}

function renderEnsbCurrencyTab() {
  var c = _ensbEditorState.currency
  var fields = [
    { key:'cash',         label:'💵 Cash',          id:'ensbe-cash' },
    { key:'gold',         label:'🪙 Gold',           id:'ensbe-gold' },
    { key:'bronzeKeys',   label:'🔑 Bronze Keys',    id:'ensbe-bkeys' },
    { key:'silverKeys',   label:'🗝 Silver Keys',    id:'ensbe-skeys' },
    { key:'goldKeys',     label:'✨ Gold Keys',      id:'ensbe-gkeys' },
    { key:'fuel',         label:'⛽ Fuel',            id:'ensbe-fuel' },
    { key:'fusionGreen',  label:'🟢 Green Tokens',   id:'ensbe-fgreen' },
    { key:'fusionBlue',   label:'🔵 Blue Tokens',    id:'ensbe-fblue' },
    { key:'fusionRed',    label:'🔴 Red Tokens',     id:'ensbe-fred' },
    { key:'fusionYellow', label:'🟡 Yellow Tokens',  id:'ensbe-fyellow' },
  ]
  var html = '<div style="display:flex;flex-direction:column;gap:8px;max-width:420px">'
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i]
    html += '<div class="ensb-row"><span class="ensb-label">' + f.label + '</span>'
    html += '<input type="number" class="ensb-input" id="' + f.id + '" value="' + (c[f.key] || 0) + '" min="0" '
    html += 'oninput="ensbCurrencyChange(\\'' + f.key + '\\',this.value)"></div>'
  }
  html += '</div>'
  document.getElementById('ensb-tab-content').innerHTML = html
}

function ensbCurrencyChange(key, val) {
  _ensbEditorState.currency[key] = Math.max(0, parseInt(val) || 0)
  renderEnsbLeftPanel()
}

var _ensbGarageSearch = ''

function renderEnsbGarageTab() {
  var q = _ensbGarageSearch.toLowerCase()
  var ownedSet = new Set(_ensbFullData ? (_ensbFullData.garage && _ensbFullData.garage.ownedCrdbs || []) : [])
  var queueSet = new Set(_ensbEditorState.garageQueue.map(function(c){ return c.crdb }))
  var available = _csr2CarsDb.filter(function(car){ return car.crdb && !ownedSet.has(car.crdb) && !queueSet.has(car.crdb) })
  var filtered = q ? available.filter(function(car){ return (car.name||'').toLowerCase().includes(q) || (car.crdb||'').toLowerCase().includes(q) }) : available
  var html = '<div style="display:flex;gap:16px;height:calc(100% - 0px)">'
  html += '<div style="flex:1;display:flex;flex-direction:column;gap:8px;min-width:0">'
  html += '<input id="ensb-garage-search" placeholder="Search cars..." value="' + escH(_ensbGarageSearch) + '" '
  html += 'style="background:var(--surf2);border:1px solid var(--border);border-radius:7px;padding:7px 10px;color:var(--text);font-size:13px;outline:none;width:100%;box-sizing:border-box" '
  html += 'oninput="_ensbGarageSearch=this.value;renderEnsbGarageTab()">'
  html += '<div style="font-size:12px;color:var(--muted)">' + filtered.length + ' available</div>'
  html += '<div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px">'
  var show = filtered.slice(0, 80)
  for (var i = 0; i < show.length; i++) {
    var car = show[i]
    var safecrdb = car.crdb.replace(/'/g,"\\\\'")
    var safename = (car.name||car.crdb).replace(/'/g,"\\\\'").replace(/"/g,'&quot;')
    html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--surf2);border:1px solid var(--border);border-radius:7px">'
    html += '<span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escH(car.name || car.crdb) + '</span>'
    html += '<button onclick="ensbAddCarToQueue(\\'' + safecrdb + '\\',\\'' + safename + '\\',false)" style="background:var(--surf);border:1px solid var(--border);border-radius:5px;padding:3px 8px;cursor:pointer;font-size:12px;color:var(--text);white-space:nowrap">Stock</button>'
    html += '<button onclick="ensbAddCarToQueue(\\'' + safecrdb + '\\',\\'' + safename + '\\',true)" style="background:rgba(126,101,81,.15);border:1px solid var(--accent);border-radius:5px;padding:3px 8px;cursor:pointer;font-size:12px;color:var(--accent);white-space:nowrap">Max</button>'
    html += '</div>'
  }
  if (filtered.length > 80) html += '<div style="font-size:11px;color:var(--muted);padding:6px;text-align:center">+' + (filtered.length - 80) + ' more — search to filter</div>'
  if (filtered.length === 0) html += '<div style="color:var(--muted);font-size:13px;padding:8px 0">No cars found.</div>'
  html += '</div></div>'
  html += '<div style="width:220px;min-width:220px;display:flex;flex-direction:column;gap:8px">'
  html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)">Queue (' + _ensbEditorState.garageQueue.length + ')</div>'
  html += '<div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px">'
  for (var j = 0; j < _ensbEditorState.garageQueue.length; j++) {
    var qcar = _ensbEditorState.garageQueue[j]
    html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--surf2);border:1px solid var(--border);border-radius:7px">'
    html += '<span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escH(qcar.name) + '</span>'
    html += '<span style="font-size:11px;color:var(--muted);white-space:nowrap">' + (qcar.maxed ? 'Max' : 'Stock') + '</span>'
    html += '<button onclick="ensbRemoveCarFromQueue(' + j + ')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;line-height:1;padding:0 2px" title="Remove">×</button>'
    html += '</div>'
  }
  if (_ensbEditorState.garageQueue.length === 0) {
    html += '<div style="color:var(--muted);font-size:13px;line-height:1.5">No cars queued.<br><small>Click Stock or Max to add.</small></div>'
  }
  html += '</div></div></div>'
  document.getElementById('ensb-tab-content').innerHTML = html
}

function ensbAddCarToQueue(crdb, name, maxed) {
  _ensbEditorState.garageQueue.push({ crdb: crdb, name: name, maxed: maxed })
  renderEnsbGarageTab()
  renderEnsbLeftPanel()
}

function ensbRemoveCarFromQueue(idx) {
  _ensbEditorState.garageQueue.splice(idx, 1)
  renderEnsbGarageTab()
  renderEnsbLeftPanel()
}

function renderEnsbLegendsTab() {
  var ownedSet = new Set(Object.keys(_ensbEditorState.legends))
  var html = '<div style="max-width:520px">'
  html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:8px">Owned (' + ownedSet.size + ')</div>'
  if (ownedSet.size === 0) html += '<div style="color:var(--muted);font-size:13px;margin-bottom:12px">No legend cars owned. Add from below.</div>'
  for (var i = 0; i < LEGEND_CARS.length; i++) {
    var lc = LEGEND_CARS[i]
    if (!ownedSet.has(lc.crdb)) continue
    var amt = _ensbEditorState.legends[lc.crdb] || 0
    html += '<div style="display:flex;align-items:center;gap:10px;padding:7px 12px;background:var(--surf2);border:1px solid var(--border);border-radius:7px;margin-bottom:4px">'
    html += '<span style="flex:1;font-size:13px">' + escH(lc.name) + '</span>'
    html += '<span style="font-size:11px;color:var(--muted)">max ' + fmtN(lc.amount) + '</span>'
    html += '<input type="number" value="' + amt + '" min="0" max="' + lc.amount + '" '
    html += 'oninput="ensbLegendChange(\\'' + lc.crdb + '\\',this.value)" '
    html += 'style="width:90px;background:var(--surf);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text);font-size:13px;outline:none;text-align:right">'
    html += '<button onclick="ensbRemoveLegend(\\'' + lc.crdb + '\\')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;line-height:1;padding:0 2px" title="Remove">×</button>'
    html += '</div>'
  }
  var available = LEGEND_CARS.filter(function(lc){ return !ownedSet.has(lc.crdb) })
  html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin:16px 0 8px">Available (' + available.length + ')</div>'
  for (var j = 0; j < available.length; j++) {
    var lc2 = available[j]
    html += '<div style="display:flex;align-items:center;gap:10px;padding:7px 12px;background:var(--surf2);border:1px solid var(--border);border-radius:7px;margin-bottom:4px">'
    html += '<span style="flex:1;font-size:13px">' + escH(lc2.name) + '</span>'
    html += '<span style="font-size:11px;color:var(--muted)">max ' + fmtN(lc2.amount) + '</span>'
    html += '<button onclick="ensbAddLegend(\\'' + lc2.crdb + '\\')" '
    html += 'style="background:var(--surf);border:1px solid var(--border);border-radius:5px;padding:4px 12px;cursor:pointer;font-size:12px;color:var(--accent)">Add</button>'
    html += '</div>'
  }
  if (available.length === 0) html += '<div style="color:var(--muted);font-size:13px">All legend cars are already owned.</div>'
  html += '</div>'
  document.getElementById('ensb-tab-content').innerHTML = html
}

function ensbAddLegend(crdb) {
  var lc = LEGEND_CARS.find(function(l){ return l.crdb === crdb })
  if (!lc) return
  _ensbEditorState.legends[crdb] = lc.amount
  renderEnsbLegendsTab()
  renderEnsbLeftPanel()
}

function ensbRemoveLegend(crdb) {
  delete _ensbEditorState.legends[crdb]
  renderEnsbLegendsTab()
  renderEnsbLeftPanel()
}

function ensbLegendChange(crdb, val) {
  _ensbEditorState.legends[crdb] = Math.max(0, parseInt(val) || 0)
  renderEnsbLeftPanel()
}

function renderEnsbFusionsTab() {
  var brands = (_ensbFullData && _ensbFullData.fusions && _ensbFullData.fusions.brands) || []
  if (brands.length === 0) {
    document.getElementById('ensb-tab-content').innerHTML = '<div style="color:var(--muted);font-size:13px">No fusion data — download car database first.</div>'
    return
  }
  var html = '<div style="display:flex;flex-direction:column;gap:6px;max-width:460px">'
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:4px">' + brands.length + ' brands</div>'
  for (var i = 0; i < brands.length; i++) {
    var b = brands[i]
    var amt = _ensbEditorState.fusions[b.id] !== undefined ? _ensbEditorState.fusions[b.id] : b.amount
    html += '<div class="ensb-row"><span class="ensb-label">' + escH(b.name || b.id) + '</span>'
    html += '<input type="number" class="ensb-input" value="' + amt + '" min="0" '
    html += 'oninput="ensbFusionChange(\\'' + b.id.replace(/'/g,"\\\\'") + '\\',this.value)"></div>'
  }
  html += '</div>'
  document.getElementById('ensb-tab-content').innerHTML = html
}

function ensbFusionChange(brandId, val) {
  _ensbEditorState.fusions[brandId] = Math.max(0, parseInt(val) || 0)
  renderEnsbLeftPanel()
}

function renderEnsbStage6Tab() {
  var cars = (_ensbFullData && _ensbFullData.stage6 && _ensbFullData.stage6.cars) || []
  if (cars.length === 0) {
    document.getElementById('ensb-tab-content').innerHTML = '<div style="color:var(--muted);font-size:13px">No stage 6 data — download car database first.</div>'
    return
  }
  var html = '<div style="display:flex;flex-direction:column;gap:6px;max-width:460px">'
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:4px">' + cars.length + ' cars</div>'
  for (var i = 0; i < cars.length; i++) {
    var car = cars[i]
    var amt = _ensbEditorState.stage6[car.id] !== undefined ? _ensbEditorState.stage6[car.id] : car.amount
    html += '<div class="ensb-row"><span class="ensb-label">' + escH(car.name || car.id) + '</span>'
    html += '<input type="number" class="ensb-input" value="' + amt + '" min="0" '
    html += 'oninput="ensbStage6Change(\\'' + car.id.replace(/'/g,"\\\\'") + '\\',this.value)"></div>'
  }
  html += '</div>'
  document.getElementById('ensb-tab-content').innerHTML = html
}

function ensbStage6Change(carId, val) {
  _ensbEditorState.stage6[carId] = Math.max(0, parseInt(val) || 0)
  renderEnsbLeftPanel()
}

async function downloadEnsbFull() {
  if (!_nsbData.ensb) return
  showLoading('Starting...')
  var startRes = await fetch('/csr2/edit-nsb-full', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nsbBase64: _nsbData.ensb.base64,
      currency: _ensbEditorState.currency,
      garageQueue: _ensbEditorState.garageQueue,
      legends: _ensbEditorState.legends,
      fusions: _ensbEditorState.fusions,
      stage6: _ensbEditorState.stage6,
    })
  }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (startRes.error) { hideLoading(); return }
  var jobId = startRes.jobId
  var result = null
  for (var n = 0; n < 180; n++) {
    await new Promise(function(r){ setTimeout(r, 1000) })
    var poll = await fetch('/csr2/apply-progress?jobId=' + jobId).then(function(r){ return r.json() }).catch(function(){ return null })
    if (!poll) continue
    if (poll.progress) showLoading(poll.progress)
    if (poll.done) { result = poll; break }
  }
  hideLoading()
  if (!result || result.error) return
  var fname = _nsbData.ensb.name || 'PlayerProfile'
  if (_csr2OutputFolder) {
    var saved = await saveNsbToFolder(result.resultBase64, fname, { title: 'Edits Applied!', desc: result.note || '', folderMode: true, whichNsb: 'ensb' })
    if (!saved.conflict) {
      hideModal('ensb-editor-modal')
      showApplyResult(true, 'Edits Applied!', result.note || '', true, 'ensb')
    }
  } else {
    downloadNsb(result.resultBase64, fname)
    hideModal('ensb-editor-modal')
    showApplyResult(true, 'Edits Applied!', result.note || 'The modified save file has been downloaded.', false, 'ensb')
  }
}

function showApplyResult(ok, title, desc, folderMode, whichNsb) {
  document.getElementById('apply-result-icon').textContent = ok ? '✅' : '❌'
  document.getElementById('apply-result-title').textContent = title
  var descEl = document.getElementById('apply-result-desc')
  if (desc) { descEl.textContent = desc; descEl.style.display = '' } else { descEl.style.display = 'none' }
  var actions = document.getElementById('apply-result-actions')
  var w = whichNsb || 'ansb'
  var clearAndClose = 'clearNsbFile(\\'' + w + '\\');hideModal(\\'apply-result-modal\\');hideModal(\\'apply-nsb-modal\\')'
  if (folderMode) {
    actions.innerHTML =
      '<button class="btn btn-secondary" onclick="openOutputFolder()">📂 Go to location</button>' +
      '<button class="btn btn-secondary" onclick="hideModal(\\'apply-result-modal\\')">Edit</button>' +
      '<button class="btn btn-primary" onclick="' + clearAndClose + '">Complete</button>'
  } else {
    actions.innerHTML = '<button class="btn btn-primary" onclick="' + clearAndClose + '">Done</button>'
  }
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

async function saveNsbToFolder(b64, filename, applyCtx) {
  var res = await fetch('/csr2/save-nsb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64: b64, filename: filename })
  }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (res.conflict) {
    _pendingSavePack = Object.assign({ b64: b64, filename: filename }, applyCtx || {})
    document.getElementById('nsb-conflict-name').textContent = res.existingFile || 'existing file'
    showModal('nsb-conflict-modal')
    return { conflict: true }
  }
  return { ok: true }
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
  if (p.title) showApplyResult(true, p.title, p.desc || '', p.folderMode, p.whichNsb)
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
  if (_csr2OutputFolder) {
    var savedU = await saveNsbToFolder(res.resultBase64, fname, { title: 'Unban Applied!', desc: 'The account has been unbanned.', folderMode: true, whichNsb: 'ensb' })
    if (!savedU.conflict) showApplyResult(true, 'Unban Applied!', 'The account has been unbanned.', true, 'ensb')
  } else {
    downloadNsb(res.resultBase64, fname)
    showApplyResult(true, 'Unban Applied!', 'The modified save file has been downloaded. The account has been unbanned.', false, 'ensb')
  }
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
  if (req.method === 'POST' && pathname === '/csr2/packs/sync-all') {
    const packs = loadPacks()
    packs.forEach(p => syncPackToWebapp(p))
    return json(res, 200, { synced: packs.length })
  }

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
    syncPackToWebapp(body)
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
      syncPackToWebapp(packs[idx])
      return json(res, 200, packs[idx])
    }
    if (req.method === 'DELETE') {
      const packs = loadPacks()
      const target = packs.find(p => p.id === id)
      savePacks(packs.filter(p => p.id !== id))
      if (target?.name) deletePackFromWebapp(target.name)
      return json(res, 200, { ok: true })
    }
  }

  // CSR2 car packs CRUD
  if (req.method === 'GET' && pathname === '/csr2/car-packs') {
    return json(res, 200, loadCarPacks())
  }
  if (req.method === 'POST' && pathname === '/csr2/car-packs') {
    const body = await readBody(req)
    const packs = loadCarPacks()
    body.id = uid()
    body.createdAt = new Date().toISOString()
    packs.push(body)
    saveCarPacks(packs)
    return json(res, 200, body)
  }
  const carPackM = pathname.match(/^\/csr2\/car-packs\/(.+)$/)
  if (carPackM) {
    const id = carPackM[1]
    if (req.method === 'PATCH') {
      const body = await readBody(req)
      const packs = loadCarPacks()
      const idx = packs.findIndex(p => p.id === id)
      if (idx === -1) return json(res, 404, { error: 'Car pack not found' })
      packs[idx] = { ...packs[idx], ...body }
      saveCarPacks(packs)
      return json(res, 200, packs[idx])
    }
    if (req.method === 'DELETE') {
      saveCarPacks(loadCarPacks().filter(p => p.id !== id))
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

  // CSR2 open output folder in Explorer
  if (req.method === 'POST' && pathname === '/csr2/open-folder') {
    const cfg = loadConfig()
    const folder = cfg.csr2OutputFolder
    if (!folder) return json(res, 400, { error: 'No output folder configured' })
    exec('explorer "' + folder + '"', function() {})
    return json(res, 200, { ok: true })
  }

  // CSR2 edit-nsb (manual add to existing values)
  // CSR2 read-nsb-full — full parsed data for the editor
  if (req.method === 'POST' && pathname === '/csr2/read-nsb-full') {
    const body = await readBody(req)
    if (!body.nsbBase64) return json(res, 400, { error: 'Missing nsbBase64' })
    try {
      const buf = Buffer.from(body.nsbBase64, 'base64')
      const data = csr2ReadSave(buf)
      const currencies = {
        cash:         Math.max(0, (data.caea || 0) - (data.casp || 0)),
        gold:         Math.max(0, (data.goea || 0) - (data.gosp || 0)),
        bronzeKeys:   Math.max(0, (data.gbke || 0) - (data.gbks || 0)),
        silverKeys:   Math.max(0, (data.gske || 0) - (data.gsks || 0)),
        goldKeys:     Math.max(0, (data.ggke || 0) - (data.ggks || 0)),
        fuel:         data.fupi || 0,
        fusionGreen:  (data.afme && data.afme.Green)  || 0,
        fusionBlue:   (data.afme && data.afme.Blue)   || 0,
        fusionRed:    (data.afme && data.afme.Red)    || 0,
        fusionYellow: (data.afme && data.afme.Yellow) || 0,
      }
      const ownedCrdbs = Array.isArray(data.caow) ? data.caow.map(c => c.crdb).filter(Boolean) : []
      const crpe = data.crpe || {}
      const lcMap = LEGEND_CARS.reduce((m, lc) => { m[lc.crdb] = lc; return m }, {})
      const legendsOwned = []
      for (const [crdb, amount] of Object.entries(crpe)) {
        const lc = lcMap[crdb]; if (lc) legendsOwned.push({ crdb, name: lc.name, amount, maxAmount: lc.amount })
      }
      const legendsAvailable = LEGEND_CARS.filter(lc => !(lc.crdb in crpe)).map(lc => ({ crdb: lc.crdb, name: lc.name, maxAmount: lc.amount }))
      const fusionData = loadFusionData()
      const fusAmounts = {}
      for (let i = 0; i < (data.caup || []).length; i++) {
        const e = data.caup[i]
        if (typeof e === 'object' && e !== null && e.upma) {
          const next = data.caup[i + 1]; if (typeof next === 'number') fusAmounts[e.upma] = next
        }
      }
      const fusSeen = new Map()
      for (let i = 0; i < fusionData.length; i++) {
        const e = fusionData[i]
        if (typeof e === 'object' && e !== null && e.upma && !fusSeen.has(e.upma))
          fusSeen.set(e.upma, { id: e.upma, name: e.upma, amount: fusAmounts[e.upma] || 0 })
      }
      const stage6Data = loadStage6Data()
      const s6Amounts = {}
      for (let i = 0; i < (data.cues || []).length; i++) {
        const e = data.cues[i]
        if (typeof e === 'object' && e !== null && e.esdb) {
          const next = data.cues[i + 1]; if (typeof next === 'number') s6Amounts[e.esdb] = next
        }
      }
      const carsDb = loadCsr2Cars()
      const nameMap = {}; for (const car of carsDb) { if (car.crdb) nameMap[car.crdb] = car.name }
      const s6Seen = new Map()
      for (let i = 0; i < stage6Data.length; i++) {
        const e = stage6Data[i]
        if (typeof e === 'object' && e !== null && e.esdb && !s6Seen.has(e.esdb))
          s6Seen.set(e.esdb, { id: e.esdb, name: nameMap[e.esdb] || e.esdb, amount: s6Amounts[e.esdb] || 0 })
      }
      return json(res, 200, {
        currencies,
        playerName: data.pnam || data.prfn || '',
        garage: { carCount: ownedCrdbs.length, ownedCrdbs },
        legends: { owned: legendsOwned, available: legendsAvailable },
        fusions: { brands: Array.from(fusSeen.values()) },
        stage6: { cars: Array.from(s6Seen.values()) },
      })
    } catch (e) {
      log('[csr2/read-nsb-full] Error: ' + e.message)
      return json(res, 500, { error: e.message })
    }
  }

  // CSR2 edit-nsb-full — full editor: currency SET, legends SET, fusions SET, stage6 SET, garage ADD
  if (req.method === 'POST' && pathname === '/csr2/edit-nsb-full') {
    const body = await readBody(req)
    if (!body.nsbBase64) return json(res, 400, { error: 'Missing nsbBase64' })
    const jobId = uid()
    applyJobs.set(jobId, { progress: 'Starting...', done: false, result: null })
    ;(async () => {
      try {
        const buf = Buffer.from(body.nsbBase64, 'base64')
        const data = csr2ReadSave(buf)
        // Currency — set final value (caea = casp + desired, so balance = desired)
        const c = body.currency || {}
        if ('cash'        in c) data.caea = (data.casp || 0) + Math.max(0, c.cash)
        if ('gold'        in c) data.goea = (data.gosp || 0) + Math.max(0, c.gold)
        if ('bronzeKeys'  in c) data.gbke = (data.gbks || 0) + Math.max(0, c.bronzeKeys)
        if ('silverKeys'  in c) data.gske = (data.gsks || 0) + Math.max(0, c.silverKeys)
        if ('goldKeys'    in c) data.ggke = (data.ggks || 0) + Math.max(0, c.goldKeys)
        if ('fuel'        in c) data.fupi = Math.max(0, c.fuel)
        if (!data.afme) data.afme = {}
        if ('fusionGreen'  in c) data.afme.Green  = Math.max(0, c.fusionGreen)
        if ('fusionBlue'   in c) data.afme.Blue   = Math.max(0, c.fusionBlue)
        if ('fusionRed'    in c) data.afme.Red    = Math.max(0, c.fusionRed)
        if ('fusionYellow' in c) data.afme.Yellow = Math.max(0, c.fusionYellow)
        // Legends — replace crpe entirely with editor state
        if (body.legends && typeof body.legends === 'object') {
          data.crpe = {}
          for (const [crdb, amount] of Object.entries(body.legends)) data.crpe[crdb] = Math.max(0, parseInt(amount) || 0)
        }
        // Fusions — rebuild caup from template with overridden amounts
        const fusDelta = body.fusions && typeof body.fusions === 'object' ? body.fusions : null
        if (fusDelta && Object.keys(fusDelta).length > 0) {
          const fusionData = loadFusionData()
          if (Array.isArray(fusionData) && fusionData.length > 0) {
            const newCaup = []
            for (let i = 0; i < fusionData.length; i++) {
              const e = fusionData[i]
              if (typeof e === 'object' && e !== null && e.upma) {
                newCaup.push(e)
                const next = fusionData[i + 1]
                if (typeof next === 'number') { newCaup.push(e.upma in fusDelta ? Math.max(0, fusDelta[e.upma]) : next); i++ }
              } else if (typeof e !== 'number') { newCaup.push(e) }
            }
            data.caup = newCaup
          }
        }
        // Stage 6 — rebuild cues from template with overridden amounts
        const s6Delta = body.stage6 && typeof body.stage6 === 'object' ? body.stage6 : null
        if (s6Delta && Object.keys(s6Delta).length > 0) {
          const stage6Data = loadStage6Data()
          if (Array.isArray(stage6Data) && stage6Data.length > 0) {
            const newCues = []
            for (let i = 0; i < stage6Data.length; i++) {
              const e = stage6Data[i]
              if (typeof e === 'object' && e !== null && e.esdb) {
                newCues.push(e)
                const next = stage6Data[i + 1]
                if (typeof next === 'number') { newCues.push(e.esdb in s6Delta ? Math.max(0, s6Delta[e.esdb]) : next); i++ }
              } else if (typeof e !== 'number') { newCues.push(e) }
            }
            data.cues = newCues
          }
        }
        // Garage — add queued cars
        let note = null
        const garageQueue = Array.isArray(body.garageQueue) ? body.garageQueue : []
        if (garageQueue.length > 0) {
          if (!Array.isArray(data.caow)) data.caow = []
          if (typeof data.ncui !== 'number' || data.ncui < data.caow.length) data.ncui = data.caow.length
          const ownedCrdbs = new Set(data.caow.map(c => c.crdb).filter(Boolean))
          const carsDb = loadCsr2Cars()
          const dbMap = {}; for (const car of carsDb) { if (car.crdb) dbMap[car.crdb] = car }
          const setProgress = msg => { const job = applyJobs.get(jobId); if (job) job.progress = msg }
          const toAdd = garageQueue.filter(q => q.crdb && !ownedCrdbs.has(q.crdb))
          let added = 0, failed = 0
          for (let i = 0; i < toAdd.length; i++) {
            const q = toAdd[i]
            setProgress('Fetching car data... ' + i + ' / ' + toAdd.length)
            const dbCar = dbMap[q.crdb]
            if (!dbCar) { failed++; continue }
            try {
              const col = (dbCar.colors && dbCar.colors[0]) || {}
              const txtUrl = q.maxed ? (col.maxedTxtUrl || col.stockTxtUrl) : col.stockTxtUrl
              if (!txtUrl) { failed++; continue }
              const txt = await fetchRawGithub(txtUrl)
              const carJson = JSON.parse(txt)
              carJson.unid = data.ncui++
              data.caow.push(carJson)
              ownedCrdbs.add(q.crdb)
              added++
            } catch { failed++ }
          }
          data.cgpi = [...Array(data.ncui).keys(), -1]
          if (added > 0 || failed > 0) note = added + ' car(s) added' + (failed > 0 ? ', ' + failed + ' failed' : '') + '.'
        }
        const out = csr2WriteSave(data)
        applyJobs.get(jobId).done = true
        applyJobs.get(jobId).result = { resultBase64: out.toString('base64'), note: note || null }
      } catch (e) {
        log('[csr2/edit-nsb-full] Error: ' + e.message)
        applyJobs.get(jobId).done = true
        applyJobs.get(jobId).result = { error: e.message }
      }
      setTimeout(() => applyJobs.delete(jobId), 5 * 60 * 1000)
    })()
    return json(res, 200, { jobId })
  }

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

  // CSR2 apply-nsb — starts async job, returns jobId immediately
  if (req.method === 'POST' && pathname === '/csr2/apply-nsb') {
    const body = await readBody(req)
    if (!body.nsbBase64 || !body.packId) return json(res, 400, { error: 'Missing nsbBase64 or packId' })
    const packs = loadPacks()
    const pack = packs.find(p => p.id === body.packId)
    if (!pack) return json(res, 404, { error: 'Pack not found' })
    const jobId = uid()
    applyJobs.set(jobId, { progress: 'Starting...', done: false, result: null })
    ;(async () => {
      try {
        const buf = Buffer.from(body.nsbBase64, 'base64')
        const data = csr2ReadSave(buf)
        const opts = {
          applyLegends: body.applyLegends !== false,
          applyFusions: body.applyFusions !== false,
          applyStage6: body.applyStage6 !== false,
          currencyOverride: body.currencyOverride || {},
          usePartialSelection: body.usePartialSelection || false,
          selectedLegends: body.selectedLegends || null,
          selectedBrands: body.selectedBrands || null,
          selectedS6Cars: body.selectedS6Cars || null,
        }
        const { note } = await csr2ApplyPack(data, pack, body.selectedCars || null, body.allowDuplicates || false, jobId, opts)
        const out = csr2WriteSave(data)
        applyJobs.get(jobId).done = true
        applyJobs.get(jobId).result = { resultBase64: out.toString('base64'), note: note || null }
      } catch (e) {
        log('[csr2/apply-nsb] Error: ' + e.message)
        applyJobs.get(jobId).done = true
        applyJobs.get(jobId).result = { error: e.message }
      }
      setTimeout(() => applyJobs.delete(jobId), 5 * 60 * 1000)
    })()
    return json(res, 200, { jobId })
  }

  // CSR2 apply-nsb progress polling
  if (req.method === 'GET' && pathname === '/csr2/apply-progress') {
    const jobId = new URL(req.url, 'http://localhost').searchParams.get('jobId')
    const job = applyJobs.get(jobId)
    if (!job) return json(res, 404, { error: 'Job not found' })
    if (job.done) return json(res, 200, { done: true, ...job.result })
    return json(res, 200, { done: false, progress: job.progress })
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
      const ALL_CRDBS_URL = 'https://raw.githubusercontent.com/Nitro4CSR/CSR2-DataBase/Everything/1.Cars/%23AllCarCRDBs.txt'
      log('[csr2/cars-check] Fetching #AllCarCRDBs.txt from GitHub...')
      const rawTxt = await fetchRawGithub(ALL_CRDBS_URL)
      log('[csr2/cars-check] Raw response length: ' + rawTxt.length + ' chars')
      log('[csr2/cars-check] First 300 chars: ' + rawTxt.slice(0, 300))

      const remoteNames = rawTxt.split('\n').map(l => l.trim()).filter(Boolean)
      log('[csr2/cars-check] Remote CRDB count: ' + remoteNames.length)

      const localCars = loadCsr2Cars()
      const localCrdbSet = new Set(localCars.map(c => c.crdb).filter(Boolean))
      log('[csr2/cars-check] Local car DB count: ' + localCars.length + ', unique CRDBs: ' + localCrdbSet.size)

      const missing = remoteNames.filter(n => !localCrdbSet.has(n))
      log('[csr2/cars-check] Missing from local DB: ' + missing.length + (missing.length ? ' — first few: ' + missing.slice(0, 5).join(', ') : ''))

      return json(res, 200, {
        hasUpdate: missing.length > 0,
        remoteCount: remoteNames.length,
        localCount: localCars.length,
        missingCount: missing.length,
        missingPreview: missing.slice(0, 10),
      })
    } catch (e) {
      log('[csr2/cars-check] Error: ' + e.message)
      return json(res, 200, { hasUpdate: false, error: e.message, carCount: loadCsr2Cars().length })
    }
  }

  // CSR2 car database — rebuild from GitHub
  if (req.method === 'POST' && pathname === '/csr2/cars-update') {
    try {
      log('[csr2/cars-update] Fetching latest commit SHA...')
      const commit = await fetchGithubApi('/repos/Nitro4CSR/CSR2-DataBase/commits/Everything')
      const sha = commit.sha || ''

      log('[csr2/cars-update] Fetching file tree...')
      const treeData = await fetchGithubApi('/repos/Nitro4CSR/CSR2-DataBase/git/trees/Everything?recursive=1')
      const tree = treeData.tree || []
      log('[csr2/cars-update] Tree: ' + tree.length + ' items, truncated=' + treeData.truncated)
      const samplePaths = tree.slice(0, 10).map(x => x.path).join(' | ')
      if (samplePaths) log('[csr2/cars-update] Sample paths: ' + samplePaths)

      const enc = (s) => encodeURIComponent(s)
      const rawBase = 'https://raw.githubusercontent.com/Nitro4CSR/CSR2-DataBase/Everything/'
      const rawUrl = (parts) => rawBase + parts.map(enc).join('/')

      // Group Stock .txt files by brand+model+starType — covers root and Update X.Y.Z subfolders
      const carMap = new Map()
      const stockFoldersSeen = new Set()
      for (const item of tree) {
        if (item.type !== 'blob') continue
        if (!item.path.startsWith('1.Cars/') || !item.path.includes('/1.Stock/') || !item.path.endsWith('.txt')) continue
        const parts = item.path.split('/')
        // parts: ['1.Cars', <maybe 'Update X'>, '1.Stock', <starType>, brand, model, color.txt]
        // stock index within parts array
        const stockIdx = parts.indexOf('1.Stock')
        if (stockIdx < 0 || parts.length < stockIdx + 5) {
          log('[csr2/cars-update] Stock path too short, skipping: ' + item.path); continue
        }
        const starRaw = parts[stockIdx + 1], brand = parts[stockIdx + 2], model = parts[stockIdx + 3]
        const colorName = parts[stockIdx + 4].replace(/\.txt$/, '')
        const folder = parts.slice(0, stockIdx + 1).join('/')
        if (!stockFoldersSeen.has(folder)) {
          stockFoldersSeen.add(folder)
          log('[csr2/cars-update] Stock folder: ' + folder)
        }
        const starType = /gold/i.test(starRaw) ? 'Gold' : /purple/i.test(starRaw) ? 'Purple' : /legend/i.test(starRaw) ? 'Legends' : 'Other'
        const key = brand + '|' + model + '|' + starType
        const sUrl = rawUrl(parts)
        const pUrl = rawUrl(parts.slice(0, -1).concat(colorName + '.jpg'))
        if (!carMap.has(key)) {
          carMap.set(key, { brand, model, starType, colors: [], firstTxtUrl: sUrl })
        }
        carMap.get(key).colors.push({ name: colorName, photoUrl: pUrl, stockTxtUrl: sUrl, maxedTxtUrl: null })
      }
      log('[csr2/cars-update] Stock folders found: ' + [...stockFoldersSeen].join(' | '))

      // Map maxed .txt files by brand+model+colorName — covers root and Update X.Y.Z subfolders
      const maxedIdx = new Map()
      const maxedFoldersSeen = new Set()
      for (const item of tree) {
        if (item.type !== 'blob') continue
        if (!item.path.startsWith('1.Cars/') || !item.path.includes('/2.Maxed/') || !item.path.endsWith('.txt')) continue
        const parts = item.path.split('/')
        const maxedIdx2 = parts.indexOf('2.Maxed')
        if (maxedIdx2 < 0 || parts.length < maxedIdx2 + 4) {
          log('[csr2/cars-update] Maxed path too short, skipping: ' + item.path); continue
        }
        const folder = parts.slice(0, maxedIdx2 + 1).join('/')
        if (!maxedFoldersSeen.has(folder)) {
          maxedFoldersSeen.add(folder)
          log('[csr2/cars-update] Maxed folder: ' + folder)
        }
        const brand = parts[parts.length - 3], model = parts[parts.length - 2]
        const colorName = parts[parts.length - 1].replace(/\.txt$/, '')
        maxedIdx.set(brand + '|' + model + '|' + colorName, rawUrl(parts))
      }
      log('[csr2/cars-update] Maxed folders found: ' + [...maxedFoldersSeen].join(' | '))

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

  // ─── Stage 6 data ────────────────────────────────────────────────────────────

  if (req.method === 'GET' && pathname === '/csr2/stage6') {
    const d = loadStage6Data()
    const count = Array.isArray(d) ? d.filter(e => typeof e === 'object').length : Object.keys(d).length
    return json(res, 200, { count, data: d })
  }

  if (req.method === 'GET' && pathname === '/csr2/stage6-check') {
    try {
      const stored = loadStage6Sha()
      const cfg = loadConfig()
      const rawUrl = cfg.stage6RawUrl || ''
      if (!rawUrl) return json(res, 200, { hasUpdate: false, note: 'no_url' })
      const headSha = await new Promise((resolve) => {
        const u = new URL(rawUrl)
        https.request({ hostname: u.hostname, path: u.pathname + (u.search || ''), method: 'HEAD',
          headers: { 'User-Agent': 'aio-tool-v' + VERSION } }, (r) => {
          resolve(r.headers['etag'] || r.headers['last-modified'] || '')
        }).on('error', () => resolve('')).end()
      })
      return json(res, 200, { hasUpdate: headSha !== '' && headSha !== stored.sha })
    } catch (e) {
      return json(res, 200, { hasUpdate: false, error: e.message })
    }
  }

  if (req.method === 'POST' && pathname === '/csr2/stage6-update') {
    try {
      const STAGE6_URL = "https://raw.githubusercontent.com/Nitro4CSR/CSR2-DataBase/Everything/4.Stage6's/%23%23AllStage6's.txt"
      log('[csr2/stage6-update] Fetching from ' + STAGE6_URL)
      const { text: txt } = await fetchRawGithubWithEtag(STAGE6_URL)
      let parsed
      try { parsed = JSON.parse(txt) } catch {
        return json(res, 400, { error: 'Failed to parse Stage 6 data as JSON' })
      }
      saveStage6Data(parsed)
      // Store the HEAD ETag (not the GET ETag) so future HEAD checks compare consistently
      const headSha = await headEtagCheck(STAGE6_URL)
      saveStage6Sha({ sha: headSha || crypto.createHash('sha1').update(txt).digest('hex'), url: STAGE6_URL, fetchedAt: Date.now() })
      const count = Array.isArray(parsed) ? parsed.filter(e => typeof e === 'object').length : Object.keys(parsed).length
      log('[csr2/stage6-update] Saved ' + count + ' entries (headSha=' + headSha + ')')
      return json(res, 200, { ok: true, count })
    } catch (e) {
      log('[csr2/stage6-update] Error: ' + e.message)
      return json(res, 500, { error: e.message })
    }
  }

  // ─── Fusions data ────────────────────────────────────────────────────────────

  if (req.method === 'GET' && pathname === '/csr2/fusions') {
    const d = loadFusionData()
    const count = Array.isArray(d) ? d.filter(e => typeof e === 'object').length : Object.keys(d).length
    return json(res, 200, { count, data: d })
  }

  if (req.method === 'GET' && pathname === '/csr2/fusions-check') {
    try {
      const stored = loadFusionsSha()
      const cfg = loadConfig()
      const rawUrl = cfg.fusionsRawUrl || ''
      if (!rawUrl) return json(res, 200, { hasUpdate: false, note: 'no_url' })
      // derive sha from etag/last-modified by doing a HEAD request
      const headSha = await new Promise((resolve) => {
        const u = new URL(rawUrl)
        https.request({ hostname: u.hostname, path: u.pathname + (u.search || ''), method: 'HEAD',
          headers: { 'User-Agent': 'aio-tool-v' + VERSION } }, (r) => {
          resolve(r.headers['etag'] || r.headers['last-modified'] || '')
        }).on('error', () => resolve('')).end()
      })
      return json(res, 200, { hasUpdate: headSha !== '' && headSha !== stored.sha })
    } catch (e) {
      return json(res, 200, { hasUpdate: false, error: e.message })
    }
  }

  if (req.method === 'POST' && pathname === '/csr2/fusions-update') {
    try {
      const FUSIONS_URL = 'https://raw.githubusercontent.com/Nitro4CSR/CSR2-DataBase/Everything/3.Fusions/%23%23AllFusions.txt'
      log('[csr2/fusions-update] Fetching from ' + FUSIONS_URL)
      const { text: txt } = await fetchRawGithubWithEtag(FUSIONS_URL)
      let parsed
      try { parsed = JSON.parse(txt) } catch {
        return json(res, 400, { error: 'Failed to parse fusions data as JSON' })
      }
      saveFusionData(parsed)
      // Store the HEAD ETag (not the GET ETag) so future HEAD checks compare consistently
      const headSha = await headEtagCheck(FUSIONS_URL)
      saveFusionsSha({ sha: headSha || crypto.createHash('sha1').update(txt).digest('hex'), url: FUSIONS_URL, fetchedAt: Date.now() })
      const count = Array.isArray(parsed) ? parsed.filter(e => typeof e === 'object').length : Object.keys(parsed).length
      log('[csr2/fusions-update] Saved ' + count + ' entries (headSha=' + headSha + ')')
      return json(res, 200, { ok: true, count })
    } catch (e) {
      log('[csr2/fusions-update] Error: ' + e.message)
      return json(res, 500, { error: e.message })
    }
  }

  // ─── Brand IDs — derived from fusions data ───────────────────────────────────

  if (req.method === 'GET' && pathname === '/csr2/brands') {
    const fusionData = loadFusionData()
    const seen = new Map()
    for (let i = 0; i < fusionData.length; i++) {
      const entry = fusionData[i]
      if (typeof entry === 'object' && entry !== null && entry.upma && !seen.has(entry.upma)) {
        seen.set(entry.upma, { id: entry.upma, name: entry.upma })
      }
    }
    const brandList = Array.from(seen.values())
    return json(res, 200, { count: brandList.length, data: brandList })
  }

  // ─── Stage 6 cars — derived from stage6 data ─────────────────────────────────

  if (req.method === 'GET' && pathname === '/csr2/stage6-cars') {
    const stage6Data = loadStage6Data()
    const carsDb = loadCsr2Cars()
    const nameMap = {}
    for (const car of carsDb) { if (car.crdb) nameMap[car.crdb] = { name: car.name, tier: car.tier } }
    const seen = new Map()
    for (let i = 0; i < stage6Data.length; i++) {
      const entry = stage6Data[i]
      if (typeof entry === 'object' && entry !== null && entry.esdb && !seen.has(entry.esdb)) {
        const info = nameMap[entry.esdb] || {}
        seen.set(entry.esdb, { crdb: entry.esdb, name: info.name || entry.esdb, tier: info.tier || null })
      }
    }
    const carList = Array.from(seen.values())
    return json(res, 200, { count: carList.length, data: carList })
  }

  // ─── Data update check ────────────────────────────────────────────────────────

  if (req.method === 'GET' && pathname === '/csr2/updates-check') {
    const FUSIONS_URL = 'https://raw.githubusercontent.com/Nitro4CSR/CSR2-DataBase/Everything/3.Fusions/%23%23AllFusions.txt'
    const STAGE6_URL  = "https://raw.githubusercontent.com/Nitro4CSR/CSR2-DataBase/Everything/4.Stage6's/%23%23AllStage6's.txt"
    async function headEtag(url) {
      return new Promise(resolve => {
        try {
          const u = new URL(url)
          https.request({ hostname: u.hostname, path: u.pathname + (u.search || ''), method: 'HEAD',
            headers: { 'User-Agent': 'aio-tool-v' + VERSION } }, r => {
            resolve(r.headers['etag'] || r.headers['last-modified'] || '')
          }).on('error', () => resolve('')).end()
        } catch { resolve('') }
      })
    }
    try {
      const [fusEtag, s6Etag] = await Promise.all([headEtag(FUSIONS_URL), headEtag(STAGE6_URL)])
      const fusStored = loadFusionsSha()
      const s6Stored  = loadStage6Sha()
      return json(res, 200, {
        fusions: fusEtag !== '' && fusEtag !== (fusStored.sha || ''),
        stage6:  s6Etag  !== '' && s6Etag  !== (s6Stored.sha  || ''),
      })
    } catch (e) {
      return json(res, 200, { fusions: false, stage6: false })
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

