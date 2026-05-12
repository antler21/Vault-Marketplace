import { supabase } from '../../lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const body = await request.json()

  const { data, error } = await supabase
    .from('offers')
    .insert([{
      game_id: body.gameId || null,
      game_name: body.gameName || '',
      offer_type: body.offerType || 'direct',
      fields: body.fields || {},
      price: body.price || 0,
      contact_email: body.contactEmail || '',
      contact_discord: body.contactDiscord || '',
      message: body.message || '',
      priority: body.priority || 'Normal',
      status: 'New',
    }])
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}