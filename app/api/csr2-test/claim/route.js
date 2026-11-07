import { supabase } from '../../../lib/supabase'
import { buildRiskPlan } from '../../../lib/csr2RiskPlan'

// Test-only mirror of /api/csr2/worker/claim, scoped to is_test=true jobs only —
// so the fake-worker test script never competes with (or gets mixed up with) the
// real worker, and the real worker's claim() never sees test jobs either (see
// migration 008 + the is_test filter added there). Same bearer-token auth as the
// real worker route.
function isWorkerAuthed(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return !!process.env.CSR2_WORKER_TOKEN && token === process.env.CSR2_WORKER_TOKEN
}

export async function GET(request) {
  if (!isWorkerAuthed(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: credsReady } = await supabase
    .from('csr2_jobs')
    .select('*')
    .in('status', ['awaiting_credentials', 'bad_password'])
    .not('password_enc', 'is', null)
    .eq('is_test', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (credsReady) {
    await supabase.from('csr2_jobs')
      .update({ status: 'logging_in', password_enc: null, updated_at: new Date().toISOString() })
      .eq('id', credsReady.id).eq('status', credsReady.status)
    return Response.json({ job: credsReady })
  }

  const { data: twofaReady } = await supabase
    .from('csr2_jobs')
    .select('*')
    .in('status', ['awaiting_2fa', 'bad_code'])
    .not('twofa_code', 'is', null)
    .eq('is_test', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (twofaReady) {
    await supabase.from('csr2_jobs')
      .update({ twofa_code: null, updated_at: new Date().toISOString() })
      .eq('id', twofaReady.id).eq('status', twofaReady.status)
    return Response.json({ job: twofaReady })
  }

  const { data: confirmReady } = await supabase
    .from('csr2_jobs')
    .select('*')
    .eq('status', 'awaiting_account_confirm')
    .not('account_confirmed', 'is', null)
    .eq('is_test', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (confirmReady) {
    await supabase.from('csr2_jobs')
      .update({ account_confirmed: null, updated_at: new Date().toISOString() })
      .eq('id', confirmReady.id).eq('status', 'awaiting_account_confirm')
    return Response.json({ job: confirmReady })
  }

  const { data: gcReady } = await supabase
    .from('csr2_jobs')
    .select('*')
    .eq('status', 'awaiting_gamecenter_confirm')
    .not('gamecenter_confirmed', 'is', null)
    .eq('is_test', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (gcReady) {
    await supabase.from('csr2_jobs')
      .update({ gamecenter_confirmed: null, updated_at: new Date().toISOString() })
      .eq('id', gcReady.id).eq('status', 'awaiting_gamecenter_confirm')
    return Response.json({ job: gcReady })
  }

  const { data: riskReady } = await supabase
    .from('csr2_jobs')
    .select('*')
    .eq('status', 'awaiting_risk_decision')
    .not('risk_decision', 'is', null)
    .eq('is_test', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (riskReady) {
    const riskPlan = await buildRiskPlan(riskReady)
    return Response.json({ job: { ...riskReady, riskPlan } })
  }

  return Response.json({ job: null })
}
