import { supabase } from '../../../lib/supabase'

// No per-IP rate limiting here like /redeem — this isn't a guessable secret an
// attacker benefits from hammering, just a buyer-facing bug-report form. Review
// workflow for these is explicitly TBD (see the approved plan); this only captures.
export async function POST(request) {
  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const message = (body.message || '').trim()
  if (!message) return Response.json({ error: 'Missing message' }, { status: 400 })
  if (message.length > 2000) return Response.json({ error: 'Message too long' }, { status: 400 })

  const { error } = await supabase.from('csr2_error_reports').insert({
    job_id: body.jobId || null,
    code_id: body.codeId || null,
    message,
  })
  if (error) {
    console.error('[csr2/error-reports POST]', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ ok: true })
}
