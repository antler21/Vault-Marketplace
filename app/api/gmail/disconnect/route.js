import { supabase } from '../../../lib/supabase'

export async function POST() {
  try {
    await supabase.from('gmail_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}