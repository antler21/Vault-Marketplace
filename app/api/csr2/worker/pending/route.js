import { supabase } from '../../../../lib/supabase'

// Accepts either the worker token or the AIO Tool's admin token — this route
// is read-only (no mutation, nothing sensitive beyond a boolean), and the tool
// only has the admin token configured, not the worker token. Unlike claim()/
// jobs PATCH, there's no meaningful extra capability being shared by accepting both here.
function isWorkerAuthed(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return false
  return token === process.env.CSR2_WORKER_TOKEN || token === process.env.CSR2_ADMIN_TOKEN
}

// Read-only mirror of claim()'s two buckets — no .update(), so the AIO Tool can
// poll this to decide whether the worker needs to be running at all, without
// claim()'s side effects (which flip status / null out credentials and would
// be wrong to trigger just to check "is there anything to do").
export async function GET(request) {
  if (!isWorkerAuthed(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { count: credsCount, error: credsErr } = await supabase
    .from('csr2_jobs')
    .select('*', { count: 'exact', head: true })
    .in('status', ['awaiting_credentials', 'bad_password'])
    .not('password_enc', 'is', null)
  if (credsErr) return Response.json({ error: credsErr.message }, { status: 500 })
  if (credsCount > 0) return Response.json({ pending: true })

  const { count: twofaCount, error: twofaErr } = await supabase
    .from('csr2_jobs')
    .select('*', { count: 'exact', head: true })
    .in('status', ['awaiting_2fa', 'bad_code'])
    .not('twofa_code', 'is', null)
  if (twofaErr) return Response.json({ error: twofaErr.message }, { status: 500 })

  return Response.json({ pending: twofaCount > 0 })
}
