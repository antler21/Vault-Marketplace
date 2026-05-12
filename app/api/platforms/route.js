import { supabase } from '../../lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('platforms')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const body = await request.json()

  const { data, error } = await supabase
    .from('platforms')
    .insert([{
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
    }])
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}