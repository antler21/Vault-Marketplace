import { supabase } from '../../../lib/supabase'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const { data } = await supabase.from('csr2_cache').select('data').eq('key', 'car_db').single()
    if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
      return Response.json({ cars: data.data })
    }
    return Response.json({ cars: [] })
  } catch (e) {
    return Response.json({ cars: [], error: e.message })
  }
}
