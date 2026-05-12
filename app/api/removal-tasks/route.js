import { supabase } from '../../lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('removal_tasks')
    .select('*')
    .eq('status', 'Pending')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const body = await request.json()
  const { accountId, accountTitle, platformName, soldOnPlatform } = body

  const { data, error } = await supabase
    .from('removal_tasks')
    .insert([{
      account_id: accountId,
      account_title: accountTitle,
      platform_name: platformName,
      sold_on_platform: soldOnPlatform,
      status: 'Pending',
    }])
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}