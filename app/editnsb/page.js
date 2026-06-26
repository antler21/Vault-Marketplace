'use client'
import { useState, useRef, useCallback } from 'react'

const BG     = '#0f0f0f'
const SURF   = '#1a1a1a'
const SURF2  = '#222222'
const BORDER = '#2a2a2a'
const ACCENT = '#7E6551'
const TEXT   = '#FDF4DC'
const MUTED  = '#a08570'
const GREEN  = '#4caf50'
const RED    = '#e05252'
const GOLD   = '#e5c040'
const PURPLE = '#b06cf0'
const LBLUE  = '#4fc3f7'

const CURR_DEFS = [
  { key: 'cash',         label: 'Cash',          emoji: '💵' },
  { key: 'gold',         label: 'Gold',          emoji: '🪙' },
  { key: 'bronzeKeys',   label: 'Bronze Keys',   emoji: '🔑' },
  { key: 'silverKeys',   label: 'Silver Keys',   emoji: '🗝️' },
  { key: 'goldKeys',     label: 'Gold Keys',     emoji: '✨' },
  { key: 'fuel',         label: 'Fuel',          emoji: '⛽' },
  { key: 'fusionGreen',  label: 'Green Tokens',  emoji: '🟢' },
  { key: 'fusionBlue',   label: 'Blue Tokens',   emoji: '🔵' },
  { key: 'fusionRed',    label: 'Red Tokens',    emoji: '🔴' },
  { key: 'fusionYellow', label: 'Yellow Tokens', emoji: '🟡' },
]

const TABS = [
  { key: 'currency', label: '💰 Currency' },
  { key: 'legends',  label: '🏆 Legends' },
  { key: 'fusions',  label: '🧪 Fusions' },
  { key: 'stage6',   label: '⭐ Stage 6' },
  { key: 'garage',   label: '🚗 Garage' },
]

function fmtN(n) { return n == null ? '0' : Number(n).toLocaleString() }

// ─── Input ─────────────────────────────────────────────────────────────────────
function NumInput({ value, onChange, placeholder }) {
  return (
    <input
      type="number"
      min="0"
      value={value ?? ''}
      placeholder={placeholder ?? '0'}
      onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      style={{
        background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 6,
        color: TEXT, padding: '7px 10px', fontSize: 13, width: '100%',
        boxSizing: 'border-box', outline: 'none',
      }}
    />
  )
}

// ─── Currency Tab ──────────────────────────────────────────────────────────────
function CurrencyTab({ currency, setCurrency }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
      {CURR_DEFS.map(({ key, label, emoji }) => (
        <div key={key} style={{ background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 5 }}>{emoji} {label}</div>
          <NumInput value={currency[key] ?? 0} onChange={v => setCurrency(p => ({ ...p, [key]: v === '' ? 0 : v }))} />
        </div>
      ))}
    </div>
  )
}

