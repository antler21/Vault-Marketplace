'use client'
import { useState } from 'react'

const SURF2 = '#222222'
const BORDER = '#2a2a2a'
const TEXT = '#FDF4DC'
const MUTED = '#a08570'
const GREEN = '#4caf50'

function carLabel(c) {
  return `${c.brand} ${c.model}` + (c.unreleased ? ' ⚠️ Unreleased' : '')
}

const inputStyle = { background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 8px', fontSize: 12, color: TEXT }

// Buyer-facing car selection (spec §9). `carsSpec` is the pack's existing
// data.cars contract ({ carMode, count, condition, partial: { count } }) — no new
// pack schema needed, `partial.count` was already "buyer picks N cars," this is
// just the first real UI for it. `condition` stays admin-preset when the pack sets
// one; only asked of the buyer when the pack leaves it open.
export default function CarPicker({ carsSpec, carsList, value, onChange }) {
  const cap = carsSpec?.partial?.count || 0
  const presetCondition = carsSpec?.condition || null
  const [condition, setCondition] = useState(value?.condition || presetCondition || 'maxed')
  const [picks, setPicks] = useState(value?.customPicks || [])
  const [filters, setFilters] = useState({})

  function commit(nextPicks, nextCondition) {
    onChange({ condition: nextCondition, customPicks: nextPicks.filter(p => p.carKey) })
  }

  function updateCondition(c) {
    setCondition(c)
    commit(picks, c)
  }

  function addRow() {
    setPicks([...picks, { carKey: '', condition: 'maxed', paintColor: '' }])
  }

  function updateRow(idx, patch) {
    const next = picks.map((p, i) => (i === idx ? { ...p, ...patch } : p))
    setPicks(next)
    commit(next, condition)
  }

  function removeRow(idx) {
    const next = picks.filter((_, i) => i !== idx)
    setPicks(next)
    commit(next, condition)
  }

  const filledCount = picks.filter(p => p.carKey).length
  const randomCount = Math.max(0, (carsSpec?.count || 0) - filledCount)
  const lastRowEmpty = picks.length > 0 && !picks[picks.length - 1].carKey
  const canAddMore = picks.length < cap && !lastRowEmpty

  return (
    <div style={{ marginTop: 16 }}>
      {!presetCondition && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 6 }}>Car condition</div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED }}>
              <input type="radio" checked={condition === 'maxed'} onChange={() => updateCondition('maxed')} />
              Maxed — fusions + Stage 6 fully applied
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED }}>
              <input type="radio" checked={condition === 'stock'} onChange={() => updateCondition('stock')} />
              Stock — no upgrades
            </label>
          </div>
        </>
      )}

      {cap > 0 && (
        <>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
            {randomCount} car{randomCount !== 1 ? 's' : ''} will be random · you can hand-pick up to {cap}
          </div>
          {picks.map((p, idx) => {
            const chosen = carsList.find(c => c.brand + '|' + c.model === p.carKey)
            return (
              <div key={idx} style={{ marginBottom: 10, padding: '8px 10px', background: SURF2 + '80', borderRadius: 8, border: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    placeholder="Search car…"
                    value={filters[idx] || ''}
                    onChange={e => setFilters({ ...filters, [idx]: e.target.value })}
                    style={{ ...inputStyle, flex: '0 0 110px' }}
                  />
                  <select
                    value={p.carKey}
                    onChange={e => updateRow(idx, { carKey: e.target.value, paintColor: '' })}
                    style={{ ...inputStyle, flex: 1 }}
                  >
                    <option value="">Select a car…</option>
                    {carsList
                      .filter(c => !filters[idx] || carLabel(c).toLowerCase().includes(filters[idx].toLowerCase()))
                      .map(c => (
                        <option key={c.brand + '|' + c.model} value={c.brand + '|' + c.model}>{carLabel(c)}</option>
                      ))}
                  </select>
                  <button onClick={() => removeRow(idx)} style={{ background: 'transparent', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>✕</button>
                </div>
                {chosen?.colors?.length > 0 && (
                  <select
                    value={p.paintColor}
                    onChange={e => updateRow(idx, { paintColor: e.target.value })}
                    style={{ ...inputStyle, width: '100%', marginTop: 6 }}
                  >
                    <option value="">Any paint color</option>
                    {chosen.colors.map(col => (
                      <option key={col.name} value={col.name}>{col.displayName}</option>
                    ))}
                  </select>
                )}
                {chosen && !presetCondition && (
                  <select
                    value={p.condition}
                    onChange={e => updateRow(idx, { condition: e.target.value })}
                    style={{ ...inputStyle, width: '100%', marginTop: 6 }}
                  >
                    <option value="maxed">Maxed</option>
                    <option value="stock">Stock</option>
                  </select>
                )}
              </div>
            )
          })}
          <button
            onClick={addRow}
            disabled={!canAddMore}
            style={{ background: 'transparent', border: `1px dashed ${BORDER}`, borderRadius: 6, padding: '6px 12px', fontSize: 12, color: canAddMore ? GREEN : MUTED, cursor: canAddMore ? 'pointer' : 'default' }}
          >
            + Pick a car
          </button>
        </>
      )}
    </div>
  )
}
