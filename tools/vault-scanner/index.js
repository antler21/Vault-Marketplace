const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

const PORT = 35199
const VERSION = '0.5.2'

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
  // Normalize: en/em dashes → hyphen, "Grand Master" → "Grandmaster"
  const n = name.trim().replace(/[–—]/g, '-').replace(/grand\s+master/gi, 'Grandmaster')
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
  const supplSkinIds = skinInvItems
    .filter(i => (i.owned === true || i.ownershipType === 'OWNED') && !i.rental)
    .map(i => i.itemId).filter(id => id != null && id !== 0)
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

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')
}

function json(res, status, body) { cors(res); res.writeHead(status); res.end(JSON.stringify(body)) }

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(200); res.end(); return }
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (url.pathname === '/ping') {
    return json(res, 200, { running: true, leagueOpen: !!findLockfile() })
  }

  if (url.pathname === '/scan') {
    const lockfile = findLockfile()
    if (!lockfile) return json(res, 400, { error: 'League client not detected — open League of Legends first.' })
    const { port: lcuPort, password } = parseLockfile(lockfile)
    log(`League client on port ${lcuPort}. Starting scan...`)
    try {
      const data = await runScan(lcuPort, password)
      log('Scan complete!')
      return json(res, 200, data)
    } catch (e) {
      log('Scan error: ' + e.message)
      return json(res, 500, { error: e.message })
    }
  }

  return json(res, 404, { error: 'Not found' })
})

function log(msg) { console.log(`[${new Date().toLocaleTimeString()}] ${msg}`) }

server.listen(PORT, '127.0.0.1', () => {
  console.clear()
  console.log('╔════════════════════════════════════════╗')
  console.log('║           AIO TOOL  v0.5.2             ║')
  console.log('╚════════════════════════════════════════╝')
  console.log(`\n  Running on http://localhost:${PORT}`)
  console.log('  Keep this window open while scanning.')
  console.log('  Minimize it — reuse for multiple accounts.\n')
  console.log('─────────────────────────────────────────')
  log('Ready. Waiting for scan request...')
})

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`\nPort ${PORT} already in use — scanner may already be running.\n`)
  else console.error('\nServer error:', e.message)
  process.exit(1)
})
