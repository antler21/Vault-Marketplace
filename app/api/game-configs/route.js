import { supabase } from '../../lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('game_section_configs')
    .select('*')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const body = await request.json()

  const { data, error } = await supabase
    .from('game_section_configs')
    .upsert({
      game_id: body.gameId,
      section: body.section,
      config: body.config || {},
    }, { onConflict: 'game_id,section' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}