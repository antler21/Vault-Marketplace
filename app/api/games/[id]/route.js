import { supabase } from '../../../lib/supabase'

export async function PUT(request, context) {
  const params = await context.params
  const body = await request.json()

  const { data, error } = await supabase
    .from('games')
    .update({
      name: body.name || '',
      image: body.image || '',
      sections: body.sections || [],
      allowed_platform_ids: body.allowedPlatformIds || [],
      title_char_limit: body.titleCharLimit || null,
      data_lists: body.dataLists || [],
      script_enabled: body.scriptEnabled ?? false,
      script_sections: body.scriptSections || [],
      scanner_type: body.scannerType || null,
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
    .from('games')
    .delete()
    .eq('id', params.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
