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
  return pack || null
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

  return Response.json({ job: null })
}
