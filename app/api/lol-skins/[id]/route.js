import { supabase } from '../../../lib/supabase'

const CDN = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default'

export async function GET(request, { params }) {
  const { id } = await params
  const withCdn = new URL(request.url).searchParams.get('cdn') === '1'

  const { data, error } = await supabase
    .from('lol_skin_scans')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return Response.json({ error: 'Scan not found' }, { status: 404 })

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return Response.json({ error: 'This preview link has expired.' }, { status: 410 })
  }

  if (!withCdn) return Response.json(data)

  try {
    const ownedSkinIds  = data.owned_skin_ids  || []
    const ownedIconIds  = new Set(data.owned_icon_ids  || [])
    const ownedEmoteIds = new Set(data.owned_emote_ids || [])
    const ownedWardIds  = new Set(data.owned_ward_ids  || [])

    const ownedChampIds = new Set(ownedSkinIds.map(sid => Math.floor(sid / 1000)))
    if (Array.isArray(data.champion_mastery)) {
      for (const m of data.champion_mastery) {
        if (m.championId) ownedChampIds.add(m.championId)
      }
    }

    const [skinsRaw, iconsRaw, emotesRaw, wardsRaw, champsRaw] = await Promise.all([
      fetch(`${CDN}/v1/skins.json`).then(r => r.json()).catch(() => ({})),
      fetch(`${CDN}/v1/summoner-icons.json`).then(r => r.json()).catch(() => []),
      fetch(`${CDN}/v1/summoner-emotes.json`).then(r => r.json()).catch(() => []),
      fetch(`${CDN}/v1/ward-skins.json`).then(r => r.json()).catch(() => []),
      fetch(`${CDN}/v1/champion-summary.json`).then(r => r.json()).catch(() => []),
    ])

    const skinsFiltered = {}
    const skinsArr = typeof skinsRaw === 'object' && !Array.isArray(skinsRaw)
      ? Object.values(skinsRaw)
      : (Array.isArray(skinsRaw) ? skinsRaw : [])
    for (const skin of skinsArr) {
      if (ownedChampIds.has(Math.floor(skin.id / 1000))) skinsFiltered[skin.id] = skin
    }

    const toArr = x => Array.isArray(x) ? x : Object.values(x || {})
    return Response.json({
      scan:      data,
      skins:     skinsFiltered,
      icons:     toArr(iconsRaw).filter(i => ownedIconIds.has(i.id)),
      emotes:    toArr(emotesRaw).filter(e => ownedEmoteIds.has(e.id)),
      wards:     toArr(wardsRaw).filter(w => ownedWardIds.has(w.id)),
      champions: toArr(champsRaw).filter(c => ownedChampIds.has(c.id)),
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  const { id } = await params
  try {
    const body = await request.json()
    const update = {}

    if ('expiresAt'    in body) update.expires_at   = body.expiresAt
    if ('hideName'     in body) update.hide_name     = !!body.hideName
    if ('oge'          in body) update.oge           = !!body.oge
    if ('ogi'          in body) update.ogi           = !!body.ogi
    if ('ogiPartial'   in body) update.ogi_partial   = !!body.ogiPartial
    if ('ogiVerified'  in body) update.ogi_verified  = !!body.ogiVerified
    if ('priceAmount'  in body) update.price_amount  = body.priceAmount ?? null
    if ('priceCurrency' in body) update.price_currency = body.priceCurrency || null
    if ('lastMatch'    in body) update.last_match    = body.lastMatch ?? null

    const { data, error } = await supabase
      .from('lol_skin_scans')
      .update(update)
      .eq('id', id)
      .select('id, expires_at, hide_name, oge, ogi, ogi_partial, ogi_verified, price_amount, price_currency')
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data)
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
