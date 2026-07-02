import { supabase } from '../../../lib/supabase'

export const runtime = 'nodejs'

const REPO = 'Nitro4CSR/CSR2-DataBase'

const CONFIG = {
  s6: { shaKey: 's6_list_sha', file: "4.Stage6's/%23%23AllStage6's.txt" },
  fusions: { shaKey: 'fusion_brands_sha', file: '3.Fusions/%23%23AllFusions.txt' },
}

export async function GET(req) {
  try {
    const type = new URL(req.url).searchParams.get('type')
    const cfg = CONFIG[type]
    if (!cfg) return Response.json({ error: 'unknown type' }, { status: 400 })

    const [ghRes, dbRes] = await Promise.all([
      fetch('https://api.github.com/repos/' + REPO + '/commits?path=' + encodeURIComponent(cfg.file) + '&per_page=1', {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'vault-admin' },
        cache: 'no-store',
      }).then(r => r.json()),
      supabase.from('csr2_cache').select('data, updated_at').eq('key', cfg.shaKey).single(),
    ])

    const latestSha  = ghRes?.[0]?.sha || null
    const latestDate = ghRes?.[0]?.commit?.committer?.date || null
    const storedSha  = dbRes.data?.data?.sha || null
    const storedDate = dbRes.data?.updated_at || null
    const updateAvailable = latestSha && storedSha && latestSha !== storedSha

    return Response.json({ updateAvailable: !!updateAvailable, latestSha, latestDate, storedSha, storedDate })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
