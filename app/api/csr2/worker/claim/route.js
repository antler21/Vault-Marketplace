import { supabase } from '../../../../lib/supabase'

// Bearer-token auth only — deliberately NOT a Supabase session check, so the
// customer's browser (which never has this token) can't reach it even though
// /api/csr2 is a public prefix in middleware.js.
function isWorkerAuthed(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return !!process.env.CSR2_WORKER_TOKEN && token === process.env.CSR2_WORKER_TOKEN
}

// The worker needs to know which pack a job is for (to call the AIO Tool's own
// /csr2/apply-nsb with the matching local packId) but a claimed job only has
// code_id — resolve the chain once here so the worker doesn't need a second route.
async function resolvePack(codeId) {
  const { data: codeRow } = await supabase.from('csr2_codes').select('pack_name').eq('id', codeId).maybeSingle()
  if (!codeRow) return null
  const { data: pack } = await supabase.from('csr2_packs').select('name, data').eq('name', codeRow.pack_name).maybeSingle()
  if (!pack) return null

  // Combo packs apply 2+ already-defined packs in sequence (resources, then
  // cars, etc. — see csr2_worker.py) instead of their own currencies/cars/
  // etc. Resolve every stage's full pack row here so the worker gets the
  // whole chain in one claim() response rather than fetching packs itself.
  if (pack.data?.isCombo && Array.isArray(pack.data.stages) && pack.data.stages.length) {
    const { data: stagePacks } = await supabase.from('csr2_packs').select('name, data').in('name', pack.data.stages)
    const byName = Object.fromEntries((stagePacks || []).map(p => [p.name, p]))
    pack.stages = pack.data.stages.map(n => byName[n]).filter(Boolean)
  }
  return pack
}

export async function GET(request) {
  if (!isWorkerAuthed(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Credential-ready jobs first. Includes bad_password — a resubmission after a
  // rejected attempt lands back in this same bucket, not a dead end. Claiming
  // flips status -> logging_in and nulls password_enc in the same update
  // (credential consumed, don't keep it at rest once the worker has it) — the
  // row returned below still has the original encrypted password to decrypt now.
  const { data: credsReady, error: credsErr } = await supabase
    .from('csr2_jobs')
    .select('*')
    .in('status', ['awaiting_credentials', 'bad_password'])
    .not('password_enc', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (credsErr) {
    console.error('[csr2/worker/claim]', credsErr.message)
    return Response.json({ error: credsErr.message }, { status: 500 })
  }

  if (credsReady) {
    const { error: claimErr } = await supabase
      .from('csr2_jobs')
      .update({ status: 'logging_in', password_enc: null, updated_at: new Date().toISOString() })
      .eq('id', credsReady.id)
      .eq('status', credsReady.status)
    if (claimErr) {
      console.error('[csr2/worker/claim]', claimErr.message)
      return Response.json({ error: claimErr.message }, { status: 500 })
    }
    return Response.json({ job: { ...credsReady, pack: await resolvePack(credsReady.code_id) } })
  }

  // 2FA-ready jobs. Includes bad_code for the same reason as bad_password above.
  // Status stays as-is until the worker reports the outcome via
  // PATCH /api/csr2/worker/jobs/[id] — only twofa_code is cleared here, since
  // "cleared after each submit attempt" means once it's been read.
  const { data: twofaReady, error: twofaErr } = await supabase
    .from('csr2_jobs')
    .select('*')
    .in('status', ['awaiting_2fa', 'bad_code'])
    .not('twofa_code', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (twofaErr) {
    console.error('[csr2/worker/claim]', twofaErr.message)
    return Response.json({ error: twofaErr.message }, { status: 500 })
  }

  if (twofaReady) {
    const { error: claimErr } = await supabase
      .from('csr2_jobs')
      .update({ twofa_code: null, updated_at: new Date().toISOString() })
      .eq('id', twofaReady.id)
      .eq('status', twofaReady.status)
    if (claimErr) {
      console.error('[csr2/worker/claim]', claimErr.message)
      return Response.json({ error: claimErr.message }, { status: 500 })
    }
    return Response.json({ job: { ...twofaReady, pack: await resolvePack(twofaReady.code_id) } })
  }

  // Account-confirmation answers. This one happens mid-flight — the worker
  // already owns this job (claimed it back at the credentials step) and is
  // just polling claim() again for its own job's answer, same pattern as 2FA.
  // account_confirmed is a boolean, so this MUST be `.not('account_confirmed', 'is', null)`,
  // not a truthiness check — `false` (buyer says "not my account") is a real answer.
  const { data: confirmReady, error: confirmErr } = await supabase
    .from('csr2_jobs')
    .select('*')
    .eq('status', 'awaiting_account_confirm')
    .not('account_confirmed', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (confirmErr) {
    console.error('[csr2/worker/claim]', confirmErr.message)
    return Response.json({ error: confirmErr.message }, { status: 500 })
  }

  if (confirmReady) {
    const { error: claimErr } = await supabase
      .from('csr2_jobs')
      .update({ account_confirmed: null, updated_at: new Date().toISOString() })
      .eq('id', confirmReady.id)
      .eq('status', 'awaiting_account_confirm')
    if (claimErr) {
      console.error('[csr2/worker/claim]', claimErr.message)
      return Response.json({ error: claimErr.message }, { status: 500 })
    }
    return Response.json({ job: { ...confirmReady, pack: await resolvePack(confirmReady.code_id) } })
  }

  return Response.json({ job: null })
}
