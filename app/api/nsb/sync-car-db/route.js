import { supabase } from '../../../lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 30

const REPO   = 'Nitro4CSR/CSR2-DataBase'
const BRANCH = 'Everything'
const RAW    = 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/'

// S6 star folder names in 1.Cars match the ones in 4.Stage6's
const STAR_MAP = { '1.Gold Star': 'gold', '2.Purple Star': 'purple', '3.Legends': 'legends' }
const TYPE_TO_STAR = { gold: '1.Gold Star', purple: '2.Purple Star', legends: '3.Legends' }

async function ghApi(path) {
  const res = await fetch('https://api.github.com' + path, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'vault-admin' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('GitHub API ' + res.status)
  return res.json()
}

function toRawUrl(filePath) {
  return RAW + filePath.split('/').map(s => encodeURIComponent(s)).join('/')
}

function displayColor(colorName) {
  // "Abarth 500 (PerformanceBlack) 1" → "PerformanceBlack 1"
  const m = colorName.match(/\(([^)]+)\)(.*)$/)
  if (!m) return colorName
  return (m[1] + (m[2] ? ' ' + m[2].trim() : '')).trim()
}

export async function POST() {
  try {
    // ── Step 1: load s6Cars from Supabase (already cached) ───────────────────
    const { data: s6Row } = await supabase.from('csr2_cache').select('data').eq('key', 's6_car_list').single()
    const s6Cars = Array.isArray(s6Row?.data) ? s6Row.data : []
    if (s6Cars.length === 0) throw new Error('S6 car list not synced yet — sync S6 cars first')

    // ── Step 2: fetch 1.Cars recursive tree (2 API calls total) ─────────────
    const rootTree  = await ghApi('/repos/' + REPO + '/git/trees/' + BRANCH)
    const carsEntry = (rootTree.tree || []).find(e => e.path === '1.Cars' && e.type === 'tree')
    if (!carsEntry) throw new Error('Could not find 1.Cars directory')

    const carsTree = await ghApi('/repos/' + REPO + '/git/trees/' + carsEntry.sha + '?recursive=1')
    const allFiles = (carsTree.tree || []).map(f => ({ ...f, path: '1.Cars/' + f.path }))

    // ── Step 3: build color index keyed by "starFolder|brand|model" ─────────
    // No txt fetching needed — we'll match s6Cars by brand+name which equal the folder names
    const stockIndex = new Map()  // "starFolder|brand|model" → colors[]
    for (const item of allFiles) {
      if (item.type !== 'blob' || !item.path.endsWith('.txt')) continue
      const parts    = item.path.split('/')
      const stockIdx = parts.indexOf('1.Stock')
      if (stockIdx < 0 || parts.length < stockIdx + 5) continue
      const starRaw  = parts[stockIdx + 1]
      if (!STAR_MAP[starRaw]) continue
      const brand     = parts[stockIdx + 2]
      const model     = parts[stockIdx + 3]
      const colorFile = parts[stockIdx + 4]
      if (colorFile.startsWith('#')) continue
      const colorName = colorFile.replace(/\.txt$/i, '')
      const key = starRaw + '|' + brand + '|' + model
      if (!stockIndex.has(key)) stockIndex.set(key, [])
      stockIndex.get(key).push({
        name:          colorName,
        displayName:   displayColor(colorName),
        photoUrl:      toRawUrl(item.path.replace(/\.txt$/i, '.jpg')),
        stockTxtUrl:   toRawUrl(item.path),
        maxedTxtUrl:   null,
        maxedPhotoUrl: null,
      })
    }

    // ── Step 4: attach maxed URLs ────────────────────────────────────────────
    for (const item of allFiles) {
      if (item.type !== 'blob' || !item.path.endsWith('.txt')) continue
      const parts = item.path.split('/')
      const mIdx  = parts.indexOf('2.Maxed')
      if (mIdx < 0 || parts.length < mIdx + 5) continue
      const starRaw   = parts[mIdx + 1]
      if (!STAR_MAP[starRaw]) continue
      const brand     = parts[mIdx + 2]
      const model     = parts[mIdx + 3]
      const colorFile = parts[mIdx + 4]
      if (colorFile.startsWith('#')) continue
      const colorName = colorFile.replace(/\.txt$/i, '')
      const key = starRaw + '|' + brand + '|' + model
      const colors = stockIndex.get(key)
      if (!colors) continue
      const col = colors.find(c => c.name === colorName)
      if (col) {
        col.maxedTxtUrl   = toRawUrl(item.path)
        col.maxedPhotoUrl = toRawUrl(item.path.replace(/\.txt$/i, '.jpg'))
      }
    }

    // ── Step 5: match s6Cars to color index by brand + name ─────────────────
    // The model folder name in 1.Cars exactly equals s6Car.name
    // The esdb in s6Cars IS the crdb — no txt fetch needed
    const result = []
    const seen   = new Set()
    for (const car of s6Cars) {
      if (seen.has(car.esdb)) continue
      const starFolder = TYPE_TO_STAR[car.type]
      if (!starFolder) continue
      const key    = starFolder + '|' + car.brand + '|' + car.name
      const colors = stockIndex.get(key)
      if (!colors || colors.length === 0) continue
      seen.add(car.esdb)
      result.push({
        crdb:     car.esdb,
        brand:    car.brand,
        model:    car.name,
        starType: car.type,
        colors,
      })
    }

    // ── Step 6: store in Supabase ────────────────────────────────────────────
    const { error: upsertErr } = await supabase.from('csr2_cache').upsert(
      { key: 'car_db', data: result, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    if (upsertErr) throw new Error('Supabase upsert failed: ' + upsertErr.message)

    return Response.json({ ok: true, count: result.length, totalColors: result.reduce((n,c)=>n+c.colors.length,0) })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
