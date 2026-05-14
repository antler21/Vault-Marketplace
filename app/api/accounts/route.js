import { supabase } from '../../lib/supabase'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')

  let query = supabase.from('accounts').select('*').order('created_at', { ascending: true })
  if (gameId) query = query.eq('game_id', gameId)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const body = await request.json()
  const { data, error } = await supabase
    .from('accounts')
    .insert([{
      game_id: body.gameId,
      title: body.title || '',
      status: body.status,
      fields: body.fields || {},
      images: body.images || [],
      thumbnail_index: body.thumbnailIndex || 0,
      bought_for: body.boughtFor || 0,
      sold_for: body.status === 'Lost' ? 0 : (body.soldFor || 0),
      bought_for_currency: body.boughtForCurrency || 'USD',
      sold_for_currency: body.soldForCurrency || 'USD',
      target_platforms: body.targetPlatforms || [],
      posting_priority: body.postingPriority || 0,
    }])
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}