import { supabase } from '../../../../../lib/supabase'

const VALID_STATUSES = [
  'awaiting_credentials', 'logging_in', 'bad_password', 'awaiting_2fa', 'bad_code',
  'launching_game', 'awaiting_save_load', 'editing_save', 'awaiting_relaunch',
  'saving', 'done', 'error',
]

function isWorkerAuthed(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return !!process.env.CSR2_WORKER_TOKEN && token === process.env.CSR2_WORKER_TOKEN
}

export async function PATCH(request, context) {
  if (!isWorkerAuthed(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { status, errorMessage } = body
  if (!VALID_STATUSES.includes(status)) {
    return Response.json({ error: 'Invalid status: ' + status }, { status: 400 })
  }

  const { data: current, error: curErr } = await supabase
    .from('csr2_jobs')
    .select('status')
    .eq('id', id)
    .single()
  if (curErr || !current) return Response.json({ error: 'Job not found' }, { status: 404 })

  const patch = { status, updated_at: new Date().toISOString() }
  // Credential/2FA fields are never kept past the point the worker has consumed them.
  if (status === 'logging_in') patch.password_enc = null
  if (current.status === 'awaiting_2fa' && status !== 'awaiting_2fa') patch.twofa_code = null
  patch.error_message = status === 'error' ? (errorMessage || 'Unknown error') : null

  const { error } = await supabase.from('csr2_jobs').update(patch).eq('id', id)
  if (error) {
    console.error('[csr2/worker/jobs PATCH]', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ ok: true })
}
