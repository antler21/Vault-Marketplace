import { supabase } from '../../../lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('csr2_packs')
    .select('*')
    .order('name')

  if (error) {
    console.error('[csr2/packs GET]', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data)
}

export async function POST(request) {
  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, data } = body
  if (!name) return Response.json({ error: 'Missing pack name' }, { status: 400 })

  const { data: saved, error } = await supabase
    .from('csr2_packs')
    .upsert({ name, data: data || body }, { onConflict: 'name' })
    .select()
    .single()

  if (error) {
    console.error('[csr2/packs POST]', error.message, error.details, error.hint)
    return Response.json({ error: error.message, details: error.details, hint: error.hint }, { status: 500 })
  }
  return Response.json({ ok: true, pack: saved })
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')
  if (!name) return Response.json({ error: 'Missing name' }, { status: 400 })

  const { error } = await supabase.from('csr2_packs').delete().eq('name', name)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
