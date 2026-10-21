import { supabase } from '../../../lib/supabase'

const ALLOWED_PLATFORMS = ['ios'] // android is WIP — rejected server-side too

export async function POST(request) {
  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { codeId, platform } = body
  if (!codeId) return Response.json({ error: 'Missing codeId' }, { status: 400 })
  if (!ALLOWED_PLATFORMS.includes(platform)) {
    return Response.json({ error: 'Unsupported platform: ' + platform }, { status: 400 })
  }

  const { data: codeRow, error: codeErr } = await supabase
    .from('csr2_codes')
    .select('id, used_at')
    .eq('id', codeId)
    .single()
  if (codeErr || !codeRow || !codeRow.used_at) {
    return Response.json({ error: 'Code has not been redeemed' }, { status: 400 })
  }

  // One job per code — if a job already exists (e.g. the client retried), hand back its id.
  const { data: existing } = await supabase
    .from('csr2_jobs')
    .select('id')
    .eq('code_id', codeId)
    .maybeSingle()
  if (existing) return Response.json({ ok: true, jobId: existing.id })

  const { data: job, error } = await supabase
    .from('csr2_jobs')
    .insert({ code_id: codeId, platform, status: 'awaiting_credentials' })
    .select('id')
    .single()

  if (error) {
    console.error('[csr2/jobs POST]', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, jobId: job.id })
}
