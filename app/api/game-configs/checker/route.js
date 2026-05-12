import { supabase } from '../../../lib/supabase'

export const runtime = 'nodejs'

export async function POST(request) {
  try {
    const body = await request.json()
    const { gameId, lastRun } = body
    if (!gameId) return Response.json({ error: 'gameId required' }, { status: 400 })

    const config = { ...lastRun, savedAt: new Date().toISOString() }

    const { data: existing } = await supabase
      .from('game_configs').select('id').eq('game_id', gameId).eq('section', 'checker_last_run').single()

    if (existing) {
      await supabase.from('game_configs').update({ config }).eq('id', existing.id)
    } else {
      await supabase.from('game_configs').insert({ game_id: gameId, section: 'checker_last_run', config })
    }

    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