// ─── Legends Tab ───────────────────────────────────────────────────────────────
function LegendsTab({ legends, setLegends, allLegends }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
        Set amount for each legend. Leave at 0 to not include it.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {allLegends.map(({ crdb, name, maxAmount }) => {
          const owned = (legends[crdb] || 0) > 0
          return (
            <div key={crdb} style={{
              background: owned ? '#1a2a1a' : SURF2,
              border: `1px solid ${owned ? '#3a5a3a' : BORDER}`,
              borderRadius: 8, padding: 10,
            }}>
              <div style={{ fontSize: 12, color: owned ? GREEN : TEXT, marginBottom: 4, fontWeight: owned ? 600 : 400 }}>
                {name}
              </div>
              <div style={{ fontSize: 10, color: MUTED, marginBottom: 6 }}>max: {fmtN(maxAmount)}</div>
              <NumInput
                value={legends[crdb] ?? 0}
                onChange={v => setLegends(p => ({ ...p, [crdb]: v === '' ? 0 : v }))}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Fusions Tab ───────────────────────────────────────────────────────────────
function FusionsTab({ fusions, setFusions, fusionsAll, setFusionsAll, ownedFusions }) {
  return (
    <div>
      {/* Add All section */}
      <div style={{ background: '#1a1f1a', border: `1px solid #2a3f2a`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, marginBottom: 8 }}>⚡ Add All Fusions</div>
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 10 }}>
          Overwrites ALL fusion brands from the database with this amount. Leave blank to edit individually below.
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <NumInput
              value={fusionsAll ?? ''}
              placeholder="amount (e.g. 9999)"
              onChange={v => setFusionsAll(v === '' ? null : v)}
            />
          </div>
          {fusionsAll != null && (
            <button
              onClick={() => setFusionsAll(null)}
              style={{ background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 6, color: MUTED, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}
            >
              Clear
            </button>
          )}
        </div>
        {fusionsAll != null && (
          <div style={{ fontSize: 11, color: GREEN, marginTop: 8 }}>
            ✓ Add All active — all fusion brands will be set to {fmtN(fusionsAll)}
          </div>
        )}
      </div>

      {/* Individual fusions */}
      {ownedFusions.length === 0 ? (
        <div style={{ color: MUTED, fontSize: 13 }}>No fusion brands found in save.</div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>
            Owned brands — edit amounts individually (ignored if Add All is active)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {ownedFusions.map(({ upma }) => (
              <div key={upma} style={{ background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 6, wordBreak: 'break-all' }}>{upma}</div>
                <NumInput
                  value={fusions[upma] ?? 0}
                  onChange={v => setFusions(p => ({ ...p, [upma]: v === '' ? 0 : v }))}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stage 6 Tab ───────────────────────────────────────────────────────────────
function Stage6Tab({ stage6, setStage6, s6All, setS6All, ownedS6, s6CarList }) {
  const getCarInfo = (esdb) => s6CarList.find(c => c.esdb === esdb)

  const typeBadge = (type) => {
    if (type === 'gold')    return <span style={{ fontSize: 9, color: GOLD,   marginLeft: 4 }}>★ Gold</span>
    if (type === 'purple')  return <span style={{ fontSize: 9, color: PURPLE, marginLeft: 4 }}>★ Purple</span>
    if (type === 'legends') return <span style={{ fontSize: 9, color: LBLUE,  marginLeft: 4 }}>👑 Legends</span>
    return null
  }

  return (
    <div>
      {/* Add All */}
      <div style={{ background: '#1a1f1a', border: `1px solid #2a3f2a`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, marginBottom: 8 }}>⚡ Add All Stage 6</div>
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 10 }}>
          Replaces ALL stage 6 upgrades in the save with this amount. Leave blank to edit individually below.
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <NumInput
              value={s6All ?? ''}
              placeholder="amount (e.g. 500)"
              onChange={v => setS6All(v === '' ? null : v)}
            />
          </div>
          {s6All != null && (
            <button
              onClick={() => setS6All(null)}
              style={{ background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 6, color: MUTED, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}
            >
              Clear
            </button>
          )}
        </div>
        {s6All != null && (
          <div style={{ fontSize: 11, color: GREEN, marginTop: 8 }}>
            ✓ Add All active — all stage 6 upgrades will be set to {fmtN(s6All)}
          </div>
        )}
      </div>

      {/* Individual cars */}
      {ownedS6.length === 0 ? (
        <div style={{ color: MUTED, fontSize: 13 }}>No stage 6 upgrades found in save.</div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>
            {ownedS6.length} car(s) with stage 6 upgrades — set to 0 to remove
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {ownedS6.map(({ esdb }) => {
              const info = getCarInfo(esdb)
              const isRemoved = (stage6[esdb] ?? 0) === 0 || String(stage6[esdb]) === '0'
              return (
                <div key={esdb} style={{
                  background: isRemoved ? '#1f1a1a' : SURF2,
                  border: `1px solid ${isRemoved ? '#3f2a2a' : BORDER}`,
                  borderRadius: 8, padding: 10,
                  opacity: s6All != null ? 0.5 : 1,
                }}>
                  <div style={{ fontSize: 11, color: TEXT, marginBottom: 2, wordBreak: 'break-word' }}>
                    {info ? info.name : esdb}
                    {info && typeBadge(info.type)}
                  </div>
                  {isRemoved && <div style={{ fontSize: 10, color: RED, marginBottom: 4 }}>will be removed</div>}
                  <NumInput
                    value={stage6[esdb] ?? 0}
                    onChange={v => setStage6(p => ({ ...p, [esdb]: v === '' ? 0 : v }))}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Garage Tab ────────────────────────────────────────────────────────────────
function GarageTab({ ownedCars, garageDeleted, setGarageDeleted }) {
  const deletedUnids = new Set(garageDeleted.map(d => d.unid))

  function toggleDelete(unid) {
    setGarageDeleted(prev => {
      if (deletedUnids.has(unid)) return prev.filter(d => d.unid !== unid)
      return [...prev, { unid }]
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: TEXT }}>
          {ownedCars.length} car(s) — {garageDeleted.length > 0 ? <span style={{ color: RED }}>{garageDeleted.length} marked for deletion</span> : 'none marked'}
        </div>
        {garageDeleted.length > 0 && (
          <button
            onClick={() => setGarageDeleted([])}
            style={{ background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 6, color: MUTED, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}
          >
            Clear All
          </button>
        )}
      </div>
      {ownedCars.length === 0 ? (
        <div style={{ color: MUTED, fontSize: 13 }}>No cars found in save.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ownedCars.map(({ crdb, unid }) => {
            const marked = deletedUnids.has(unid)
            return (
              <label key={unid} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: marked ? '#1f1a1a' : SURF2,
                border: `1px solid ${marked ? '#3f2a2a' : BORDER}`,
                borderRadius: 8, padding: '9px 12px', cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={marked}
                  onChange={() => toggleDelete(unid)}
                  style={{ width: 16, height: 16, accentColor: RED, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: marked ? RED : TEXT, wordBreak: 'break-word', textDecoration: marked ? 'line-through' : 'none' }}>
                    {crdb}
                  </div>
                  <div style={{ fontSize: 10, color: MUTED }}>unid: {unid}</div>
                </div>
                {marked && <span style={{ fontSize: 10, color: RED, flexShrink: 0 }}>DELETE</span>}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function EditNsbPage() {
  const [parsed, setParsed]   = useState(null)
  const [error, setError]     = useState(null)
  const [parsing, setParsing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyMsg, setApplyMsg] = useState(null)
  const [tab, setTab]         = useState('currency')
  const [dragging, setDragging] = useState(false)
  const fileRef   = useRef(null)
  const inputRef  = useRef(null)

  // Edit state
  const [currency, setCurrency]         = useState({})
  const [legends, setLegends]           = useState({})
  const [fusions, setFusions]           = useState({})
  const [fusionsAll, setFusionsAll]     = useState(null)
  const [stage6, setStage6]             = useState({})
  const [s6All, setS6All]               = useState(null)
  const [garageDeleted, setGarageDeleted] = useState([])
  const [s6CarList]                     = useState([])

  const allLegends = parsed ? [
    ...parsed.legends.owned.map(o => ({ crdb: o.crdb, name: o.name, maxAmount: o.maxAmount })),
    ...parsed.legends.available,
  ] : []

  async function handleFile(file) {
    if (!file) return
    fileRef.current = file
    setParsing(true)
    setError(null)
    setApplyMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/nsb/read', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Init currency
      const c = {}; CURR_DEFS.forEach(({ key }) => { c[key] = data.currencies[key] ?? 0 }); setCurrency(c)
      // Init legends — all 26, owned have their amounts, others 0
      const l = {}
      const allL = [...data.legends.owned.map(o => ({ crdb: o.crdb, maxAmount: o.maxAmount })), ...data.legends.available]
      allL.forEach(({ crdb }) => { l[crdb] = 0 })
      data.legends.owned.forEach(({ crdb, amount }) => { l[crdb] = amount })
      setLegends(l)
      // Init fusions
      const f = {}; data.fusions.owned.forEach(({ upma, amount }) => { f[upma] = amount }); setFusions(f)
      // Init stage 6
      const s = {}; data.stage6.owned.forEach(({ esdb, amount }) => { s[esdb] = amount }); setStage6(s)

      setFusionsAll(null); setS6All(null); setGarageDeleted([])
      setParsed(data)
      setTab('currency')
    } catch (e) {
      setError('Parse error: ' + e.message)
    } finally {
      setParsing(false)
    }
  }

  function onDrop(e) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]; if (file) handleFile(file)
  }

  async function handleDownload() {
    if (!fileRef.current || !parsed) return
    setApplying(true); setError(null); setApplyMsg(null)
    try {
      // Re-read file as base64 (chunked to avoid stack overflow on large files)
      const ab = await fileRef.current.arrayBuffer()
      const bytes = new Uint8Array(ab)
      let bin = ''; const chunk = 8192
      for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
      const nsbBase64 = btoa(bin)

      const body = {
        nsbBase64,
        currency,
        legends,
        fusions: fusionsAll != null ? undefined : fusions,
        fusionsAll: fusionsAll != null ? Number(fusionsAll) : undefined,
        stage6: s6All != null ? undefined : stage6,
        s6All: s6All != null ? Number(s6All) : undefined,
        garageDeleted: garageDeleted.length > 0 ? garageDeleted : undefined,
      }

      const res = await fetch('/api/nsb/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Server error ' + res.status)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = fileRef.current.name || 'save.nsb'; a.click()
      URL.revokeObjectURL(url)
      setApplyMsg('Downloaded successfully.')
    } catch (e) {
      setError('Download error: ' + e.message)
    } finally {
      setApplying(false)
    }
  }

  // ── Drop zone ─────────────────────────────────────────────────────────────────
  if (!parsed && !parsing) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, width: '100%' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 6 }}>🎮 NSB Editor</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 24 }}>Upload your CSR2 save file to edit currencies, legends, fusions, stage 6, and garage.</div>

          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? ACCENT : BORDER}`,
              borderRadius: 12, padding: '40px 24px',
              textAlign: 'center', cursor: 'pointer',
              background: dragging ? '#1a1510' : SURF,
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 14, color: TEXT, marginBottom: 6 }}>Drop your NSB file here</div>
            <div style={{ fontSize: 12, color: MUTED }}>or click to browse</div>
            <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) handleFile(f) }} />
          </div>

          {error && (
            <div style={{ marginTop: 16, background: '#1f1010', border: `1px solid #4a2020`, borderRadius: 8, padding: 12, color: RED, fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (parsing) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: MUTED, fontSize: 14 }}>Reading save file...</div>
      </div>
    )
  }

  // ── Editor ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: SURF, borderBottom: `1px solid ${BORDER}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>🎮 NSB Editor</div>
        {parsed.playerName && <div style={{ fontSize: 12, color: MUTED }}>{parsed.playerName}</div>}
        <div style={{ fontSize: 11, color: MUTED, marginLeft: 'auto' }}>{fileRef.current?.name}</div>
        <button
          onClick={() => { setParsed(null); setError(null); setApplyMsg(null); fileRef.current = null }}
          style={{ background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 6, color: MUTED, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}
        >
          Change File
        </button>
      </div>

      {/* Tabs */}
      <div style={{ background: SURF, borderBottom: `1px solid ${BORDER}`, display: 'flex', overflowX: 'auto', padding: '0 8px' }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              background: 'none', border: 'none', padding: '12px 14px', fontSize: 13, cursor: 'pointer',
              color: tab === key ? TEXT : MUTED, fontWeight: tab === key ? 700 : 400,
              borderBottom: `2px solid ${tab === key ? ACCENT : 'transparent'}`,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: '20px 16px', maxWidth: 900, margin: '0 auto' }}>
        {tab === 'currency' && <CurrencyTab currency={currency} setCurrency={setCurrency} />}
        {tab === 'legends'  && <LegendsTab  legends={legends} setLegends={setLegends} allLegends={allLegends} />}
        {tab === 'fusions'  && (
          <FusionsTab
            fusions={fusions} setFusions={setFusions}
            fusionsAll={fusionsAll} setFusionsAll={setFusionsAll}
            ownedFusions={parsed.fusions.owned}
          />
        )}
        {tab === 'stage6' && (
          <Stage6Tab
            stage6={stage6} setStage6={setStage6}
            s6All={s6All} setS6All={setS6All}
            ownedS6={parsed.stage6.owned}
            s6CarList={s6CarList}
          />
        )}
        {tab === 'garage' && (
          <GarageTab
            ownedCars={parsed.garage.ownedCars}
            garageDeleted={garageDeleted}
            setGarageDeleted={setGarageDeleted}
          />
        )}
      </div>

      {/* Sticky footer */}
      <div style={{
        position: 'sticky', bottom: 0, background: SURF, borderTop: `1px solid ${BORDER}`,
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        {error && <div style={{ color: RED, fontSize: 12, flex: 1 }}>{error}</div>}
        {applyMsg && !error && <div style={{ color: GREEN, fontSize: 12, flex: 1 }}>{applyMsg}</div>}
        {!error && !applyMsg && (
          <div style={{ fontSize: 11, color: MUTED, flex: 1 }}>
            {garageDeleted.length > 0 && <span style={{ color: RED }}>{garageDeleted.length} car(s) will be deleted · </span>}
            {fusionsAll != null && <span style={{ color: GREEN }}>Fusions Add All: {fmtN(fusionsAll)} · </span>}
            {s6All != null && <span style={{ color: GREEN }}>Stage 6 Add All: {fmtN(s6All)}</span>}
          </div>
        )}
        <button
          onClick={handleDownload}
          disabled={applying}
          style={{
            background: applying ? SURF2 : ACCENT, color: TEXT, border: 'none',
            borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700,
            cursor: applying ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}
        >
          {applying ? 'Applying...' : '💾 Save & Download'}
        </button>
      </div>
    </div>
  )
}
