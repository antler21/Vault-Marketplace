import { supabase } from '../../../lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 30

const REPO   = 'Nitro4CSR/CSR2-DataBase'
const BRANCH = 'Everything'
const RAW    = 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/'

async function ghApi(path) {
  const res = await fetch('https://api.github.com' + path, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'vault-admin' },
    cache: 'no-store',
  })
  const rateLimit = res.headers.get('x-ratelimit-remaining')
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub API ${res.status} (rate-limit remaining: ${rateLimit}): ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  return { data, rateLimit }
}

async function ghRaw(filePath) {
  const encoded = filePath.split('/').map(s => encodeURIComponent(s)).join('/')
  const res = await fetch(RAW + encoded, { cache: 'no-store' })
  if (!res.ok) throw new Error('Raw ' + res.status + ': ' + encoded.slice(0, 80))
  return res.text()
}

export async function GET() {
  const log = []
  try {
    // Step 1: root tree
    log.push('Step 1: fetching root tree...')
    const { data: rootTree, rateLimit: rl1 } = await ghApi('/repos/' + REPO + '/git/trees/' + BRANCH)
    log.push(`Root tree: ${(rootTree.tree||[]).length} entries, truncated=${rootTree.truncated}, rate-limit-remaining=${rl1}`)

    const carsEntry = (rootTree.tree || []).find(e => e.path === '1.Cars' && e.type === 'tree')
    log.push(`1.Cars entry found: ${!!carsEntry}, sha=${carsEntry?.sha?.slice(0,10)}`)
    if (!carsEntry) return Response.json({ ok: false, log })

    // Step 2: 1.Cars recursive tree
    log.push('Step 2: fetching 1.Cars recursive tree...')
    const { data: carsTree, rateLimit: rl2 } = await ghApi('/repos/' + REPO + '/git/trees/' + carsEntry.sha + '?recursive=1')
    const allFiles = (carsTree.tree || []).map(f => ({ ...f, path: '1.Cars/' + f.path }))
    log.push(`1.Cars tree: ${allFiles.length} entries, truncated=${carsTree.truncated}, rate-limit-remaining=${rl2}`)

    // Step 3: filter for stock S6 txts
    const STAR_TYPES = new Set(['1.Gold Star', '2.Purple Star', '3.Legends'])
    const stockTxts = []
    const pathSamples = []
    for (const item of allFiles) {
      if (pathSamples.length < 5) pathSamples.push(item.path)
      if (item.type !== 'blob' || !item.path.endsWith('.txt')) continue
      const parts = item.path.split('/')
      const stockIdx = parts.indexOf('1.Stock')
      if (stockIdx < 0 || parts.length < stockIdx + 5) continue
      const starRaw = parts[stockIdx + 1]
      if (!STAR_TYPES.has(starRaw)) continue
      const colorFile = parts[stockIdx + 4]
      if (colorFile.startsWith('#')) continue
      stockTxts.push(item.path)
    }
    log.push(`First 5 paths in tree: ${JSON.stringify(pathSamples)}`)
    log.push(`Stock S6 txt files matched: ${stockTxts.length}`)
    if (stockTxts.length > 0) log.push(`First match: ${stockTxts[0]}`)

    // Step 4: try fetching one txt to test ghRaw
    if (stockTxts.length > 0) {
      log.push('Step 4: test-fetching first matched txt...')
      try {
        const raw = await ghRaw(stockTxts[0])
        const obj = JSON.parse(raw)
        log.push(`Test parse OK: crdb=${obj.crdb}, paid=${obj.paid}, ctie=${obj.ctie}`)
      } catch (e) {
        log.push(`Test parse FAILED: ${e.message}`)
      }
    }

    // Step 5: check Supabase car_db
    log.push('Step 5: checking Supabase car_db...')
    const { data: dbRow, error: dbErr } = await supabase.from('csr2_cache').select('data, updated_at').eq('key', 'car_db').single()
    if (dbErr) log.push(`Supabase error: ${dbErr.message}`)
    else log.push(`Supabase car_db: ${Array.isArray(dbRow?.data) ? dbRow.data.length + ' cars, updated ' + dbRow.updated_at : 'null/not found'}`)

    return Response.json({ ok: true, log })
  } catch (e) {
    log.push(`ERROR: ${e.message}`)
    return Response.json({ ok: false, log, error: e.message })
  }
}
