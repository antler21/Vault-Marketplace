import { supabase } from '../../../lib/supabase'
import { generateCsr2Code, hashCsr2Code } from '../../../lib/csr2Codes'

// Used by the fake-worker test script (csr2_fake_worker.py) — creates a
// throwaway, is_test=true code with NO job yet, so you can redeem it through
// the real /csr2-redeem page yourself (pack confirm, car picker, platform,
// account mode, credentials) exactly like a real buyer would. Bearer-token
// auth (CSR2_WORKER_TOKEN) rather than a login session, since this is called
// from a standalone script, not a browser.
function isWorkerAuthed(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return !!process.env.CSR2_WORKER_TOKEN && token === process.env.CSR2_WORKER_TOKEN
}

export async function POST(request) {
  if (!isWorkerAuthed(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const packName = body.packName
  if (!packName) return Response.json({ error: 'Missing packName' }, { status: 400 })

  const { data: pack } = await supabase.from('csr2_packs').select('name').eq('name', packName).maybeSingle()
  if (!pack) return Response.json({ error: 'Pack not found: ' + packName }, { status: 404 })

  const code = generateCsr2Code()
  const { error } = await supabase
    .from('csr2_codes')
    .insert({ code_hash: hashCsr2Code(code), plaintext_code: code, pack_name: packName, status: 'unused', is_test: true })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true, code })
}
