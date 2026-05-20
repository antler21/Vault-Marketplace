import { supabase } from '../../../lib/supabase'

const REGION_DISPLAY = {
  SG2: 'SEA', PH2: 'SEA', TH2: 'SEA', VN2: 'VN', TW2: 'TWN', MY2: 'SEA', ID1: 'SEA',
  NA1: 'NA', EUW1: 'EUW', EUNE1: 'EUNE', KR: 'KR', JP1: 'JP',
  BR1: 'BR', LA1: 'LAN', LA2: 'LAS', OC1: 'OCE', TR1: 'TR', RU: 'RU',
}

export async function generateMetadata({ params }) {
  const { id } = await params
  const { data: scan } = await supabase
    .from('lol_skin_scans')
    .select('summoner_name,tag_line,region,solo_rank,owned_skin_ids,account_title,hide_name,profile_icon_id')
    .eq('id', id)
    .single()

  if (!scan) {
    return { title: 'League Account | lolprev.site' }
  }

  const skinCount = (scan.owned_skin_ids || []).length
  const region = REGION_DISPLAY[scan.region?.toUpperCase()] || scan.region || ''
  const rank = scan.solo_rank ? (scan.solo_rank.charAt(0) + scan.solo_rank.slice(1).toLowerCase()) : null

  const displayName = !scan.hide_name && scan.summoner_name
    ? `${scan.summoner_name}${scan.tag_line ? ` #${scan.tag_line}` : ''}`
    : null

  const title = scan.account_title || displayName || 'League of Legends Account'
  const parts = [
    skinCount ? `${skinCount} skins` : null,
    rank,
    region,
  ].filter(Boolean)
  const description = parts.length > 0 ? parts.join(' · ') : 'View full account details on lolprev.site'

  const iconUrl = scan.profile_icon_id
    ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${scan.profile_icon_id}.jpg`
    : null

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://lolprev.site/preview/lol/${id}`,
      images: iconUrl ? [{ url: iconUrl, width: 200, height: 200 }] : [],
      type: 'website',
      siteName: 'lolprev.site',
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: iconUrl ? [iconUrl] : [],
    },
  }
}

export default function Layout({ children }) {
  return children
}
