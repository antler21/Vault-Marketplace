import { supabase } from '../../../lib/supabase'

export async function PUT(request, context) {
  const params = await context.params
  const body = await request.json()

  const { data, error } = await supabase
    .from('offers')
    .update({
      status: body.status,
      priority: body.priority,
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
    .from('offers')
    .delete()
    .eq('id', params.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}