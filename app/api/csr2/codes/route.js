import { supabase } from '../../../lib/supabase'
import { getSessionUser } from '../../../lib/requireAdmin'
import { generateCsr2Code, hashCsr2Code } from '../../../lib/csr2Codes'

// Admin-only: /api/csr2 is public in middleware.js for the customer redeem flow,
// so this route checks the session itself rather than relying on middleware.
export async function POST(request) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { packName, count } = body
  if (!packName) return Response.json({ error: 'Missing packName' }, { status: 400 })
  const n = Number(count) || 1
  if (n < 1 || n > 500) return Response.json({ error: 'count must be between 1 and 500' }, { status: 400 })

  const { data: pack, error: packErr } = await supabase
    .from('csr2_packs')
    .select('name')
    .eq('name', packName)
    .single()
  if (packErr || !pack) return Response.json({ error: 'Pack not found: ' + packName }, { status: 404 })

  const codes = []
  const rows = []
  for (let i = 0; i < n; i++) {
    const code = generateCsr2Code()
    codes.push(code)
    rows.push({ code_hash: hashCsr2Code(code), pack_name: packName })
  }

  const { error } = await supabase.from('csr2_codes').insert(rows)
  if (error) {
    console.error('[csr2/codes POST]', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Plaintext codes are returned exactly once — only the hash is ever persisted.
  return Response.json({ ok: true, packName, codes })
}
