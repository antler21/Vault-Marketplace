import { supabase } from './supabase'
import { computeRisk, planSafeDelivery, combinedRisk, riskTier } from './csr2BanRisk'

// Maps a pack's currency keys (app/csr2-redeem/page.js's CURR_LABELS) onto the
// ban-risk model's resource keys (app/lib/csr2LevelCaps.js). "fuel" has no ban-risk
// counterpart in the spreadsheet and is deliberately left unscored.
export const PACK_TO_RESOURCE = {
  cash: 'cash', gold: 'gold',
  bronzeKeys: 'bronzeKey', silverKeys: 'silverKey', goldKeys: 'goldKey',
  fusionGreen: 'greenToken', fusionBlue: 'blueToken', fusionRed: 'redToken', fusionYellow: 'yellowToken',
}

export function packToResourceAmounts(pack, carSelection) {
  const amounts = {}
  const currencies = pack?.data?.currencies || {}
  for (const [packKey, resourceKey] of Object.entries(PACK_TO_RESOURCE)) {
    if (currencies[packKey]) amounts[resourceKey] = currencies[packKey]
  }
  const cars = pack?.data?.cars
  if (cars?.carMode === 'random') amounts.maxCars = cars.count || 0
  else if (cars?.carMode === 'specific') amounts.maxCars = Array.isArray(carSelection?.cars) ? carSelection.cars.length : 0
  // carMode === 'all' has no fixed count to score against — left out deliberately.
  // Combo packs (pack.data.isCombo) have no top-level `currencies` at all — each
  // stage is its own pack, and sizing a ban-risk plan across a whole combo chain
  // isn't handled yet (see csr2_worker.py's decide_delivery_size). Returns {} here,
  // which planSafeDelivery/computeRisk both treat as "nothing to score."
  return amounts
}

// level/desired/plan/repeat used by the buyer-facing risk-decision screen; fullDesired
// is the pack's true claimed amount (pre-safe-mode-halving) so the worker can compute
// the ledger's remaining-balance correctly once it knows what was actually delivered.
export async function buildRiskPlan(job) {
  const level = Number(job.account_confirm_data?.pllv) || 1
  const { data: codeRow } = await supabase.from('csr2_codes').select('pack_name').eq('id', job.code_id).single()
  const { data: pack } = await supabase.from('csr2_packs').select('data').eq('name', codeRow?.pack_name).maybeSingle()
  const fullDesired = packToResourceAmounts(pack, job.car_selection)
  // Safe mode (spec §8) halves currencies before ban-risk sizing even looks at them —
  // the two mechanisms compose, they don't compete.
  const desired = job.safe_mode
    ? Object.fromEntries(Object.entries(fullDesired).map(([k, v]) => [k, v / 2]))
    : fullDesired
  const plan = planSafeDelivery(level, desired, 0)

  const { data: lastEntry } = await supabase
    .from('csr2_code_redemptions')
    .select('redeemed_at')
    .eq('code_id', job.code_id)
    .order('redeemed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let repeat = null
  if (lastEntry) {
    const daysSinceLastRedemption = (Date.now() - new Date(lastEntry.redeemed_at).getTime()) / 86400000
    // 999 days => no decay damping on THIS delivery's own fresh risk reading.
    const freshNow = computeRisk(level, desired, 999).overall.raw
    // Prior severity isn't tracked per-row yet, so the carryover term conservatively
    // assumes the worst (1) rather than guessing a lower number.
    const risk = combinedRisk(freshNow, 1, daysSinceLastRedemption)
    repeat = { daysSinceLastRedemption, combinedRisk: risk, combinedTier: riskTier(risk) }
  }

  return { level, fullDesired, desired, safeMode: !!job.safe_mode, plan, repeat }
}
