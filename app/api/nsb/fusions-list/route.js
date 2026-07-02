import { supabase } from '../../../lib/supabase'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const { data } = await supabase.from('csr2_cache').select('data').eq('key', 'fusion_brands').single()
    if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
      return Response.json({ brands: data.data })
    }
    return Response.json({ brands: [] })
  } catch (e) {
    return Response.json({ brands: [], error: e.message })
  }
}
