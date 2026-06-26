export const runtime = 'nodejs'

const FUSIONS_URL = 'https://raw.githubusercontent.com/Nitro4CSR/CSR2-DataBase/Everything/3.Fusions/%23%23AllFusions.txt'

function fmtBrand(upma) {
  if (!upma) return upma
  return upma.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim()
}

export async function GET() {
  try {
    const res = await fetch(FUSIONS_URL, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error('GitHub ' + res.status)
    const data = JSON.parse(await res.text())
    const seen = new Set()
    const brands = []
    if (Array.isArray(data)) {
      for (const e of data) {
        if (typeof e === 'object' && e !== null && e.upma && !seen.has(e.upma)) {
          seen.add(e.upma); brands.push({ upma: e.upma, name: fmtBrand(e.upma) })
        }
      }
    }
    return Response.json({ brands })
  } catch (e) {
    return Response.json({ error: e.message, brands: [] })
  }
}
