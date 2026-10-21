import { supabase } from '../../../lib/supabase'
import { isAdminAuthed } from '../../../lib/requireAdmin'
import { generateCsr2Code, hashCsr2Code } from '../../../lib/csr2Codes'

// Admin-only: /api/csr2 is public in middleware.js for the customer redeem flow,
// so this route checks auth itself (a logged-in session, or the AIO Tool's
// CSR2_ADMIN_TOKEN) rather than relying on middleware.

export async function GET(request) {
  if (!(await isAdminAuthed(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const packName = new URL(request.url).searchParams.get('packName')
  let query = supabase
    .from('csr2_codes')
    .select('id, pack_name, plaintext_code, created_at, used_at')
    .order('created_at', { ascending: false })
  if (packName) query = query.eq('pack_name', packName)

  const { data, error } = await query
  if (error) {
    console.error('[csr2/codes GET]', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ ok: true, codes: data })
}

export async function POST(request) {
  if (!(await isAdminAuthed(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

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

  // Codes are short (5 chars, ~33M possible) — a hash collision against an
  // existing code is rare but not negligible over the product's lifetime, so
  // each insert retries with a fresh code on a unique-constraint hit instead
  // of failing the whole batch.
  const codes = []
  for (let i = 0; i < n; i++) {
    let inserted = false
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const code = generateCsr2Code()
      const { error } = await supabase
        .from('csr2_codes')
        .insert({ code_hash: hashCsr2Code(code), plaintext_code: code, pack_name: packName })
      if (!error) { codes.push(code); inserted = true }
      else if (error.code !== '23505') { // not a unique-violation — a real failure
        console.error('[csr2/codes POST]', error.message)
        return Response.json({ error: error.message, generatedSoFar: codes }, { status: 500 })
      }
    }
    if (!inserted) {
      return Response.json({ error: 'Could not generate a unique code after several attempts', generatedSoFar: codes }, { status: 500 })
    }
  }

  // Plaintext is also persisted (plaintext_code) so the AIO Tool's Codes view
  // can show/copy still-unredeemed codes later — see migration 004 for the tradeoff.
  return Response.json({ ok: true, packName, codes })
}
