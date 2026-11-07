import { supabase } from '../../../../lib/supabase'
import { isAdminAuthed } from '../../../../lib/requireAdmin'

// Admin-only, same dual auth (session or AIO Tool's CSR2_ADMIN_TOKEN) as /api/csr2/codes.

export async function GET(request, context) {
  if (!(await isAdminAuthed(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  const { data: code, error } = await supabase
    .from('csr2_codes')
    .select('id, pack_name, plaintext_code, created_at, used_at, used_by_job_id, status, platform_tag')
    .eq('id', id)
    .single()
  if (error || !code) return Response.json({ error: 'Code not found' }, { status: 404 })

  // Only look up a job at all once the code has left 'unused' — a code manually
  // toggled back to available must show no job, even though an old job row
  // sharing its code_id (or used_by_job_id) may still exist from before the
  // toggle. This is the same guard the status-column migration replaced
  // code.used_at with — don't drop it, it was a real bug once.
  let job = null
  if (code.status !== 'unused') {
    // used_by_job_id is set going forward (see /api/csr2/jobs POST); fall back
    // to a lookup by code_id only for codes redeemed before that was added.
    const { data: jobRow } = code.used_by_job_id
      ? await supabase.from('csr2_jobs').select('email, platform, status, created_at, updated_at').eq('id', code.used_by_job_id).maybeSingle()
      : await supabase.from('csr2_jobs').select('email, platform, status, created_at, updated_at').eq('code_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (jobRow) job = jobRow
  }

  // Redemption ledger (spec §13 "stats per redemption" + the Partial tab's "who/
  // when claimed the other half" context) — every full/safe_half/unban_only/
  // refill delivery against this code, newest first.
  const { data: redemptions } = await supabase
    .from('csr2_code_redemptions')
    .select('platform, account_last4, kind, currencies_delivered, cars_delivered, remaining_currencies, redeemed_at')
    .eq('code_id', id)
    .order('redeemed_at', { ascending: false })

  return Response.json({ ok: true, code: { ...code, job, redemptions: redemptions || [] } })
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
  // never actually redeemed. `status` is the column that actually gates
  // redemption (see app/api/csr2/redeem/route.js) — used_at is kept alongside
  // it only for display/back-compat, not as the real gate anymore.
  const patch = body.used
    ? { used_at: new Date().toISOString(), status: 'used' }
    : { used_at: null, used_by_job_id: null, status: 'unused' }

  const { data, error } = await supabase
    .from('csr2_codes')
    .update(patch)
    .eq('id', id)
    .select('id, pack_name, plaintext_code, created_at, used_at, status, platform_tag')
    .single()
  if (error || !data) {
    console.error('[csr2/codes/[id] PATCH]', error?.message)
    return Response.json({ error: error?.message || 'Code not found' }, { status: 500 })
  }

  return Response.json({ ok: true, code: data })
}
