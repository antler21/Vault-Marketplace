import { supabase } from '../../../lib/supabase'
import { revertCodeStatus } from '../../../lib/csr2Ledger'

const ALLOWED_PLATFORMS = ['ios'] // android is WIP — rejected server-side too

export async function POST(request) {
  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { codeId, platform, accountMode, safeMode, carSelection } = body
  if (!codeId) return Response.json({ error: 'Missing codeId' }, { status: 400 })
  if (!ALLOWED_PLATFORMS.includes(platform)) {
    return Response.json({ error: 'Unsupported platform: ' + platform }, { status: 400 })
  }
  if (accountMode && !['existing', 'new'].includes(accountMode)) {
    return Response.json({ error: 'Invalid accountMode' }, { status: 400 })
  }

  const { data: codeRow, error: codeErr } = await supabase
    .from('csr2_codes')
    .select('id, status, is_test')
    .eq('id', codeId)
    .single()
  if (codeErr || !codeRow || codeRow.status !== 'in_progress') {
    return Response.json({ error: 'Code has not been redeemed' }, { status: 400 })
  }

  // "I don't have an existing account" — nothing to track, so no job gets created.
  // Hand the code's claim back (to 'partial' if it has prior history, else 'unused')
  // so it stays redeemable; the buyer page just shows the static message and stops.
  if (accountMode === 'new') {
    await revertCodeStatus(codeId)
    return Response.json({ ok: true, needsNewAccount: true })
  }

  // One job per code AT A TIME — but a code with a prior 'done'/'error' job (a
  // completed partial redemption, or an abandoned attempt) can start a fresh one,
  // which is how a 'partial' code's remainder gets claimed on a later visit.
  const { data: existing } = await supabase
    .from('csr2_jobs')
    .select('id, status')
    .eq('code_id', codeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing && !['done', 'error'].includes(existing.status)) {
    return Response.json({ ok: true, jobId: existing.id })
  }

  const { data: job, error } = await supabase
    .from('csr2_jobs')
    .insert({
      code_id: codeId,
      platform,
      status: 'awaiting_credentials',
      account_mode: accountMode || 'existing',
      safe_mode: !!safeMode,
      car_selection: carSelection || null,
      // Propagated from the code so a test-harness redemption never becomes
      // claimable by the real worker (see migration 008 + claim/route.js).
      is_test: !!codeRow.is_test,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[csr2/jobs POST]', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Link the code back to its latest job so the Codes detail view can show who redeemed it.
  await supabase.from('csr2_codes').update({ used_by_job_id: job.id }).eq('id', codeId)

  return Response.json({ ok: true, jobId: job.id })
}
