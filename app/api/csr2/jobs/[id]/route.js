import { supabase } from '../../../../lib/supabase'
import { encryptForWorker } from '../../../../lib/csr2Crypto'

// Never select password_enc/twofa_code here — the browser polls this route and
// must never see even the encrypted blob, let alone plaintext.
const SAFE_FIELDS = 'id, platform, status, error_message, created_at, updated_at'

export async function GET(request, context) {
  const { id } = await context.params
  const { data, error } = await supabase
    .from('csr2_jobs')
    .select(SAFE_FIELDS)
    .eq('id', id)
    .single()
  if (error || !data) return Response.json({ error: 'Job not found' }, { status: 404 })
  return Response.json(data)
}

// Frontend-facing credential/2FA submission. Status transitions belong to the
// worker (via /api/csr2/worker/*) — this route only ever writes the encrypted
// fields, gated by the job's current status.
export async function PATCH(request, context) {
  const { id } = await context.params
  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { data: job, error: jobErr } = await supabase
    .from('csr2_jobs')
    .select('id, status')
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
