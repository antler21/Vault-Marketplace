import { supabase } from '../../../lib/supabase'
import { getUnreleasedCars } from '../../../lib/csr2CarDb'

export const maxDuration = 30

// Backs the buyer-facing car picker (spec §9). Car/color data is the same cache
// app/api/nsb/sync-car-db/route.js already keeps warm; the only new work here is
// cross-referencing the live "Update x.x.x" unreleased check on top of it.
export async function GET() {
  const { data: row, error } = await supabase.from('csr2_cache').select('data').eq('key', 'car_db').single()
  if (error || !row) return Response.json({ error: 'Car database not synced yet' }, { status: 503 })

  let unreleased = new Set()
  try {
    ;({ unreleased } = await getUnreleasedCars())
  } catch (e) {
    // Live GitHub lookup failing shouldn't block the whole picker — just skip flagging.
    console.error('[csr2/cars GET] unreleased check failed', e.message)
  }

  const cars = (row.data || []).map(car => ({
    ...car,
    unreleased: unreleased.has(car.brand + '|' + car.model),
  }))

  return Response.json({ cars })
}
