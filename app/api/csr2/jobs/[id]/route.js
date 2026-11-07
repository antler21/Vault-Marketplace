import { supabase } from '../../../../lib/supabase'
import { encryptForWorker } from '../../../../lib/csr2Crypto'
import { buildRiskPlan } from '../../../../lib/csr2RiskPlan'

// Never select password_enc/twofa_code here — the browser polls this route and
// must never see even the encrypted blob, let alone plaintext. account_confirm_data
// is safe (just name/level/save-id, shown to the buyer to confirm it's their account).
const SAFE_FIELDS = [
  'id', 'code_id', 'platform', 'account_mode', 'status', 'error_message',
  'account_confirm_data', 'gamecenter_screenshot_url', 'signin_approval_screenshot_url',
  'completion_screenshot_url', 'safe_mode', 'account_banned',
  'feedback_text', 'feedback_rewarded', 'review_submitted',
  'created_at', 'updated_at',
].join(', ')

export async function GET(request, context) {
  const { id } = await context.params
  const { data, error } = await supabase
    .from('csr2_jobs')
    .select(SAFE_FIELDS)
    .eq('id', id)
    .single()
  if (error || !data) return Response.json({ error: 'Job not found' }, { status: 404 })

  if (data.status === 'awaiting_risk_decision') {
    data.riskPlan = await buildRiskPlan(data)
  }
  if (data.status === 'done') {
    const { data: rewards } = await supabase
      .from('csr2_rewards')
      .select('kind, granted_at, redeemed')
      .eq('job_id', id)
    data.rewards = rewards || []
  }
  return Response.json(data)
}

// Frontend-facing credential/2FA/confirmation submission. Status transitions belong
// to the worker (via /api/csr2/worker/*) — this route only ever writes buyer-answer
// fields, gated by the job's current status.
export async function PATCH(request, context) {
  const { id } = await context.params
  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { data: job, error: jobErr } = await supabase
    .from('csr2_jobs')
    .select('id, status, feedback_rewarded, review_submitted')
    .eq('id', id)
    .single()
  if (jobErr || !job) return Response.json({ error: 'Job not found' }, { status: 404 })

  if (typeof body.twofaCode === 'string') {
    // bad_code means the worker already rejected one attempt — resubmitting is
    // exactly "let them resubmit," so it has to be accepted here too, not just awaiting_2fa.
    if (job.status !== 'awaiting_2fa' && job.status !== 'bad_code') {
      return Response.json({ error: 'Not awaiting a 2FA code right now' }, { status: 409 })
    }
    const code = body.twofaCode.trim()
    if (!code) return Response.json({ error: 'Missing twofaCode' }, { status: 400 })
    const { error } = await supabase
      .from('csr2_jobs')
      .update({ twofa_code: encryptForWorker(code), updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      console.error('[csr2/jobs PATCH 2fa]', error.message)
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ ok: true })
  }

  if (typeof body.confirmAccount === 'boolean') {
    if (job.status !== 'awaiting_account_confirm') {
      return Response.json({ error: 'Not awaiting an account confirmation right now' }, { status: 409 })
    }
    const { error } = await supabase
      .from('csr2_jobs')
      .update({ account_confirmed: body.confirmAccount, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      console.error('[csr2/jobs PATCH confirm]', error.message)
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ ok: true })
  }

  if (typeof body.gamecenterConfirm === 'boolean') {
    if (job.status !== 'awaiting_gamecenter_confirm') {
      return Response.json({ error: 'Not awaiting GameCenter confirmation right now' }, { status: 409 })
    }
    const { error } = await supabase
      .from('csr2_jobs')
      .update({ gamecenter_confirmed: body.gamecenterConfirm, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  // NOTE: no PATCH handler for 'awaiting_signin_approval' — the buyer approves on
  // their own device for Android, not on this site; the page just displays the
  // screenshot and waits for the worker to move the status forward on its own.

  if (typeof body.riskDecision === 'string') {
    if (job.status !== 'awaiting_risk_decision') {
      return Response.json({ error: 'Not awaiting a delivery decision right now' }, { status: 409 })
    }
    if (!['accept', 'override'].includes(body.riskDecision)) {
      return Response.json({ error: 'Invalid riskDecision' }, { status: 400 })
    }
    const { error } = await supabase
      .from('csr2_jobs')
      .update({ risk_decision: body.riskDecision, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  // Mandatory, non-skippable for free-unban packs — asked while still on the
  // credentials step, so no status gate beyond "hasn't moved past it yet."
  if (typeof body.accountBanned === 'boolean') {
    if (!['awaiting_credentials', 'bad_password'].includes(job.status)) {
      return Response.json({ error: 'Too late to answer this now' }, { status: 409 })
    }
    const { error } = await supabase
      .from('csr2_jobs')
      .update({ account_banned: body.accountBanned, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (typeof body.feedbackText === 'string') {
    if (job.status !== 'done') return Response.json({ error: 'Not available yet' }, { status: 409 })
    const text = body.feedbackText.trim()
    if (text.length < 20) return Response.json({ error: 'Feedback must be at least 20 characters' }, { status: 400 })
    const patch = { feedback_text: text, updated_at: new Date().toISOString() }
    if (!job.feedback_rewarded) {
      patch.feedback_rewarded = true
      await supabase.from('csr2_rewards').insert({ job_id: id, kind: 'feedback' })
    }
    const { error } = await supabase.from('csr2_jobs').update(patch).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, rewarded: !job.feedback_rewarded })
  }

  if (body.reviewSubmitted === true) {
    if (job.status !== 'done') return Response.json({ error: 'Not available yet' }, { status: 409 })
    const patch = { review_submitted: true, updated_at: new Date().toISOString() }
    if (!job.review_submitted) {
      await supabase.from('csr2_rewards').insert({ job_id: id, kind: 'review' })
    }
    const { error } = await supabase.from('csr2_jobs').update(patch).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (typeof body.email === 'string' || typeof body.password === 'string') {
    // bad_password means the worker already rejected one attempt — resubmitting is
    // exactly "let them resubmit," so it has to be accepted here too, not just awaiting_credentials.
    if (job.status !== 'awaiting_credentials' && job.status !== 'bad_password') {
      return Response.json({ error: 'Not awaiting credentials right now' }, { status: 409 })
    }
    const email = (body.email || '').trim()
    const password = body.password || ''
    if (!email || !password) return Response.json({ error: 'Missing email or password' }, { status: 400 })
    const { error } = await supabase
      .from('csr2_jobs')
      .update({ email, password_enc: encryptForWorker(password), updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      console.error('[csr2/jobs PATCH creds]', error.message)
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Nothing to update' }, { status: 400 })
}
