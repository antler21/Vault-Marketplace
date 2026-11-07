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

const inputStyle = { background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '7px 9px', fontSize: 12, color: TEXT, width: '100%', boxSizing: 'border-box' }
const MAX_RESULTS = 40

// One search box per row: type to filter, click a result to pick it — no
// separate search field + dropdown pair, just type-then-click.
function CarSearchRow({ query, onQueryChange, carsList, onPick }) {
  const q = query.toLowerCase().trim()
  const results = q ? carsList.filter(c => carLabel(c).toLowerCase().includes(q)).slice(0, MAX_RESULTS) : []
  return (
    <div>
      <input
        autoFocus
        placeholder="Search for a car…"
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        style={inputStyle}
      />
      {q && (
        <div style={{ marginTop: 4, maxHeight: 160, overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: 6 }}>
          {results.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: 12, color: MUTED }}>No matches</div>
          )}
          {results.map(c => (
            <div
              key={c.brand + '|' + c.model}
              onClick={() => onPick(c)}
              style={{ padding: '7px 10px', fontSize: 12, color: TEXT, cursor: 'pointer', borderBottom: `1px solid ${BORDER}` }}
              onMouseDown={e => e.preventDefault()} // keep the input from losing focus/blurring before the click registers
            >
              {carLabel(c)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
  const [queries, setQueries] = useState({})

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
    setQueries(q => { const n = { ...q }; delete n[idx]; return n })
    commit(next, condition)
  }

  const filledCount = picks.filter(p => p.carKey).length
  const randomCount = Math.max(0, (carsSpec?.count || 0) - filledCount)
  const lastRowEmpty = picks.length > 0 && !picks[picks.length - 1].carKey
  const canAddMore = picks.length < cap && !lastRowEmpty

  if (carsList.length === 0) {
    return (
      <div style={{ marginTop: 16, fontSize: 12, color: MUTED, padding: '10px 12px', background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
        The car list isn&apos;t available right now — you can still continue, cars will be delivered fully random.
      </div>
    )
  }

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
                {!p.carKey ? (
                  <CarSearchRow
                    query={queries[idx] || ''}
                    onQueryChange={v => setQueries({ ...queries, [idx]: v })}
                    carsList={carsList}
                    onPick={c => {
                      updateRow(idx, { carKey: c.brand + '|' + c.model, paintColor: '' })
                      setQueries({ ...queries, [idx]: '' })
                    }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, fontSize: 13, color: TEXT, fontWeight: 600 }}>{carLabel(chosen) || p.carKey}</div>
                    <button
                      onClick={() => updateRow(idx, { carKey: '', paintColor: '' })}
                      style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '3px 9px', color: MUTED, cursor: 'pointer', fontSize: 11 }}
                    >
                      Change
                    </button>
                  </div>
                )}
                {chosen?.colors?.length > 0 && (
                  <select
                    value={p.paintColor}
                    onChange={e => updateRow(idx, { paintColor: e.target.value })}
                    style={{ ...inputStyle, marginTop: 6 }}
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
                    style={{ ...inputStyle, marginTop: 6 }}
                  >
                    <option value="maxed">Maxed</option>
                    <option value="stock">Stock</option>
                  </select>
                )}
                <div style={{ textAlign: 'right', marginTop: 4 }}>
                  <button onClick={() => removeRow(idx)} style={{ background: 'transparent', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}>Remove</button>
                </div>
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
