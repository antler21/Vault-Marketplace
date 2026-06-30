import { supabase } from '../../../lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 30

const RAW_URL = 'https://raw.githubusercontent.com/Nitro4CSR/CSR2-DataBase/Everything/1.Cars/%23AllCarCRDBs.txt'

export async function POST() {
  try {
    const res = await fetch(RAW_URL, { cache: 'no-store' })
    if (!res.ok) throw new Error('GitHub fetch failed: ' + res.status)
    const text = await res.text()
    const cars = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (cars.length === 0) throw new Error('Empty car list returned from GitHub')

    await supabase.from('csr2_cache').upsert({
      key:        'all_cars',
      data:       cars,
      updated_at: new Date().toISOString(),
    })

    return Response.json({ ok: true, count: cars.length })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
