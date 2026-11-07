import { supabase } from '../../../../lib/supabase'

// Dev-only test harness (see ../route.js). GET gives the harness page a fuller
// view than the buyer-safe GET /api/csr2/jobs/[id] (no password/2FA fields exist
// to worry about hiding on a test job, since nothing here ever gets real
// credentials). PATCH forwards straight to the real worker route — same auth,
// same code path a real worker PATCH would hit — so this exercises the actual
// contract instead of a separate reimplementation of it.

export async function GET(request, context) {
  const { id } = await context.params
  const { data, error } = await supabase
    .from('csr2_jobs')
    .select('id, code_id, platform, account_mode, status, error_message, account_confirm_data, gamecenter_screenshot_url, signin_approval_screenshot_url, completion_screenshot_url, safe_mode, car_selection, account_banned, risk_decision, feedback_text, feedback_rewarded, review_submitted, created_at, updated_at')
    .eq('id', id)
    .single()
  if (error || !data) return Response.json({ error: 'Job not found' }, { status: 404 })
  return Response.json(data)
}

export async function PATCH(request, context) {
  const { id } = await context.params
  if (!process.env.CSR2_WORKER_TOKEN) {
    return Response.json({ error: 'CSR2_WORKER_TOKEN not set on this environment' }, { status: 500 })
  }
  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const workerUrl = new URL('/api/csr2/worker/jobs/' + id, request.url)
  const res = await fetch(workerUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.CSR2_WORKER_TOKEN },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return Response.json(data, { status: res.status })
}
