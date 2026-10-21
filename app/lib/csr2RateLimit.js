import { supabase } from './supabase'

const WINDOW_MS = 60_000
const MAX_PER_IP = 5
// Codes are deliberately short (5 chars, ~33M possible). A per-IP limit alone
// doesn't stop a guesser spread across many IPs/proxies — this caps the TOTAL
// rate of failed guesses across everyone, which bounds brute-force throughput
// regardless of how distributed it is (at 20/min, exhausting the keyspace
// takes ~3 years even split across unlimited IPs).
const MAX_GLOBAL_FAILURES = 20

export function getClientIp(request) {
  const fwd = request.headers.get('x-forwarded-for') || ''
  return fwd.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
}

// Pre-check only — does not record anything. Call recordRedeemAttempt once the
// real outcome (success/fail) of this attempt is known.
export async function checkRedeemRateLimit(ip) {
  const since = new Date(Date.now() - WINDOW_MS).toISOString()

  const { count: ipCount, error: ipErr } = await supabase
    .from('csr2_redeem_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('attempted_at', since)
  if (ipErr) {
    console.error('[csr2RateLimit]', ipErr.message)
    return { allowed: true } // fail open — a DB hiccup shouldn't lock out legitimate buyers
  }
  if ((ipCount || 0) >= MAX_PER_IP) return { allowed: false }

  const { count: globalFailCount, error: globalErr } = await supabase
    .from('csr2_redeem_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('success', false)
    .gte('attempted_at', since)
  if (globalErr) {
    console.error('[csr2RateLimit]', globalErr.message)
    return { allowed: true }
  }
  if ((globalFailCount || 0) >= MAX_GLOBAL_FAILURES) return { allowed: false }

  return { allowed: true }
}

export async function recordRedeemAttempt(ip, success) {
  await supabase.from('csr2_redeem_attempts').insert({ ip, success })
}
