import { supabase } from '../../../lib/supabase'

const CDN = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default'

export async function GET(request, { params }) {
  const { id } = await params

  const { data: scan, error } = await supabase
    .from('lol_skin_scans')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !scan) {
    return Response.json({ error: 'Scan not found' }, { status: 404 })
  }

  if (scan.expires_at && new Date(scan.expires_at) < new Date()) {
    return Response.json({ error: 'This preview link has expired' }, { status: 410 })
  }

  const ownedSkinIds  = scan.owned_skin_ids  || []
  const ownedIconIds  = new Set(scan.owned_icon_ids  || [])
  const ownedEmoteIds = new Set(scan.owned_emote_ids || [])
  const ownedWardIds  = new Set(scan.owned_ward_ids  || [])

  // Champion IDs that have at least one owned skin — we return ALL skins
  // for these champs so per-champion "X / Y total" counts stay accurate.
  const ownedChampIds = new Set(ownedSkinIds.map(sid => Math.floor(sid / 1000)))

  // Champion IDs needed for mastery tab
  if (Array.isArray(scan.champion_mastery)) {
    for (const m of scan.champion_mastery) {
      if (m.championId) ownedChampIds.add(m.championId)
    }
  }

  const [skinsRaw, iconsRaw, emotesRaw, wardsRaw, champsRaw] = await Promise.all([
    fetch(`${CDN}/v1/skins.json`,            { next: { revalidate: 86400 } }).then(r => r.json()).catch(() => ({})),
    fetch(`${CDN}/v1/summoner-icons.json`,   { next: { revalidate: 86400 } }).then(r => r.json()).catch(() => []),
    fetch(`${CDN}/v1/summoner-emotes.json`,  { next: { revalidate: 86400 } }).then(r => r.json()).catch(() => []),
    fetch(`${CDN}/v1/ward-skins.json`,       { next: { revalidate: 86400 } }).then(r => r.json()).catch(() => []),
    fetch(`${CDN}/v1/champion-summary.json`, { next: { revalidate: 86400 } }).then(r => r.json()).catch(() => []),
  ])

  // Skins: all skins for owned champions (preserves per-champ totals)
  const skinsFiltered = {}
  const skinsArr = typeof skinsRaw === 'object' && !Array.isArray(skinsRaw)
    ? Object.values(skinsRaw)
    : (Array.isArray(skinsRaw) ? skinsRaw : [])
  for (const skin of skinsArr) {
    if (ownedChampIds.has(Math.floor(skin.id / 1000))) {
      skinsFiltered[skin.id] = skin
    }
  }

  // Icons / emotes / wards: only owned
  const toArr = x => Array.isArray(x) ? x : Object.values(x || {})
  const iconsFiltered  = toArr(iconsRaw).filter(i => ownedIconIds.has(i.id))
  const emotesFiltered = toArr(emotesRaw).filter(e => ownedEmoteIds.has(e.id))
  const wardsFiltered  = toArr(wardsRaw).filter(w => ownedWardIds.has(w.id))

  // Champions: only those relevant to owned skins + mastery
  const champsFiltered = toArr(champsRaw).filter(c => ownedChampIds.has(c.id))

  return Response.json({ scan, skins: skinsFiltered, icons: iconsFiltered, emotes: emotesFiltered, wards: wardsFiltered, champions: champsFiltered })
}
