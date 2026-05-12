export const runtime = 'nodejs'

const PLATFORM = {
  NA1: 'na1', EUW1: 'euw1', EUNE1: 'eune1', KR: 'kr', BR1: 'br1',
  JP1: 'jp1', LA1: 'la1', LA2: 'la2', OC1: 'oc1', TR1: 'tr1', RU: 'ru',
  PH2: 'ph2', SG2: 'sg2', TH2: 'th2', TW2: 'tw2', VN2: 'vn2',
}

function decodeJwt(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'))
  } catch { return null }
}

async function riotFetch(url, accessToken, entitlementsToken, extraHeaders = {}) {
  try {
    const headers = { 'Authorization': `Bearer ${accessToken}`, ...extraHeaders }
    if (entitlementsToken) headers['X-Riot-Entitlements-JWT'] = entitlementsToken
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
    if (res.ok) return { data: await res.json(), status: res.status }
    const body = await res.text().catch(() => '')
    return { data: null, status: res.status, body: body.slice(0, 300) }
  } catch (e) {
    return { data: null, status: null, error: e.message }
  }
}

export async function POST(request) {
  try {
    const { accessToken, idToken } = await request.json()
    if (!accessToken) return Response.json({ error: 'Access token required' }, { status: 400 })

    const idClaims = idToken ? decodeJwt(idToken) : null
    const accessClaims = decodeJwt(accessToken)
    const puuid = idClaims?.sub || accessClaims?.sub
    if (!puuid) return Response.json({ error: 'Invalid token — could not extract PUUID' }, { status: 400 })

    const lolAccount = idClaims?.lol?.[0]
    const cpid = lolAccount?.cpid
    const cuid = lolAccount?.cuid
    const gameName = idClaims?.acct?.game_name || ''
    const tagLine = idClaims?.acct?.tag_line || ''
    const platform = cpid ? (PLATFORM[cpid] ?? cpid.toLowerCase()) : null

    // Entitlements
    const entRes = await fetch('https://entitlements.auth.riotgames.com/api/token/v1', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!entRes.ok) return Response.json({ error: 'Token expired — please log in again' }, { status: 401 })
    const { entitlements_token: entToken } = await entRes.json()

    // User info
    const userInfoResult = await riotFetch('https://auth.riotgames.com/userinfo', accessToken, null)
    const userInfo = userInfoResult.data || {}

    // Client version (needed for some internal headers)
    let clientVersion = '15.1.1'
    try {
      const vRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', { signal: AbortSignal.timeout(5000) })
      if (vRes.ok) clientVersion = (await vRes.json())[0] ?? clientVersion
    } catch {}

    // Summoner — api.pvp.net works, pvp.net does not
    const summonerResult = platform
      ? await riotFetch(`https://${platform}.api.pvp.net/lol/summoner/v4/summoners/by-puuid/${puuid}`, accessToken, entToken)
      : { data: null, status: null }
    const summoner = summonerResult.data

    // Ranked — same domain
    const summonerId = summoner?.id
    const rankedResult = (summonerId && platform)
      ? await riotFetch(`https://${platform}.api.pvp.net/lol/league/v4/entries/by-summoner/${summonerId}`, accessToken, entToken)
      : { data: [], status: null }
    const ranked = rankedResult.data || []
    const solo = ranked.find(r => r.queueType === 'RANKED_SOLO_5x5') || null
    const flex = ranked.find(r => r.queueType === 'RANKED_FLEX_SR') || null

    // Wallet — try store.api.pvp.net (same subdomain pattern as summoner)
    const walletResult = platform
      ? await riotFetch(`https://${platform}.store.api.pvp.net/store/v1/wallet/${puuid}`, accessToken, entToken)
      : { data: null, status: null }
    const wallet = walletResult.data

    // Loot — try lol.pvp.net
    const lootResult = platform
      ? await riotFetch(`https://${platform}.lol.pvp.net/loot/v2/playerloot/${puuid}`, accessToken, entToken)
      : { data: null, status: null }
    const loot = lootResult.data

    // Inventory — try api.pvp.net path with entitlements + client version
    const inventoryResult = (platform && cuid)
      ? await riotFetch(
          `https://${platform}.api.pvp.net/lolinventoryservice/v1/inventories?puuid=${puuid}&accountId=${cuid}&inventoryTypes=CHAMPION,CHAMPION_SKIN,WARD_SKIN,SUMMONER_ICON`,
          accessToken, entToken,
          { 'X-Riot-ClientVersion': clientVersion }
        )
      : { data: null, status: null }
    const inventory = inventoryResult.data

    // Process loot
    const lootItems = loot?.playerLoot || []
    const hexChests = lootItems.filter(i => i.lootId?.startsWith('CHEST_') || i.lootId === 'CHEST').reduce((s, i) => s + (i.count || 0), 0)
    const hexKeys = lootItems.filter(i => i.lootId === 'MATERIAL_key' || i.lootId === 'MATERIAL_key_fragment').reduce((s, i) => s + (i.count || 0), 0)
    const oe = lootItems.find(i => i.lootId === 'CURRENCY_cosmetic')?.count ?? null
    const me = lootItems.find(i => i.lootId === 'CURRENCY_mythic')?.count ?? null

    // Process inventory
    const invData = inventory?.data?.items || inventory?.items || {}
    const champItems = invData.CHAMPION || []
    const skinItems = invData.CHAMPION_SKIN || []

    const be = wallet?.ip ?? wallet?.balances?.ip ?? wallet?.balances?.lol_blue_essence ?? null
    const rp = wallet?.rp ?? wallet?.balances?.rp ?? null

    return Response.json({
      platform: cpid || 'UNKNOWN',
      summonerName: summoner?.name || summoner?.gameName || gameName || '',
      summonerLevel: summoner?.summonerLevel ?? null,
      profileIconId: summoner?.profileIconId ?? null,
      country: userInfo.country || '',
      soloRank: solo ? `${solo.tier} ${solo.rank}` : 'Unranked',
      soloLp: solo?.leaguePoints ?? 0,
      soloWins: solo?.wins ?? 0,
      soloLosses: solo?.losses ?? 0,
      flexRank: flex ? `${flex.tier} ${flex.rank}` : 'Unranked',
      flexLp: flex?.leaguePoints ?? 0,
      flexWins: flex?.wins ?? 0,
      flexLosses: flex?.losses ?? 0,
      rp,
      be,
      oe: lootItems.length > 0 ? (oe ?? 0) : null,
      me: lootItems.length > 0 ? (me ?? 0) : null,
      hexChests: lootItems.length > 0 ? hexChests : null,
      hexKeys: lootItems.length > 0 ? hexKeys : null,
      championsOwned: champItems.length > 0 ? champItems.length : null,
      skinsOwned: skinItems.length > 0 ? skinItems.length : null,
      _debug: {
        clientVersion, puuid, cpid, platform, cuid, gameName, tagLine,
        summoner:  { status: summonerResult.status,   error: summonerResult.error,   body: summonerResult.body,   raw: summoner },
        wallet:    { status: walletResult.status,      error: walletResult.error,      body: walletResult.body,    raw: wallet },
        loot:      { status: lootResult.status,        error: lootResult.error,        body: lootResult.body },
        inventory: { status: inventoryResult.status,   error: inventoryResult.error,   body: inventoryResult.body },
      },
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
