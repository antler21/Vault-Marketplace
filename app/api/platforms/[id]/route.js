import { supabase } from '../../../lib/supabase'

export async function PUT(request, context) {
  const params = await context.params
  const body = await request.json()

  const { data, error } = await supabase
    .from('platforms')
    .update({
      name: body.name || '',
      url: body.url || '',
      image: body.image || '',
      global_fields: body.globalFields || [],
      game_templates: body.gameTemplates || [],
      email_sender: body.emailSender || '',
      email_parsing_rules: body.emailParsingRules || {},
      title_rules: body.titleRules || {},
      enabled_sections: body.enabledSections || {},
      fee_percentage: body.feePercentage || 0,
      fee_fixed: body.feeFixed || 0,
      holding_days: body.holdingDays || 0,
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
    .from('platforms')
    .delete()
    .eq('id', params.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}