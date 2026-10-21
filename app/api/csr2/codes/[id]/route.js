import { supabase } from '../../../../lib/supabase'
import { isAdminAuthed } from '../../../../lib/requireAdmin'

// Admin-only, same dual auth (session or AIO Tool's CSR2_ADMIN_TOKEN) as /api/csr2/codes.

export async function GET(request, context) {
  if (!(await isAdminAuthed(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  const { data: code, error } = await supabase
    .from('csr2_codes')
    .select('id, pack_name, plaintext_code, created_at, used_at, used_by_job_id')
    .eq('id', id)
    .single()
  if (error || !code) return Response.json({ error: 'Code not found' }, { status: 404 })

  // Only look up a job at all if the code is actually in a used state — a
  // code manually toggled back to available must show no job, even though a
  // job row sharing its code_id may still exist from before the toggle.
  let job = null
  if (code.used_at) {
    // used_by_job_id is set going forward (see /api/csr2/jobs POST); fall back
    // to a lookup by code_id only for codes redeemed before that was added.
    const { data: jobRow } = code.used_by_job_id
      ? await supabase.from('csr2_jobs').select('email, platform, status').eq('id', code.used_by_job_id).maybeSingle()
      : await supabase.from('csr2_jobs').select('email, platform, status').eq('code_id', id).maybeSingle()
    if (jobRow) job = jobRow
  }

  return Response.json({ ok: true, code: { ...code, job } })
}

export async function PATCH(request, context) {
  if (!(await isAdminAuthed(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof body.used !== 'boolean') return Response.json({ error: 'Missing used (boolean)' }, { status: 400 })

  // Marking available again clears used_by_job_id too — it would otherwise
  // point at a job for a code that, as far as the system is concerned, was
  // never actually redeemed.
  const patch = body.used
    ? { used_at: new Date().toISOString() }
    : { used_at: null, used_by_job_id: null }

  const { data, error } = await supabase
    .from('csr2_codes')
    .update(patch)
    .eq('id', id)
    .select('id, pack_name, plaintext_code, created_at, used_at')
    .single()
  if (error || !data) {
    console.error('[csr2/codes/[id] PATCH]', error?.message)
    return Response.json({ error: error?.message || 'Code not found' }, { status: 500 })
  }

  return Response.json({ ok: true, code: data })
}
