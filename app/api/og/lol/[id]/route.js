import { ImageResponse } from '@vercel/og'
import { supabase } from '../../../../lib/supabase'

export const runtime = 'edge'

const CDN = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default'
const RARITY_ORDER = ['kTranscendent', 'kExalted', 'kUltimate', 'kMythic', 'kLegendary', 'kEpic', 'kRare', 'kNoRarity']
const RANK_COLORS = {
  IRON: '#8b7355', BRONZE: '#a0522d', SILVER: '#c0c0c0', GOLD: '#ffd700',
  PLATINUM: '#00c8b4', EMERALD: '#50c878', DIAMOND: '#b9f2ff',
  MASTER: '#9b59b6', GRANDMASTER: '#e74c3c', CHALLENGER: '#f1c40f',
}

function cdnUrl(p) {
  if (!p) return null
  if (p.startsWith('http')) return p
  return CDN + p.toLowerCase().replace('/lol-game-data/assets', '')
}

function fmtTier(t) {
  return t ? t.charAt(0) + t.slice(1).toLowerCase() : null
}

export async function GET(request, { params }) {
  const { id } = await params

  // Fetch scan data
  const { data: scan, error } = await supabase
    .from('lol_skin_scans')
    .select('summoner_name,tag_line,profile_icon_id,summoner_level,region,solo_rank,flex_rank,solo_peak_rank,solo_prev_rank,rp,be,owned_skin_ids,loot_summary')
    .eq('id', id)
    .single()

  if (error || !scan) {
    return new Response('Not found', { status: 404 })
  }

  // Fetch top skins (highest rarity first) — up to 6
  let topSkins = []
  try {
    const skinsJson = await fetch(`${CDN}/v1/skins.json`).then(r => r.json())
    const ownedSet = new Set(scan.owned_skin_ids || [])
    const owned = Object.values(skinsJson).filter(s => ownedSet.has(s.id) && !s.isBase)
    owned.sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity))
    topSkins = owned.slice(0, 6).map(s => ({
      name: s.name,
      url: cdnUrl(s.tilePath),
      rarity: s.rarity,
    }))
  } catch {}

  const profileIconUrl = scan.profile_icon_id
    ? `${CDN}/v1/profile-icons/${scan.profile_icon_id}.jpg`
    : null

  const soloRank = fmtTier(scan.solo_rank)
  const soloPeak = fmtTier(scan.solo_peak_rank)
  const soloPrev = fmtTier(scan.solo_prev_rank)
  const rankColor = RANK_COLORS[scan.solo_rank] || '#c89b3c'
  const skinCount = (scan.owned_skin_ids || []).length
  const displayName = scan.summoner_name || 'Unknown'

  const REGION_DISPLAY = {
    SG2: 'SEA', PH2: 'SEA', TH2: 'SEA', VN2: 'VN', TW2: 'TWN', MY2: 'SEA', ID1: 'SEA',
    NA1: 'NA', EUW1: 'EUW', EUNE1: 'EUNE', KR: 'KR', JP1: 'JP',
    BR1: 'BR', LA1: 'LAN', LA2: 'LAS', OC1: 'OCE', TR1: 'TR', RU: 'RU',
  }
  const region = scan.region ? (REGION_DISPLAY[scan.region.toUpperCase()] || scan.region) : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px', height: '630px',
          background: 'linear-gradient(135deg, #060c16 0%, #0d1a2e 50%, #060c16 100%)',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'sans-serif', color: '#e8e0d0',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Gold border accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, transparent, #c89b3c, transparent)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, transparent, #c89b3c, transparent)' }} />

        {/* Top section — profile + stats */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '36px 48px 24px', gap: '32px' }}>
          {/* Profile icon */}
          {profileIconUrl && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img src={profileIconUrl} width={96} height={96} style={{ borderRadius: '50%', border: '2px solid #c89b3c' }} />
              {scan.summoner_level && (
                <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', background: '#c89b3c', color: '#060c16', fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                  Lv {scan.summoner_level}
                </div>
              )}
            </div>
          )}

          {/* Name + region + rank */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: '#e8e0d0', letterSpacing: '-0.5px' }}>{displayName}</span>
              {region && <span style={{ fontSize: 14, color: '#5b6a7e', background: '#111b2a', padding: '2px 10px', borderRadius: 12, border: '1px solid #2a3a4a' }}>{region}</span>}
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              {soloRank && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 10, color: '#5b6a7e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Solo Rank</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: rankColor }}>{soloRank}</span>
                </div>
              )}
              {soloPeak && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 10, color: '#5b6a7e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Peak</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: RANK_COLORS[scan.solo_peak_rank] || '#7b8a9e' }}>{soloPeak}</span>
                </div>
              )}
              {soloPrev && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 10, color: '#5b6a7e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Last Season</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: RANK_COLORS[scan.solo_prev_rank] || '#7b8a9e' }}>{soloPrev}</span>
                </div>
              )}
              {!soloRank && <span style={{ fontSize: 16, color: '#3c4a5c' }}>Unranked</span>}
            </div>
          </div>

          {/* Stats pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ background: '#111b2a', border: '1px solid #2a3a4a', borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#c89b3c' }}>{skinCount}</div>
                <div style={{ fontSize: 10, color: '#5b6a7e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Skins</div>
              </div>
              {scan.rp != null && (
                <div style={{ background: '#111b2a', border: '1px solid #2a3a4a', borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#e8a020' }}>{scan.rp.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: '#5b6a7e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>RP</div>
                </div>
              )}
              {scan.be != null && (
                <div style={{ background: '#111b2a', border: '1px solid #2a3a4a', borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#5b9bd5' }}>{scan.be.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: '#5b6a7e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>BE</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(200,155,60,0.15)', margin: '0 48px' }} />

        {/* Skin grid */}
        <div style={{ display: 'flex', gap: '12px', padding: '24px 48px', flex: 1 }}>
          {topSkins.map((skin, i) => (
            <div key={i} style={{ flex: 1, position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(200,155,60,0.15)' }}>
              {skin.url && <img src={skin.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(6,12,22,0.9))', padding: '16px 8px 8px', display: 'flex', alignItems: 'flex-end' }}>
                <span style={{ fontSize: 10, color: '#e8e0d0', fontWeight: 600, lineHeight: 1.2 }}>{skin.name}</span>
              </div>
            </div>
          ))}
          {topSkins.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a3a4a', fontSize: 14 }}>No skins</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 48px', borderTop: '1px solid rgba(200,155,60,0.1)' }}>
          <span style={{ fontSize: 11, color: '#2a3a4a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>antlervaults.store</span>
          <span style={{ fontSize: 11, color: '#2a3a4a' }}>League of Legends Account</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
