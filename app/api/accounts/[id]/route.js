import { supabase } from '../../../lib/supabase'

export async function PUT(request, context) {
  const params = await context.params
  const body = await request.json()

  const { data, error } = await supabase
    .from('accounts')
    .update({
      title: body.title || '',
      description: body.description || '',
      status: body.status || 'Available',
      fields: body.fields || {},
      images: body.images || [],
      thumbnail_index: body.thumbnailIndex || 0,
      bought_for: body.boughtFor || 0,
      sold_for: body.status === 'Lost' ? 0 : (body.soldFor || 0),
      bought_for_currency: body.boughtForCurrency || 'USD',
      sold_for_currency: body.soldForCurrency || 'USD',
      target_platforms: body.targetPlatforms || [],
      posting_priority: body.postingPriority || 0,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(request, context) {
  const params = await context.params
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', params.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}