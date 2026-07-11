import { supabase } from '../../../lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60

const REPO   = 'Nitro4CSR/CSR2-DataBase'
const BRANCH = 'Everything'
const EXCLUDED = new Set(['##AllFusions.txt', '#AllBrandIDs.txt', '#GeneratorPreset1Brand.txt', 'Placeholder Mystery.txt'])

async function ghApi(path) {
  const res = await fetch('https://api.github.com' + path, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'vault-admin' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('GitHub API ' + res.status + ': ' + path)
  return res.json()
}

async function ghRaw(filePath) {
  const encoded = filePath.split('/').map(s => encodeURIComponent(s)).join('/')
  const res = await fetch('https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/' + encoded, { cache: 'no-store' })
  if (!res.ok) throw new Error('Raw fetch ' + res.status)
  return res.text()
}

export async function POST() {
  try {
    const rootTree = await ghApi('/repos/' + REPO + '/git/trees/' + BRANCH)
    const fusEntry = (rootTree.tree || []).find(e => e.path === '3.Fusions' && e.type === 'tree')
    if (!fusEntry) throw new Error("Could not find 3.Fusions directory")

    const fusTree  = await ghApi('/repos/' + REPO + '/git/trees/' + fusEntry.sha)
    const brandFiles = (fusTree.tree || [])
      .filter(f => f.type === 'blob' && f.path.endsWith('.txt') && !f.path.startsWith('#') && !EXCLUDED.has(f.path))
      .map(f => ({ ...f, path: '3.Fusions/' + f.path }))

    // Fetch commit SHA for update-check
    let sha = null
    try {
      const commits = await ghApi('/repos/' + REPO + '/commits?path=' + encodeURIComponent('3.Fusions/%23%23AllFusions.txt') + '&per_page=1')
      sha = commits?.[0]?.sha || null
    } catch {}

    const brands = []
    const BATCH = 15
    for (let i = 0; i < brandFiles.length; i += BATCH) {
      const batch = brandFiles.slice(i, i + BATCH)
      const results = await Promise.all(batch.map(async f => {
        try {
          let raw = await ghRaw(f.path)
          raw = raw.replace(/\bAMOUNT\b/g, '0').trim()
          if (raw.endsWith(',')) raw = raw.slice(0, -1)
          const arr = JSON.parse('[' + raw + ']')
          const first = arr.find(e => typeof e === 'object' && e !== null && e.upma)
          if (!first) return null
          const name = f.path.split('/').pop().replace(/\.txt$/i, '')
          return { name, upma: first.upma }
        } catch { return null }
      }))
      brands.push(...results.filter(Boolean))
    }

    await supabase.from('csr2_cache').upsert({ key: 'fusion_brands', data: brands, updated_at: new Date().toISOString() })
    if (sha) await supabase.from('csr2_cache').upsert({ key: 'fusion_brands_sha', data: { sha }, updated_at: new Date().toISOString() })

    // Cache full fusions data (used by write route for "Add All" and individual insert modes)
    try {
      const fullTxt = await ghRaw('3.Fusions/##AllFusions.txt')
      const fullData = JSON.parse(fullTxt)
      await supabase.from('csr2_cache').upsert(
        { key: 'fusions_full', data: fullData, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    } catch {}

    return Response.json({ ok: true, count: brands.length, brands })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
