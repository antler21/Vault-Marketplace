import { supabase } from '../../../lib/supabase'

export async function POST(request) {
  const body = await request.json()
  const { accounts } = body

  if (!accounts || !accounts.length) {
    return Response.json({ error: 'No accounts provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert(accounts.map(a => ({
      game_id: a.gameId,
      title: a.title || '',
      status: a.status || 'Available',
      fields: a.fields || {},
      images: [],
      thumbnail_index: 0,
      bought_for: a.boughtFor || 0,
      sold_for: a.status === 'Lost' ? 0 : (a.soldFor || 0),
      bought_for_currency: a.boughtForCurrency || 'USD',
      sold_for_currency: a.soldForCurrency || 'USD',
      target_platforms: a.targetPlatforms || [],
      posting_priority: a.postingPriority || 0,
    })))
    .select()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}