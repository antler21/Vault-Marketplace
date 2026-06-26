import { supabase } from '../../../lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60

const REPO   = 'Nitro4CSR/CSR2-DataBase'
const BRANCH = 'Everything'

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
    const GOLD_PREFIX    = "4.Stage6's/1.Gold Star/"
    const PURPLE_PREFIX  = "4.Stage6's/2.Purple Star/"
    const LEGENDS_PREFIX = "4.Stage6's/3.Legends/"

    const rootTree = await ghApi('/repos/' + REPO + '/git/trees/' + BRANCH)
    const s6Entry  = (rootTree.tree || []).find(e => e.path === "4.Stage6's" && e.type === 'tree')
    if (!s6Entry) throw new Error("Could not find 4.Stage6's directory")

    const s6Tree   = await ghApi('/repos/' + REPO + '/git/trees/' + s6Entry.sha + '?recursive=1')
    const carFiles = (s6Tree.tree || [])
      .filter(f => f.type === 'blob' && f.path.endsWith('.txt') && !f.path.startsWith('#') &&
        (f.path.startsWith('1.Gold Star/') || f.path.startsWith('2.Purple Star/') || f.path.startsWith('3.Legends/')))
      .map(f => ({ ...f, path: "4.Stage6's/" + f.path }))

    const carList  = []
    const seenEsdb = new Set()
    const BATCH    = 20

    for (let i = 0; i < carFiles.length; i += BATCH) {
      const batch   = carFiles.slice(i, i + BATCH)
      const results = await Promise.all(batch.map(async f => {
        const isGold   = f.path.startsWith(GOLD_PREFIX)
        const isPurple = f.path.startsWith(PURPLE_PREFIX)
        const type     = isGold ? 'gold' : isPurple ? 'purple' : 'legends'
        const prefix   = isGold ? GOLD_PREFIX : isPurple ? PURPLE_PREFIX : LEGENDS_PREFIX
        const relative = f.path.slice(prefix.length)
        const brand    = relative.includes('/') ? relative.split('/')[0] : relative.replace(/\.txt$/i, '')
        const name     = f.path.split('/').pop().replace(/\.txt$/i, '')
        try {
          let txt = await ghRaw(f.path)
          txt = txt.replace(/\bAMOUNT\b/g, '0').trim()
          if (txt.startsWith(',')) txt = txt.slice(1).trim()
          if (txt.endsWith(',')) txt = txt.slice(0, -1)
          const arr = JSON.parse('[' + txt + ']')
          return arr
            .filter(e => typeof e === 'object' && e !== null && e.esdb && !seenEsdb.has(e.esdb))
            .map(e => { seenEsdb.add(e.esdb); return { esdb: e.esdb, name, brand, type, filePath: f.path } })
        } catch { return [] }
      }))
      for (const r of results) carList.push(...r)
    }

    await supabase.from('csr2_cache').upsert({
      key: 's6_car_list',
      data: carList,
      updated_at: new Date().toISOString(),
    })

    return Response.json({ ok: true, count: carList.length, cars: carList })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
