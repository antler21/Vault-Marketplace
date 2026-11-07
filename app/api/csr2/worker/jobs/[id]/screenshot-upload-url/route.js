import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin'

// Real phone screenshots run 5-7MB — too big for a JSON+base64 body through a
// Vercel serverless function (hard ~4.5MB request limit, not configurable).
// So the upload itself never goes through this app at all: the caller (worker
// or test script) gets a short-lived signed Supabase Storage upload URL here,
// PUTs the raw bytes straight to Supabase, then PATCHes /api/csr2/worker/jobs/[id]
// with just the resulting small publicUrl string.
function isWorkerAuthed(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return !!process.env.CSR2_WORKER_TOKEN && token === process.env.CSR2_WORKER_TOKEN
}

const VALID_KINDS = ['gamecenter', 'signin_approval', 'completion']

export async function POST(request, context) {
  if (!isWorkerAuthed(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const kind = body.screenshotKind
  if (!VALID_KINDS.includes(kind)) return Response.json({ error: 'Invalid screenshotKind' }, { status: 400 })
  const ext = body.ext === 'jpg' ? 'jpg' : 'png'

  const path = `${id}/${kind}-${Date.now()}.${ext}`
  const { data, error } = await supabaseAdmin.storage.from('csr2-screenshots').createSignedUploadUrl(path, { upsert: true })
  if (error) {
    console.error('[screenshot-upload-url]', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
  const { data: pub } = supabaseAdmin.storage.from('csr2-screenshots').getPublicUrl(path)

  return Response.json({ signedUrl: data.signedUrl, token: data.token, path: data.path, publicUrl: pub.publicUrl })
}
