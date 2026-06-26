export const runtime = 'nodejs'

const S6_URL = "https://raw.githubusercontent.com/Nitro4CSR/CSR2-DataBase/Everything/4.Stage6's/%23%23AllStage6's.txt"

export async function GET() {
  try {
    const res = await fetch(S6_URL, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error('GitHub ' + res.status)
    const data = JSON.parse(await res.text())
    const seen = new Set()
    const cars = []
    if (Array.isArray(data)) {
      for (const e of data) {
        if (typeof e === 'object' && e !== null && e.esdb && !seen.has(e.esdb)) {
          seen.add(e.esdb)
          const brand = e.esdb.replace(/([A-Z][a-z].*$)/, '').trim() || e.esdb.split('_')[0]
          cars.push({ esdb: e.esdb, brand: brand || e.esdb })
        }
      }
    }
    return Response.json({ cars })
  } catch (e) {
    return Response.json({ error: e.message, cars: [] })
  }
}
