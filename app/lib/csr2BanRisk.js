// Ported from CSR2_Level_Caps.xlsx — formulas cited by sheet + cell so this can be
// re-synced deliberately if the spreadsheet changes. Do not re-derive these numbers.
import { getLevelCaps } from './csr2LevelCaps'

export const RESOURCE_KEYS = [
  'cash', 'gold', 'bronzeKey', 'silverKey', 'goldKey',
  'greenToken', 'blueToken', 'redToken', 'yellowToken', 'maxCars',
]

// 'Ban Risk Calculator'!E4 — IF(level<=100, 9, 4). 9 -> 10x ceiling, 4 -> 5x ceiling.
export function banCeilingDenom(level) {
  return level <= 100 ? 9 : 4
}

// 'Ban Risk Calculator'!B9:C11 — 3-point decay curve (days since last change -> multiplier
// retained). Default anchors: day 0 = full risk, day 2 = ~1/3, day 4+ = none. Flat outside.
const DECAY_ANCHORS = [[0, 1], [2, 0.3333], [4, 0]]

export function decay(daysSinceLastChange) {
  const [[d0, m0], [d1, m1], [d2, m2]] = DECAY_ANCHORS
  if (daysSinceLastChange <= d0) return m0
  if (daysSinceLastChange >= d2) return m2
  if (daysSinceLastChange <= d1) return m0 + (m1 - m0) * (daysSinceLastChange - d0) / (d1 - d0)
  return m1 + (m2 - m1) * (daysSinceLastChange - d1) / (d2 - d1)
}

// 'Ban Risk Calculator'!D16 — IF(cap=0, amount>0 ? 999 : 0, amount/cap).
function ratio(amount, cap) {
  if (cap === 0) return amount > 0 ? 999 : 0
  return amount / cap
}

// 'Ban Risk Calculator'!E16 — IF(ratio<=1,0, IF(ratio>=denom+1,1, (ratio-1)/denom)).
function rawRiskFromRatio(ratioVal, denom) {
  if (ratioVal <= 1) return 0
  if (ratioVal >= denom + 1) return 1
  return (ratioVal - 1) / denom
}

// 'Ban Risk Calculator'!F16 — >0.9 Ban Guaranteed, >0.6 High, >0.3 Moderate, >0.2 Low, else Safe.
export function riskTier(risk) {
  if (risk > 0.9) return 'BAN GUARANTEED'
  if (risk > 0.6) return 'HIGH RISK'
  if (risk > 0.3) return 'MODERATE RISK'
  if (risk > 0.2) return 'LOW RISK'
  return 'SAFE'
}

function rawRisk(resource, amount, cap, denom) {
  // 'Ban Risk Calculator'!E25 — Max Cars gets an automatic 100% above 1,300 regardless of ratio.
  if (resource === 'maxCars' && amount > 1300) return 1
  return rawRiskFromRatio(ratio(amount, cap), denom)
}

// 'Ban Risk Calculator' sheet, full tab: per-resource + overall (worst single flag) risk,
// both raw ("if done today") and decay-adjusted.
export function computeRisk(level, amounts, daysSinceLastChange = 1) {
  const caps = getLevelCaps(level)
  const denom = banCeilingDenom(level)
  const decayMult = decay(daysSinceLastChange)
  const perResource = {}
  let overallRaw = 0
  let overallAdjusted = 0
  for (const key of RESOURCE_KEYS) {
    const amount = amounts[key] || 0
    const cap = caps[key]
    const raw = rawRisk(key, amount, cap, denom)
    const adjusted = raw * decayMult
    perResource[key] = {
      amount, cap, rawRisk: raw, rawTier: riskTier(raw),
      adjustedRisk: adjusted, adjustedTier: riskTier(adjusted),
    }
    if (raw > overallRaw) overallRaw = raw
    if (adjusted > overallAdjusted) overallAdjusted = adjusted
  }
  return {
    perResource,
    overall: { raw: overallRaw, rawTier: riskTier(overallRaw), adjusted: overallAdjusted, adjustedTier: riskTier(overallAdjusted) },
  }
}

// 'Safe Delivery Planner' sheet: how much of a desired/claimed pack can be delivered right
// now at a given risk tolerance (0 = stay at the clean cap).
export function planSafeDelivery(level, desiredAmounts, riskTolerance = 0) {
  const caps = getLevelCaps(level)
  const denom = banCeilingDenom(level)
  const perResource = {}
  let flatPercentage = 1
  for (const key of RESOURCE_KEYS) {
    const desired = desiredAmounts[key] || 0
    const cap = caps[key]
    const capAtRisk = cap * (1 + denom * riskTolerance)
    let safe = Math.min(desired, capAtRisk)
    if (key === 'maxCars') safe = Math.min(safe, 1300) // hard roster ceiling regardless of tolerance
    const resultingRisk = rawRisk(key, safe, cap, denom)
    const fraction = desired === 0 ? 1 : safe / desired
    perResource[key] = {
      desired, cap, capAtRisk, safeDeliverable: safe,
      resultingRisk, resultingTier: riskTier(resultingRisk), fractionDelivered: fraction,
    }
    if (fraction < flatPercentage) flatPercentage = fraction
  }
  return { perResource, flatPercentage }
}

// 'Redemption Tracker' sheet: one installment of a multi-event delivery. `ledger` is the
// per-resource { cumulativeDelivered, remainingClaimed } carried from the previous call (or
// { cumulativeDelivered: 0, remainingClaimed: <full claim> } for the first one). Backs the
// "remaining balance, redeemable later" mechanic (safe-mode half, free-unban hold-back,
// combo-pack refill tiers).
export function applyRedemption(level, riskTolerance, ledger) {
  const caps = getLevelCaps(level)
  const denom = banCeilingDenom(level)
  const next = {}
  for (const key of RESOURCE_KEYS) {
    const state = ledger[key] || { cumulativeDelivered: 0, remainingClaimed: 0 }
    const cap = caps[key]
    const capAtRisk = cap * (1 + denom * riskTolerance)
    const ceiling = key === 'maxCars' ? Math.min(capAtRisk, 1300) : capAtRisk
    const deliveredThisRound = Math.min(state.remainingClaimed, Math.max(0, ceiling - state.cumulativeDelivered))
    next[key] = {
      cumulativeDelivered: state.cumulativeDelivered + deliveredThisRound,
      remainingClaimed: state.remainingClaimed - deliveredThisRound,
      deliveredThisRound,
    }
  }
  return next
}

// 'Next Edit Planner' sheet: the "decay-adjusted Combined Risk %" shown for repeat
// redemptions on the same code — a risk event doesn't fully clear until the decay curve
// says so, cascading forward via this MAX chain instead of resetting between redemptions.
export function combinedRisk(freshRiskNow, priorCombinedRisk, daysSincePrior) {
  return Math.max(freshRiskNow, priorCombinedRisk * decay(daysSincePrior))
}
