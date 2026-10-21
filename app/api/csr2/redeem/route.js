import { supabase } from '../../../lib/supabase'
import { hashCsr2Code } from '../../../lib/csr2Codes'
import { checkRedeemRateLimit, recordRedeemAttempt, getClientIp } from '../../../lib/csr2RateLimit'

export async function POST(request) {
  const ip = getClientIp(request)
  const { allowed } = await checkRedeemRateLimit(ip)
  if (!allowed) {
    return Response.json({ error: 'Too many attempts. Please wait a minute and try again.' }, { status: 429 })
  }

  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const code = (body.code || '').trim()
  if (!code) return Response.json({ error: 'Missing code' }, { status: 400 })

  // Every non-success path below counts as a "failed guess" for the global
  // brute-force circuit breaker — including "already used", since confirming
  // a code exists (vs. a flat 404) is itself information a guesser can use.
  const codeHash = hashCsr2Code(code)
  const { data: codeRow, error: lookupErr } = await supabase
    .from('csr2_codes')
    .select('id, pack_name, used_at')
    .eq('code_hash', codeHash)
    .single()

  if (lookupErr || !codeRow) {
    await recordRedeemAttempt(ip, false)
    return Response.json({ error: 'Invalid code' }, { status: 404 })
  }
  if (codeRow.used_at) {
    await recordRedeemAttempt(ip, false)
    return Response.json({ error: 'This code has already been used' }, { status: 409 })
  }

  // A single UPDATE...WHERE used_at IS NULL is atomic in Postgres — no separate
  // transaction needed, and it closes the race if the same code is redeemed twice at once.
  const { data: claimed, error: claimErr } = await supabase
    .from('csr2_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', codeRow.id)
    .is('used_at', null)
    .select('id, pack_name')
    .single()

  if (claimErr || !claimed) {
    await recordRedeemAttempt(ip, false)
    return Response.json({ error: 'This code has already been used' }, { status: 409 })
  }

  const { data: pack, error: packErr } = await supabase
    .from('csr2_packs')
    .select('name, data')
    .eq('name', claimed.pack_name)
    .single()

  if (packErr || !pack) {
    console.error('[csr2/redeem] pack missing for redeemed code', claimed.id)
    await recordRedeemAttempt(ip, false)
    return Response.json({ error: 'Pack configuration missing — contact support' }, { status: 500 })
  }

  await recordRedeemAttempt(ip, true)
  return Response.json({ ok: true, codeId: claimed.id, pack })
}
