import { supabase } from './supabase'

// A code with any redemption history reverts to 'partial' (still has a public
// remaining-balance context) instead of the clean 'unused' state, when a job
// never reaches 'done' (buyer backs out before an existing account, or the
// worker reports 'error').
export async function revertCodeStatus(codeId) {
  const { count } = await supabase
    .from('csr2_code_redemptions')
    .select('*', { count: 'exact', head: true })
    .eq('code_id', codeId)
  const status = (count || 0) > 0 ? 'partial' : 'unused'
  await supabase.from('csr2_codes').update({ status }).eq('id', codeId)
  return status
}

// A code is fully 'used' once every tracked resource's remaining balance is zero
// (or there was never a ledger row at all, i.e. a plain full-pack delivery).
export function ledgerExhausted(remainingCurrencies) {
  if (!remainingCurrencies) return true
  return Object.values(remainingCurrencies).every(v => !v || v <= 0)
}
