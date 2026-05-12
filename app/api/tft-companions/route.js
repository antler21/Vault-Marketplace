import { supabase } from '../../lib/supabase'

// SGP calls happen client-side — this route only persists the result to the DB
export async function POST(request) {
  try {
    const { companionIds, scanId } = await request.json()
    if (!Array.isArray(companionIds) || !scanId) {
      return Response.json({ error: 'Missing companionIds or scanId' }, { status: 400 })
    }
    const { error } = await supabase
      .from('lol_skin_scans')
      .update({ tft_companion_ids: companionIds })
      .eq('id', scanId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
