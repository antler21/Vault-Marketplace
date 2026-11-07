import { supabase } from './supabase'

// Combo packs (pack.data.isCombo) store only their stage NAMES in data.stages —
// the actual stage contents (currencies/cars/etc) live on each named pack's own
// row. Both the worker-facing claim() and the buyer-facing redeem/confirm screen
// need the real per-stage data, not just the names, so this is shared between them.
export async function resolveComboStages(pack) {
  if (pack?.data?.isCombo && Array.isArray(pack.data.stages) && pack.data.stages.length) {
    const { data: stagePacks } = await supabase.from('csr2_packs').select('name, data').in('name', pack.data.stages)
    const byName = Object.fromEntries((stagePacks || []).map(p => [p.name, p]))
    pack.stages = pack.data.stages.map(n => byName[n]).filter(Boolean)
  }
  return pack
}
