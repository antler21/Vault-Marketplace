'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'

// ─── Colours (match tool CSS vars) ─────────────────────────────────────────────
const C = {
  bg:     '#0f0f0f', surf:   '#1a1a1a', surf2:  '#222222',
  border: '#2a2a2a', accent: '#7E6551', text:   '#FDF4DC',
  muted:  '#a08570', green:  '#4caf50', red:    '#e05252',
  blue:   '#2196F3', gold:   '#e5c040', purple: '#b06cf0', lblue: '#4fc3f7',
}

const LEGEND_CARS = [
  { crdb: 'Ferrari_250GTOClassic_1962',            name: 'Ferrari 250 GTO',                amount: 14800 },
  { crdb: 'AstonMartin_DB5Classic_1964',            name: 'Aston Martin DB5',               amount: 17400 },
  { crdb: 'MercedesBenz_300SLClassic_1954',         name: 'Mercedes-Benz 300SL',            amount: 17400 },
  { crdb: 'Shelby_Cobra427SCClassic_1965',          name: 'Shelby Cobra',                   amount: 25800 },
  { crdb: 'Chevrolet_CorvetteZR1Classic_1970',      name: 'Chevy Corvette C3',              amount: 25800 },
  { crdb: 'Pontiac_GTOTheJudgeClassic_1969',        name: 'Pontiac GTO',                    amount: 29600 },
  { crdb: 'Honda_NSXRClassic_1992',                 name: 'Honda NSX-R',                    amount: 36000 },
  { crdb: 'Plymouth_HemiCudaClassic_1971',          name: 'Plymouth Hemi Cuda',             amount: 38200 },
  { crdb: 'Ford_GT40MkII_1966',                     name: 'Ford GT40',                      amount: 40400 },
  { crdb: 'Lamborghini_CountachClassic_1988',       name: 'Lamborghini Countach',           amount: 40400 },
  { crdb: 'Porsche_CarreraGTClassic_2003',          name: 'Porsche Carrera GT',             amount: 50000 },
  { crdb: 'Lamborghini_MiuraSVLPClassic_1971',      name: 'Lamborghini Miura SVL',          amount: 50000 },
  { crdb: 'Bugatti_EB110SSClassic_1992',            name: 'Bugatti EB110',                  amount: 50000 },
  { crdb: 'Jaguar_XJ220Classic_1993',               name: 'Jaguar XJ220',                   amount: 53400 },
  { crdb: 'Ford_MustangShelbyGT350LPClassic_1965',  name: 'Ford Mustang Shelby GT350LP',    amount: 56000 },
  { crdb: 'Saleen_S7Classic_2004',                  name: 'Saleen S7',                      amount: 56400 },
  { crdb: 'Plymouth_SuperbirdLPClassic_1970',       name: 'Plymouth Superbird LP',          amount: 65000 },
  { crdb: 'Porsche_911CarreraRS27LPClassic_1973',   name: 'Porsche 911 Carrera RS27 LP',    amount: 65000 },
  { crdb: 'Datsun_240ZLPClassic_1972',              name: 'Datsun 240Z LP',                 amount: 65000 },
  { crdb: 'Dodge_ChallengerRTLPClassic_1970',       name: 'Dodge Challenger R/T Classic',   amount: 64000 },
  { crdb: 'Chevrolet_CorvetteC1LPClassic_1958',     name: 'Chevrolet Corvette C1',          amount: 70000 },
  { crdb: 'Chevrolet_NovaSSLPClassic_1970',         name: 'Chevy Nova SS Classic',          amount: 70000 },
  { crdb: 'Ford_EscortMk1RS2000LPClassic_1973',     name: 'Ford Escort Mk1 RS2000 Classic', amount: 70000 },
  { crdb: 'Dodge_ViperSR1LPClassic_1995',           name: 'Dodge Viper SR1 LP',             amount: 75000 },
  { crdb: 'Ford_MustangSVTCobraRLPClassic_1993',    name: 'Ford Mustang SVT Cobra R',       amount: 75000 },
  { crdb: 'Porsche_911Turbo930LPClassic_1977',      name: 'Porsche 911 Turbo (930)',        amount: 75000 },
]

function fmtN(n) { return n == null ? '0' : Number(n).toLocaleString() }

// ─── Shared styles (objects, not strings) ──────────────────────────────────────
const BTN_SML  = { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 5, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: C.accent, whiteSpace: 'nowrap' }
const BTN_ICON = { background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }
const SEC_HDR  = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: C.muted }

// ─── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [show, setShow] = useState(false)
  const t = useRef(null)
  const fire = useCallback(() => {
    setShow(true); clearTimeout(t.current)
    t.current = setTimeout(() => setShow(false), 1200)
  }, [])
  return [show, fire]
}

// ─── Number-only input ─────────────────────────────────────────────────────────
function NInput({ value, onChange, style }) {
  return (
    <input type="text" value={value ?? 0}
      onChange={e => onChange(Math.max(0, parseInt(e.target.value.replace(/\D/g,'')) || 0))}
      style={{ ...{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 5, padding: '3px 6px', color: C.text, fontSize: 12, outline: 'none', textAlign: 'right', height: 26, boxSizing: 'border-box' }, ...style }}
    />
  )
}

// ─── Add All banner ────────────────────────────────────────────────────────────
function AddAllBanner({ label, amount, onCancel }) {
  return (
    <div style={{ background: 'rgba(126,101,81,.18)', border: `1px solid ${C.accent}`, borderRadius: 7, padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      <span style={{ flex: 1, fontSize: 12, color: C.text }}>✅ {label} — amount: <strong>{fmtN(amount)}</strong>. Individual edits will be overridden.</span>
      <button onClick={onCancel} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: C.muted }}>Cancel</button>
    </div>
  )
}

// ─── Add All modal ─────────────────────────────────────────────────────────────
function AddAllModal({ title, onConfirm, onClose }) {
  const [amt, setAmt] = useState(500)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, width: 300, maxWidth: '90vw' }}>
        <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Amount per upgrade:</div>
        <input type="text" value={amt} onChange={e => setAmt(Math.max(0, parseInt(e.target.value.replace(/\D/g,'')) || 0))}
          style={{ width: '100%', boxSizing: 'border-box', background: C.surf2, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', color: C.text, fontSize: 14, outline: 'none', marginBottom: 14 }}
          autoFocus onKeyDown={e => { if (e.key === 'Enter') onConfirm(amt) }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: C.surf2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 14px', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onConfirm(amt)} style={{ background: C.accent, border: 'none', borderRadius: 6, padding: '7px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Confirm</button>
        </div>
      </div>
    </div>
  )
}

// ─── Left Panel ────────────────────────────────────────────────────────────────
function LeftPanel({ parsed, currency, legends, garageDeleted, prvr, onEditPrvr, onChangeFile }) {
  const carCount = (parsed?.garage?.carCount || 0) - garageDeleted.length
  const legendCount = Object.keys(legends).length
  const c = currency
  function chip(icon, lbl, val) {
    return (
      <div style={{ flex: 1, background: C.surf, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 4px', textAlign: 'center', minWidth: 0 }}>
        <div style={{ fontSize: 11 }}>{icon}</div>
        <div style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtN(val)}</div>
        <div style={{ fontSize: 8, color: C.muted, textTransform: 'uppercase', letterSpacing: '.3px' }}>{lbl}</div>
      </div>
    )
  }
  const displayPrvr = prvr !== null ? prvr : (parsed?.prvr || '')
  return (
    <div style={{ width: 210, minWidth: 210, padding: '16px 14px', borderRight: `1px solid ${C.border}`, overflowY: 'auto', flexShrink: 0, background: C.surf }}>
      {parsed?.playerName && (
        <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: C.muted, marginBottom: 4 }}>Account Name</div>
          <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-all', lineHeight: 1.3 }}>{parsed.playerName}</div>
        </div>
      )}
      <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: C.muted, marginBottom: 4 }}>Save Version</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, flex: 1, wordBreak: 'break-all', cursor: 'pointer' }} onClick={onEditPrvr}>{displayPrvr || '(none)'}</span>
          <button onClick={onEditPrvr} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 12, padding: '2px 4px', lineHeight: 1, flexShrink: 0 }}>✏</button>
        </div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: C.muted, marginBottom: 8 }}>Account Stats</div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
        {chip('⛽','Fuel', c.fuel||0)}{chip('💵','Cash', c.cash||0)}{chip('🪙','Gold', c.gold||0)}
      </div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
        {chip('🔑','B.Keys', c.bronzeKeys||0)}{chip('🗝️','S.Keys', c.silverKeys||0)}{chip('✨','G.Keys', c.goldKeys||0)}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: C.muted, marginBottom: 5 }}>Elite Tokens</div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
        {[['🟢','GRN',c.fusionGreen||0,'#4caf50'],['🔵','BLU',c.fusionBlue||0,'#2196F3'],['🔴','RED',c.fusionRed||0,'#e05252'],['🟡','YLW',c.fusionYellow||0,'#FFC107']].map(([ic,lb,vl,cl]) => (
          <div key={lb} style={{ flex:1, background: C.surf, border: `1px solid rgba(128,128,128,.2)`, borderRadius: 6, padding: '4px 2px', textAlign: 'center' }}>
            <div style={{ fontSize: 10 }}>{ic}</div>
            <div style={{ fontSize: 10, fontWeight: 700 }}>{fmtN(vl)}</div>
            <div style={{ fontSize: 7, color: cl, textTransform: 'uppercase', letterSpacing: '.3px' }}>{lb}</div>
          </div>
        ))}
      </div>
      <div style={{ height: 1, background: C.border, margin: '8px 0' }}/>
      <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
        {chip('🚗','Cars', carCount)}{chip('⭐','Legends', legendCount)}
      </div>
      <button onClick={onChangeFile} style={{ width:'100%', background:C.surf2, border:`1px solid ${C.border}`, borderRadius:7, padding:'8px 0', color:C.muted, fontSize:12, cursor:'pointer', textAlign:'center' }}>
        📂 Change File
      </button>
    </div>
  )
}

// ─── Currency Tab ──────────────────────────────────────────────────────────────
function CurrencyTab({ currency, setCurrency }) {
  const main = [
    {k:'cash',label:'💵 Cash',unit:'$'},{k:'gold',label:'🪙 Gold',unit:'G'},
    {k:'bronzeKeys',label:'🔑 Bronze Keys',unit:'Bk'},{k:'silverKeys',label:'🗝 Silver Keys',unit:'Sk'},
    {k:'goldKeys',label:'✨ Gold Keys',unit:'Gk'},{k:'fuel',label:'⛽ Fuel',unit:'F'},
  ]
  const tokens = [
    {k:'fusionGreen',label:'Green',dot:'#4caf50'},{k:'fusionBlue',label:'Blue',dot:'#2196F3'},
    {k:'fusionRed',label:'Red',dot:'#e05252'},{k:'fusionYellow',label:'Yellow',dot:'#FFC107'},
  ]
  const INP  = { width:'100%', boxSizing:'border-box', paddingRight:36, background:C.surf2, border:`1px solid ${C.border}`, borderRadius:5, padding:'5px 8px', paddingRight:36, color:C.text, fontSize:13, outline:'none' }
  const UNIT = { position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:11, color:C.muted, pointerEvents:'none' }
  function set(k, v) { setCurrency(p => ({ ...p, [k]: v })) }
  return (
    <div>
      <div style={{ ...SEC_HDR, marginBottom:10 }}>Currencies</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
        {main.map(({k,label,unit}) => (
          <div key={k} style={{ marginBottom:4 }}>
            <label style={{ fontSize:12, color:C.muted, display:'block', marginBottom:4 }}>{label}</label>
            <div style={{ position:'relative' }}>
              <input type="text" value={currency[k]??0} onChange={e=>set(k,Math.max(0,parseInt(e.target.value.replace(/\D/g,''))||0))} style={INP}/>
              <span style={UNIT}>{unit}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ ...SEC_HDR, marginBottom:10 }}>Elite Tokens</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {tokens.map(({k,label,dot}) => (
          <div key={k} style={{ marginBottom:4 }}>
            <label style={{ fontSize:12, color:C.muted, display:'block', marginBottom:4 }}>
              <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:dot, marginRight:5, verticalAlign:'middle' }}/>{label}
            </label>
            <div style={{ position:'relative' }}>
              <input type="text" value={currency[k]??0} onChange={e=>set(k,Math.max(0,parseInt(e.target.value.replace(/\D/g,''))||0))} style={INP}/>
              <span style={UNIT}>Tk</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Legends Tab ───────────────────────────────────────────────────────────────
function LegendsTab({ legends, setLegends, toast }) {
  const ownedSet = new Set(Object.keys(legends))
  const ownedList = LEGEND_CARS.filter(lc => ownedSet.has(lc.crdb))
  const availList = LEGEND_CARS.filter(lc => !ownedSet.has(lc.crdb))
  function add(lc) { setLegends(p => ({ ...p, [lc.crdb]: lc.amount })); toast() }
  function remove(crdb) { setLegends(p => { const n={...p}; delete n[crdb]; return n }) }
  function maxOne(lc) { setLegends(p => ({ ...p, [lc.crdb]: lc.amount })); toast() }
  function maxAll() { setLegends(p => { const n={...p}; for(const lc of LEGEND_CARS){if(n[lc.crdb]!==undefined)n[lc.crdb]=lc.amount}; return n }); toast() }
  function addAll() { setLegends(p => { const n={...p}; for(const lc of LEGEND_CARS){if(!n[lc.crdb])n[lc.crdb]=lc.amount}; return n }); toast() }
  function change(crdb, v) { setLegends(p => ({ ...p, [crdb]: v })); toast() }
  const colStyle = { flex:1, display:'flex', flexDirection:'column', minWidth:0 }
  const hdrRow = { display:'flex', alignItems:'center', gap:8, marginBottom:8, flexShrink:0 }
  return (
    <div style={{ display:'flex', gap:14, flex:1, overflow:'hidden' }}>
      <div style={colStyle}>
        <div style={hdrRow}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:C.muted, flex:1 }}>Owned ({ownedList.length})</div>
          <button onClick={maxAll} style={{ ...BTN_SML }}>Max All</button>
        </div>
        <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', flex:1 }}>
          {ownedList.length===0 && <div style={{ color:C.muted, fontSize:13, padding:'8px 0' }}>None owned. Add from the right.</div>}
          {ownedList.map(lc => (
            <div key={lc.crdb} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background:C.surf2, border:`1px solid ${C.border}`, borderRadius:7, marginBottom:4 }}>
              <span style={{ flex:1, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={lc.name}>{lc.name}</span>
              <NInput value={legends[lc.crdb]||0} onChange={v=>change(lc.crdb,v)} style={{ width:80 }}/>
              <button onClick={()=>maxOne(lc)} style={BTN_SML}>Max</button>
              <button onClick={()=>remove(lc.crdb)} style={BTN_ICON}>×</button>
            </div>
          ))}
        </div>
      </div>
      <div style={colStyle}>
        <div style={hdrRow}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:C.muted, flex:1 }}>Available ({availList.length})</div>
          <button onClick={addAll} style={BTN_SML}>Add All</button>
        </div>
        <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', flex:1 }}>
          {availList.length===0 && <div style={{ color:C.muted, fontSize:13, padding:'8px 0' }}>All legends owned.</div>}
          {availList.map(lc => (
            <div key={lc.crdb} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background:C.surf2, border:`1px solid ${C.border}`, borderRadius:7, marginBottom:4 }}>
              <span style={{ flex:1, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={lc.name}>{lc.name}</span>
              <span style={{ fontSize:10, color:C.muted, whiteSpace:'nowrap', marginRight:4 }}>req. {fmtN(lc.amount)}</span>
              <button onClick={()=>add(lc)} style={BTN_SML}>Add</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FusionsTabWrapper({ fusions, setFusions, fusionsAll, setFusionsAll, ownedFusions, toast, brands, setBrands }) {
  const [modal,      setModal]    = useState(null)
  const [fSyncing,   setFSyncing] = useState(false)
  const [fSyncError, setFSyncErr] = useState(null)

  async function handleFusionSync() {
    setFSyncing(true); setFSyncErr(null)
    try {
      const res = await fetch('/api/nsb/sync-fusion-brands', { method: 'POST' })
      const d = await res.json()
      if (d.error) { setFSyncErr(d.error); return }
      if (Array.isArray(d.brands)) setBrands(d.brands)
    } catch (e) { setFSyncErr(e.message) }
    finally { setFSyncing(false) }
  }

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const sq = search.toLowerCase()
  const bname = u => { const b=(brands||[]).find(x=>x.upma===u); return b?.name||u }
  const ownedUpmas = fusionsAll!=null ? (brands||[]).map(b=>b.upma) : Object.keys(fusions).filter(u=>(fusions[u]||0)>0)
  const filteredOwned = sq ? ownedUpmas.filter(u=>(bname(u)).toLowerCase().includes(sq)) : ownedUpmas
  const filteredBrands = sq ? (brands||[]).filter(b=>(b.name||'').toLowerCase().includes(sq)) : (brands||[])
  const selCount = selected.size
  function toggle(u) { setSelected(p=>{ const n=new Set(p); n.has(u)?n.delete(u):n.add(u); return n }) }
  function addOne(u) { setModal({ title:'Add: '+bname(u), ids:[u] }) }
  function addSelected() { if(!selected.size)return; const ids=[...selected]; setModal({ title:ids.length===1?'Add: '+bname(ids[0]):'Add '+ids.length+' Brands', ids }) }
  function confirmAdd(amt) {
    if (modal.isAll) { setFusionsAll(amt) } else { for(const id of modal.ids) setFusions(p=>({...p,[id]:Math.max(0,(p[id]||0)+amt)})); setSelected(new Set()) }
    setModal(null); toast()
  }
  function remove(u) { setFusions(p=>({...p,[u]:0})) }
  function change(u,v) { setFusions(p=>({...p,[u]:v})); toast() }
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      {modal && <AddAllModal title={modal.title} onConfirm={confirmAdd} onClose={()=>setModal(null)}/>}
      {fusionsAll!=null && <AddAllBanner label="Add All Fusions mode" amount={fusionsAll} onCancel={()=>setFusionsAll(null)}/>}
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10, flexShrink:0 }}>
        <input placeholder="Search brands..." value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:1, background:C.surf2, border:`1px solid ${C.border}`, borderRadius:7, padding:'7px 10px', color:C.text, fontSize:13, outline:'none' }}/>
        {selCount>0 && <button onClick={addSelected} style={{ background:C.accent, border:'none', borderRadius:6, padding:'6px 12px', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>Add Selected ({selCount})</button>}
      </div>
      <div style={{ display:'flex', gap:14, flex:1, overflow:'hidden' }}>
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:C.muted, marginBottom:6, flexShrink:0 }}>Owned ({filteredOwned.length})</div>
          <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:3, flex:1 }}>
            {filteredOwned.length===0 && <div style={{ color:C.muted, fontSize:12 }}>None owned.</div>}
            {filteredOwned.map(u => {
              const amt = fusionsAll!=null ? fusionsAll : (fusions[u]||0)
              return (
                <div key={u} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', background:C.surf2, border:`1px solid ${C.border}`, borderRadius:6 }}>
                  <span style={{ flex:1, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{bname(u)}</span>
                  <NInput value={amt} onChange={v=>change(u,v)} style={{ width:80 }}/>
                  <button onClick={()=>remove(u)} style={BTN_ICON}>×</button>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, flexShrink:0 }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:C.muted, flex:1 }}>All Brands ({filteredBrands.length})</div>
            <button onClick={()=>setModal({title:'Add All Fusions',ids:[],isAll:true})} style={{ height:22, background:C.surf, border:`1px solid ${C.border}`, borderRadius:4, padding:'0 8px', cursor:'pointer', fontSize:11, color:C.accent, whiteSpace:'nowrap' }}>Add All</button>
          </div>
          <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:3, flex:1 }}>
            {brands===null && <div style={{ color:C.muted, fontSize:12 }}>Loading...</div>}
            {brands!==null && brands.length===0 && !sq && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'16px 8px', textAlign:'center' }}>
                <div style={{ fontSize:11, color:C.text, fontWeight:600 }}>Brand list not synced yet</div>
                {fSyncError && <div style={{ fontSize:11, color:C.red }}>{fSyncError}</div>}
                <button onClick={handleFusionSync} disabled={fSyncing} style={{ background:C.accent, border:'none', borderRadius:7, padding:'8px 16px', color:'#fff', fontSize:12, fontWeight:700, cursor:fSyncing?'not-allowed':'pointer', opacity:fSyncing?.7:1 }}>
                  {fSyncing ? '⏳ Syncing...' : '🔄 Sync Brand List'}
                </button>
              </div>
            )}
            {brands!==null && brands.length>0 && filteredBrands.length===0 && <div style={{ color:C.muted, fontSize:12 }}>No brands found.</div>}
            {filteredBrands.map(b => {
              const isSel = selected.has(b.upma)
              return (
                <div key={b.upma} onClick={()=>toggle(b.upma)} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', background:isSel?'rgba(126,101,81,.15)':C.surf2, border:`1px solid ${isSel?C.accent:C.border}`, borderRadius:6, cursor:'pointer' }}>
                  <span style={{ flex:1, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.name||b.upma}</span>
                  <button onClick={e=>{e.stopPropagation();addOne(b.upma)}} style={{ height:26, background:C.surf, border:`1px solid ${C.border}`, borderRadius:4, padding:'0 8px', cursor:'pointer', fontSize:12, color:C.accent }}>Add</button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Stage 6 Tab ───────────────────────────────────────────────────────────────
function Stage6Tab({ stage6, setStage6, s6All, setS6All, ownedS6, toast, s6Cars, setS6Cars }) {
  const cars    = s6Cars
  const setCars = setS6Cars
  const [search, setSearch]   = useState('')
  const [selected, setSelected] = useState(new Set())
  const [expanded, setExpanded] = useState(new Set())
  const [modal, setModal]     = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)

  async function handleSync() {
    setSyncing(true); setSyncError(null)
    try {
      const res = await fetch('/api/nsb/sync-s6-list', { method: 'POST' })
      const d = await res.json()
      if (d.error) { setSyncError(d.error); return }
      if (Array.isArray(d.cars)) setCars(d.cars)
    } catch (e) { setSyncError(e.message) }
    finally { setSyncing(false) }
  }

  const sq = search.toLowerCase()
  const carMap = new Map((cars||[]).map(c => [c.esdb, c]))
  const ownedEsdbs = s6All!=null ? [] : Object.keys(stage6).filter(e=>(stage6[e]||0)>0)
  const filteredOwned = sq ? ownedEsdbs.filter(e=>{
    const c = carMap.get(e)
    return e.toLowerCase().includes(sq) || (c?.name||'').toLowerCase().includes(sq) || (c?.brand||'').toLowerCase().includes(sq)
  }) : ownedEsdbs

  const brandMap = {}, brandOrder = []
  for (const rc of (cars||[])) {
    const label = (rc.name||rc.esdb).toLowerCase()
    const brandLow = (rc.brand||'').toLowerCase()
    if (sq && !label.includes(sq) && !brandLow.includes(sq) && !rc.esdb.toLowerCase().includes(sq)) continue
    const b = rc.brand||rc.esdb
    if (!brandMap[b]) { brandMap[b]=[]; brandOrder.push(b) }
    brandMap[b].push(rc)
  }

  const selCount = selected.size
  function toggle(id)       { setSelected(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n }) }
  function toggleBrand(b)   { setExpanded(p=>{ const n=new Set(p); n.has(b)?n.delete(b):n.add(b); return n }) }
  function addOne(id)       { setModal({ title:'Add Stage 6 for 1 car', ids:[id] }) }
  function addSelected()    { if(!selected.size)return; const ids=[...selected]; setModal({ title:'Add Stage 6 for '+ids.length+' car(s)', ids }) }
  function confirmAdd(amt) {
    if (modal.isAll) { setS6All(amt) } else { for(const id of modal.ids) setStage6(p=>({...p,[id]:Math.max(0,(p[id]||0)+amt)})); setSelected(new Set()) }
    setModal(null); toast()
  }
  function remove(id) { setStage6(p=>({...p,[id]:0})) }
  function change(id,v) { setStage6(p=>({...p,[id]:v})); toast() }

  const typeBadge = type => {
    if (type==='gold')    return <span style={{ fontSize:9, color:C.gold,   marginLeft:4 }}>★ Gold</span>
    if (type==='purple')  return <span style={{ fontSize:9, color:C.purple, marginLeft:4 }}>★ Purple</span>
    if (type==='legends') return <span style={{ fontSize:9, color:C.lblue,  marginLeft:4 }}>👑 Legends</span>
    return null
  }

  const noCache = cars !== null && cars.length === 0 && !sq

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      {modal && <AddAllModal title={modal.title} onConfirm={confirmAdd} onClose={()=>setModal(null)}/>}
      {s6All!=null && <AddAllBanner label="Add All Stage 6 mode" amount={s6All} onCancel={()=>setS6All(null)}/>}
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10, flexShrink:0 }}>
        <input placeholder="Search cars..." value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:1, background:C.surf2, border:`1px solid ${C.border}`, borderRadius:7, padding:'7px 10px', color:C.text, fontSize:13, outline:'none' }}/>
        {selCount>0 && <button onClick={addSelected} style={{ background:C.accent, border:'none', borderRadius:6, padding:'6px 12px', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>Add Selected ({selCount})</button>}
      </div>
      <div style={{ display:'flex', gap:14, flex:1, overflow:'hidden' }}>
        {/* Owned */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:C.muted, marginBottom:6, flexShrink:0 }}>
            {s6All!=null ? 'Add All active' : `Owned (${filteredOwned.length})`}
          </div>
          <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:3, flex:1 }}>
            {s6All!=null && <div style={{ color:C.muted, fontSize:12 }}>All stage 6 will be set to {fmtN(s6All)}.</div>}
            {s6All==null && filteredOwned.length===0 && <div style={{ color:C.muted, fontSize:12 }}>None owned.</div>}
            {s6All==null && filteredOwned.map(id => {
              const car = carMap.get(id)
              return (
                <div key={id} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', background:C.surf2, border:`1px solid ${C.border}`, borderRadius:6 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{car?.name||id}</div>
                    {car?.name && <div style={{ fontSize:10, color:C.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{id}</div>}
                  </div>
                  <NInput value={stage6[id]||0} onChange={v=>change(id,v)} style={{ width:75 }}/>
                  <button onClick={()=>remove(id)} style={BTN_ICON}>×</button>
                </div>
              )
            })}
          </div>
        </div>
        {/* All Cars */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, flexShrink:0 }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:C.muted, flex:1 }}>All Cars ({(cars||[]).length})</div>
            {!noCache && <button onClick={()=>setModal({title:'Add All Stage 6',ids:[],isAll:true})} style={{ height:22, background:C.surf, border:`1px solid ${C.border}`, borderRadius:4, padding:'0 8px', cursor:'pointer', fontSize:11, color:C.accent, whiteSpace:'nowrap' }}>Add All</button>}
          </div>
          <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:3, flex:1 }}>
            {cars===null && <div style={{ color:C.muted, fontSize:12 }}>Loading...</div>}
            {noCache && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 16px', gap:12, textAlign:'center' }}>
                <div style={{ fontSize:28 }}>📦</div>
                <div style={{ fontSize:13, color:C.text, fontWeight:600 }}>Car list not synced yet</div>
                <div style={{ fontSize:11, color:C.muted, maxWidth:220 }}>Sync once to fetch all Stage 6 cars from the CSR2 database with proper names and brands.</div>
                {syncError && <div style={{ fontSize:11, color:C.red }}>{syncError}</div>}
                <button onClick={handleSync} disabled={syncing}
                  style={{ background:C.accent, border:'none', borderRadius:8, padding:'10px 22px', color:'#fff', fontSize:13, fontWeight:700, cursor:syncing?'not-allowed':'pointer', opacity:syncing?.7:1 }}>
                  {syncing ? '⏳ Syncing (~30s)...' : '🔄 Sync Car List'}
                </button>
              </div>
            )}
            {!noCache && brandOrder.map(b => {
              const bcars = brandMap[b]; if(!bcars?.length)return null
              const isExp = expanded.has(b)
              return (
                <div key={b}>
                  <div onClick={()=>toggleBrand(b)} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', minHeight:36, boxSizing:'border-box', background:C.surf2, border:`1px solid ${C.border}`, borderRadius:6, cursor:'pointer', fontSize:12 }}>
                    <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b} <span style={{ fontSize:10, color:C.muted }}>({bcars.length})</span></span>
                    <span style={{ color:C.muted, fontSize:11 }}>{isExp?'▲':'▼'}</span>
                  </div>
                  {isExp && bcars.map(rc => {
                    const isSel = selected.has(rc.esdb)
                    return (
                      <div key={rc.esdb} onClick={()=>toggle(rc.esdb)} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 8px 4px 18px', background:isSel?'rgba(126,101,81,.15)':C.surf, border:`1px solid ${isSel?C.accent:C.border}`, borderRadius:5, cursor:'pointer', marginTop:2 }}>
                        <input type="checkbox" checked={isSel} onChange={()=>toggle(rc.esdb)} onClick={e=>e.stopPropagation()} style={{ flexShrink:0 }}/>
                        <span style={{ flex:1, fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{rc.name||rc.esdb}{typeBadge(rc.type)}</span>
                        <button onClick={e=>{e.stopPropagation();addOne(rc.esdb)}} style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:4, padding:'2px 6px', cursor:'pointer', fontSize:10, color:C.accent }}>Add</button>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
          {!noCache && cars!==null && <button onClick={handleSync} disabled={syncing} style={{ marginTop:8, background:'none', border:`1px solid ${C.border}`, borderRadius:6, padding:'4px 8px', color:C.muted, fontSize:10, cursor:syncing?'not-allowed':'pointer', flexShrink:0 }}>{syncing?'Syncing...':'↻ Re-sync'}</button>}
        </div>
      </div>
    </div>
  )
}

// ─── Garage Debug Modal ────────────────────────────────────────────────────────
function GarageDebugModal({ buildDebugInfo, onClose }) {
  const [diagLog,   setDiagLog]   = useState(null)
  const [diagging,  setDiagging]  = useState(false)

  async function runDiag() {
    setDiagging(true); setDiagLog(null)
    try {
      const res = await fetch('/api/nsb/debug-car-db')
      const d = await res.json()
      setDiagLog(d.log?.join('\n') || JSON.stringify(d, null, 2))
    } catch (e) { setDiagLog('Fetch failed: ' + e.message) }
    finally { setDiagging(false) }
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:10, padding:20, width:560, maxWidth:'94vw', maxHeight:'85vh', display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ flex:1, fontWeight:700, fontSize:14 }}>🐛 Car DB Debug</div>
          <button onClick={runDiag} disabled={diagging} style={{ background:C.accent, border:'none', borderRadius:5, padding:'4px 10px', color:'#fff', fontSize:11, cursor:diagging?'not-allowed':'pointer', opacity:diagging?.6:1 }}>
            {diagging ? 'Running...' : 'Run Server Diagnostics'}
          </button>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:20, lineHeight:1 }}>×</button>
        </div>
        <pre style={{ background:C.surf2, border:`1px solid ${C.border}`, borderRadius:6, padding:12, fontSize:11, overflowY:'auto', flex:1, whiteSpace:'pre-wrap', wordBreak:'break-all', color:C.text, margin:0 }}>
          {buildDebugInfo()}
          {diagLog ? '\n\n─── Server Diagnostics ───\n' + diagLog : '\n\n(Click "Run Server Diagnostics" to check GitHub tree + Supabase)'}
        </pre>
        <div style={{ fontSize:11, color:C.muted, flexShrink:0 }}>Click outside to close.</div>
      </div>
    </div>
  )
}

// ─── Car DB Sync Button ────────────────────────────────────────────────────────
function CarDbSyncBtn({ carDb, setCarDb }) {
  const [syncing, setSyncing] = useState(false)
  const [err,     setErr]     = useState(null)

  async function sync() {
    setSyncing(true); setErr(null)
    try {
      const res = await fetch('/api/nsb/sync-car-db', { method: 'POST' })
      const d = await res.json()
      if (d.error) { setErr(d.error); return }
      // Reload from cache after sync
      const list = await fetch('/api/nsb/car-db-list').then(r=>r.json())
      setCarDb(list.cars || [])
    } catch (e) { setErr(e.message) }
    finally { setSyncing(false) }
  }

  const isEmpty = carDb !== null && carDb.length === 0
  if (carDb === null) return null  // still loading

  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
      {err && <span style={{ fontSize:9, color:C.red }}>{err}</span>}
      <button onClick={sync} disabled={syncing} title={isEmpty ? 'Sync Car DB to enable color picker' : 'Re-sync Car DB'}
        style={{ background: isEmpty ? C.accent : 'none', border:`1px solid ${isEmpty?C.accent:C.border}`, borderRadius:4, padding:'2px 6px', color: isEmpty ? '#fff' : C.muted, fontSize:9, cursor:syncing?'not-allowed':'pointer', flexShrink:0, opacity:syncing?.6:1 }}>
        {syncing ? '⏳' : isEmpty ? '🎨 Sync Car DB' : '🎨'}
      </button>
    </div>
  )
}

// ─── Color Picker Modal ────────────────────────────────────────────────────────
function ColorPickerModal({ car, maxed, carDbEntry, onSelect, onClose }) {
  const [picking, setPicking] = useState(null) // index being fetched
  const colors = carDbEntry?.colors || []

  async function pick(col) {
    setPicking(col.name)
    try {
      const url = maxed && col.maxedTxtUrl ? col.maxedTxtUrl : col.stockTxtUrl
      let paid = null
      if (url) {
        const txt = await fetch(url).then(r => r.json()).catch(()=>null)
        paid = txt?.paid ?? null
      }
      onSelect({ colorName: col.displayName, paid })
    } catch { onSelect({ colorName: col.displayName, paid: null }) }
    finally { setPicking(null) }
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:10, padding:20, width:480, maxWidth:'92vw', maxHeight:'80vh', display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700 }}>{car.name || car.esdb}</div>
            <div style={{ fontSize:11, color:C.muted }}>{car.brand} — {maxed ? 'Maxed' : 'Stock'}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:20, lineHeight:1 }}>×</button>
        </div>
        {colors.length === 0 && (
          <div style={{ color:C.muted, fontSize:13, textAlign:'center', padding:'20px 0' }}>No color data available. Sync the Car DB first.</div>
        )}
        <div style={{ overflowY:'auto', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))', gap:8 }}>
          {colors.map(col => {
            const photo = maxed && col.maxedPhotoUrl ? col.maxedPhotoUrl : col.photoUrl
            const busy  = picking === col.name
            return (
              <div key={col.name} onClick={()=>!busy && pick(col)}
                style={{ cursor:busy?'wait':'pointer', borderRadius:7, overflow:'hidden', border:`1px solid ${C.border}`, background:C.surf2, opacity:busy?.6:1, transition:'opacity .1s' }}>
                {photo && <img src={photo} alt={col.displayName} style={{ width:'100%', height:60, objectFit:'cover', display:'block' }}
                  onError={e=>{ e.target.style.display='none' }}/>}
                <div style={{ fontSize:10, padding:'4px 5px', textAlign:'center', color:C.text, wordBreak:'break-word' }}>
                  {busy ? '...' : col.displayName}
                </div>
              </div>
            )
          })}
        </div>
        {!carDbEntry && (
          <div style={{ fontSize:11, color:C.muted, borderTop:`1px solid ${C.border}`, paddingTop:8 }}>
            Car not found in Car DB. Sync the Car DB to enable color picking.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Garage Tab ────────────────────────────────────────────────────────────────
function parseCrdb(crdb) {
  // "Ford_RingbrothersMustang_1969" → "Ford Ringbrothers Mustang 1969"
  const parts = crdb.split('_')
  if (parts.length < 2) return crdb
  const brand = parts[0].replace(/([A-Z])/g, ' $1').trim()
  const model = parts.slice(1, -1).map(p => p.replace(/([A-Z])/g, ' $1').trim()).join(' ')
  const year  = parts[parts.length - 1]
  const hasYear = /^\d{4}$/.test(year)
  return (brand + ' ' + (model || (hasYear ? '' : year)) + (hasYear ? ' ' + year : '')).replace(/\s+/g, ' ').trim()
}

function GarageTab({ ownedCars, garageDeleted, setGarageDeleted, garageAdded, setGarageAdded, garageMaxout, setGarageMaxout, toast, s6Cars, allCars, setAllCars, carDb, setCarDb }) {
  const [queue,       setQueue]       = useState([])
  const [availSearch, setAvailSearch] = useState('')
  const [ownedSearch, setOwnedSearch] = useState('')
  const [syncing,     setSyncing]     = useState(false)
  const [syncError,   setSyncError]   = useState(null)
  const [colorPicker, setColorPicker] = useState(null)

  async function handleSync() {
    setSyncing(true); setSyncError(null)
    try {
      const res = await fetch('/api/nsb/sync-all-cars', { method: 'POST' })
      const d = await res.json()
      if (d.error) { setSyncError('Sync error: ' + d.error); return }
      // Reload from cache after sync
      const list = await fetch('/api/nsb/all-cars-list').then(r=>r.json())
      const cars = list.cars || []
      if (cars.length === 0) { setSyncError('Sync returned ' + (d.count||0) + ' cars but cache is still empty — check Supabase csr2_cache table'); return }
      setAllCars(cars)
    } catch (e) { setSyncError(e.message) }
    finally { setSyncing(false) }
  }

  // s6Cars → name/brand/type lookup maps (s6 cars have richer names)
  const s6NameMap = useMemo(() => {
    const m = {}
    for (const c of (s6Cars||[])) m[c.esdb] = { name: c.name, brand: c.brand }
    return m
  }, [s6Cars])
  const s6TypeMap = useMemo(() => {
    const m = {}
    for (const c of (s6Cars||[])) m[c.esdb] = c.type
    return m
  }, [s6Cars])
  const carDbMap = useMemo(() => {
    const m = {}
    for (const c of (carDb||[])) m[c.crdb] = c
    return m
  }, [carDb])

  // Enrich allCars (list of crdb strings) with display names
  const allCarsEnriched = useMemo(() => {
    return (allCars||[]).map(crdb => {
      const s6 = s6NameMap[crdb]
      return {
        crdb,
        esdb:  crdb,  // same value — needed for carDbMap lookup + queue dedup
        name:  s6?.name  || parseCrdb(crdb),
        brand: s6?.brand || crdb.split('_')[0],
        type:  s6TypeMap[crdb] || null,
      }
    })
  }, [allCars, s6NameMap, s6TypeMap])

  const cname  = crdb => s6NameMap[crdb]?.name  || parseCrdb(crdb)
  const cbrand = crdb => s6NameMap[crdb]?.brand  || crdb.split('_')[0]

  const ownedCrdbSet  = new Set(ownedCars.map(c=>c.crdb))
  const addedEsdbSet  = new Set([...garageAdded.map(c=>c.esdb), ...queue.map(c=>c.esdb)])
  const asq           = availSearch.toLowerCase()
  const available     = allCarsEnriched.filter(c => !ownedCrdbSet.has(c.crdb) && !addedEsdbSet.has(c.crdb))
  const filteredAvail = asq ? available.filter(c=>c.name.toLowerCase().includes(asq)||c.brand.toLowerCase().includes(asq)||c.crdb.toLowerCase().includes(asq)) : available
  const deletedUnids  = new Set(garageDeleted.map(d=>d.unid))
  const osq           = ownedSearch.toLowerCase()
  const filteredOwned = ownedCars.filter(c=>!deletedUnids.has(c.unid)&&(!osq||cname(c.crdb).toLowerCase().includes(osq)||(c.crdb||'').toLowerCase().includes(osq)))
  const deleted       = ownedCars.filter(c=>deletedUnids.has(c.unid))
  const noSync        = allCars !== null && allCars.length === 0 && !asq

  function openColorPicker(car, maxed) {
    const entry = carDbMap[car.esdb] || null
    if (!entry || entry.colors.length <= 1) {
      // No color choice needed — add directly (with single color paid if available)
      const col = entry?.colors?.[0] || null
      const colorName = col?.displayName || null
      const txtUrl = maxed && col?.maxedTxtUrl ? col.maxedTxtUrl : col?.stockTxtUrl
      if (txtUrl) {
        fetch(txtUrl).then(r=>r.json()).then(obj => {
          addToQueue(car, maxed, colorName, obj.paid ?? null)
        }).catch(()=>addToQueue(car, maxed, colorName, null))
      } else {
        addToQueue(car, maxed, colorName, null)
      }
    } else {
      setColorPicker({ car, maxed, carDbEntry: entry })
    }
  }
  function addToQueue(car, maxed, colorName, paid) {
    setQueue(p=>[...p, { ...car, esdb: car.esdb, maxed, colorName, paid }])
  }
  function dequeue(esdb)     { setQueue(p=>p.filter(c=>c.esdb!==esdb)) }
  function confirmQueue()      { setGarageAdded(p=>[...p, ...queue]); setQueue([]); toast() }
  function removeAdded(esdb)   { setGarageAdded(p=>p.filter(c=>c.esdb!==esdb)) }
  function del(unid, crdb)     { setGarageDeleted(p=>[...p,{unid,crdb}]); toast() }
  function restore(unid)       { setGarageDeleted(p=>p.filter(d=>d.unid!==unid)) }
  function toggleMaxout(unid)  { setGarageMaxout(p=>({...p,[unid]:!p[unid]})); toast() }

  const typeBadge = type => {
    if (type==='gold')    return <span style={{ fontSize:9, color:C.gold,   marginLeft:4 }}>★</span>
    if (type==='purple')  return <span style={{ fontSize:9, color:C.purple, marginLeft:4 }}>★</span>
    if (type==='legends') return <span style={{ fontSize:9, color:C.lblue,  marginLeft:4 }}>👑</span>
    return null
  }

  const [debugOpen, setDebugOpen] = useState(false)
  function buildDebugInfo() {
    const lines = []
    lines.push(`allCars: ${allCars === null ? 'null (loading)' : `Array(${allCars.length})`}`)
    lines.push(`carDb state: ${carDb === null ? 'null (loading)' : `Array(${carDb.length})`}`)
    lines.push(`carDbMap keys: ${Object.keys(carDbMap).length}`)
    lines.push(`s6Cars: ${s6Cars === null ? 'null' : `Array(${s6Cars.length})`}`)
    lines.push(`available cars: ${available.length}`)
    lines.push('')
    // Check first 5 available cars against carDbMap
    const sample = available.slice(0, 5)
    if (sample.length === 0) lines.push('No available cars to check.')
    for (const car of sample) {
      const entry = carDbMap[car.crdb]
      if (!entry) {
        lines.push(`crdb: ${car.crdb}`)
        lines.push(`  → name: ${car.name}`)
        lines.push(`  → carDbMap: NOT FOUND (no color picker)`)
      } else {
        lines.push(`crdb: ${car.crdb}`)
        lines.push(`  → FOUND: ${entry.brand} ${entry.model} (${entry.colors.length} colors)`)
        if (entry.colors[0]) lines.push(`  → first color: ${entry.colors[0].name}`)
      }
    }
    if (carDb && carDb.length > 0) {
      lines.push('')
      lines.push(`Sample carDb[0]: crdb=${carDb[0].crdb}, colors=${carDb[0].colors?.length}`)
    }
    return lines.join('\n')
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', gap:0 }}>
      {colorPicker && (
        <ColorPickerModal
          car={colorPicker.car}
          maxed={colorPicker.maxed}
          carDbEntry={colorPicker.carDbEntry}
          onSelect={({ colorName, paid }) => {
            addToQueue(colorPicker.car, colorPicker.maxed, colorName, paid)
            setColorPicker(null)
          }}
          onClose={() => setColorPicker(null)}
        />
      )}
      {debugOpen && <GarageDebugModal buildDebugInfo={buildDebugInfo} onClose={()=>setDebugOpen(false)}/>}

      {/* Top half: Available + Queue */}
      <div style={{ display:'flex', gap:12, marginBottom:8, minHeight:0, flex:'0 0 auto', maxHeight:'55%' }}>

        {/* Available */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, flexShrink:0 }}>
            <div style={{ ...SEC_HDR, flex:1 }}>Available ({filteredAvail.length})</div>
            <button onClick={()=>setDebugOpen(true)} title="Debug car DB lookup" style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:4, padding:'2px 6px', color:C.muted, fontSize:9, cursor:'pointer', flexShrink:0 }}>🐛</button>
            {allCars !== null && allCars.length > 0 && !syncing && (
              <button onClick={handleSync} disabled={syncing} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:4, padding:'2px 6px', color:C.muted, fontSize:9, cursor:'pointer', flexShrink:0 }}>↻</button>
            )}
            <CarDbSyncBtn carDb={carDb} setCarDb={setCarDb}/>
          </div>
          <input placeholder="Search available..." value={availSearch} onChange={e=>setAvailSearch(e.target.value)}
            style={{ background:C.surf2, border:`1px solid ${C.border}`, borderRadius:7, padding:'6px 10px', color:C.text, fontSize:12, outline:'none', marginBottom:6, flexShrink:0 }}
          />
          <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:3, flex:1 }}>
            {allCars===null && <div style={{ color:C.muted, fontSize:12 }}>Loading...</div>}
            {syncing && <div style={{ color:C.muted, fontSize:12 }}>⏳ Syncing...</div>}
            {noSync && !syncing && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'16px 8px', gap:8, textAlign:'center' }}>
                <div style={{ fontSize:20 }}>📦</div>
                <div style={{ fontSize:12, color:C.text, fontWeight:600 }}>Car list not synced yet</div>
                {syncError && <div style={{ fontSize:11, color:C.red }}>{syncError}</div>}
                <button onClick={handleSync} style={{ background:C.accent, border:'none', borderRadius:7, padding:'8px 16px', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  🔄 Sync Car List
                </button>
              </div>
            )}
            {!noSync && !syncing && filteredAvail.map(c=>(
              <div key={c.crdb} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 8px', background:C.surf2, border:`1px solid ${C.border}`, borderRadius:6 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}{typeBadge(c.type)}</div>
                  <div style={{ fontSize:9, color:C.muted }}>{c.brand}</div>
                </div>
                <button onClick={()=>openColorPicker(c, false)} style={{ ...BTN_SML, fontSize:10 }}>Stock</button>
                <button onClick={()=>openColorPicker(c, true)}  style={{ ...BTN_SML, fontSize:10, color:C.gold, borderColor:C.gold }}>Max</button>
              </div>
            ))}
            {!noSync && !syncing && allCars!==null && filteredAvail.length===0 && !asq && (
              <div style={{ color:C.muted, fontSize:12 }}>All cars are already in your garage or queue.</div>
            )}
          </div>
        </div>

        {/* Queue */}
        <div style={{ width:180, minWidth:180, display:'flex', flexDirection:'column' }}>
          <div style={{ ...SEC_HDR, marginBottom:6, flexShrink:0 }}>Queue ({queue.length + garageAdded.length})</div>
          <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:3, flex:1 }}>
            {queue.length===0 && garageAdded.length===0 && <div style={{ color:C.muted, fontSize:11, lineHeight:1.5 }}>Empty.<br/><span style={{ fontSize:10 }}>Click Stock or Max.</span></div>}
            {/* Confirmed (already committed to garageAdded) */}
            {garageAdded.map(c=>(
              <div key={c.esdb} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 7px', background:'rgba(59,130,246,.08)', border:`1px solid rgba(59,130,246,.3)`, borderRadius:5 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#60a5fa' }}>{c.name||c.esdb}</div>
                  {c.colorName && <div style={{ fontSize:9, color:C.muted }}>{c.colorName}</div>}
                </div>
                {c.maxed && <span style={{ fontSize:9, color:C.gold, flexShrink:0 }}>Max</span>}
                <button onClick={()=>removeAdded(c.esdb)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:13, lineHeight:1, padding:'0 2px' }}>×</button>
              </div>
            ))}
            {/* Pending queue */}
            {queue.map(c=>(
              <div key={c.esdb} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 7px', background:C.surf2, border:`1px solid ${C.border}`, borderRadius:5 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name||c.esdb}</div>
                  {c.colorName && <div style={{ fontSize:9, color:C.muted }}>{c.colorName}</div>}
                </div>
                {c.maxed && <span style={{ fontSize:9, color:C.gold, flexShrink:0 }}>Max</span>}
                <button onClick={()=>dequeue(c.esdb)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:13, lineHeight:1, padding:'0 2px' }}>×</button>
              </div>
            ))}
          </div>
          <button onClick={confirmQueue} disabled={queue.length===0}
            style={{ marginTop:6, background:C.accent, border:'none', borderRadius:6, padding:'7px 10px', color:'#fff', fontSize:12, fontWeight:600, cursor:queue.length===0?'not-allowed':'pointer', opacity:queue.length===0?.5:1, flexShrink:0 }}>
            + Add to Garage ({queue.length})
          </button>
        </div>
      </div>

      {/* Separator */}
      <div style={{ height:1, background:C.border, marginBottom:8, flexShrink:0 }}/>

      {/* Bottom: Owned */}
      <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexShrink:0 }}>
          <div style={{ ...SEC_HDR, flex:1 }}>Owned ({filteredOwned.length}{garageDeleted.length>0?`, ${garageDeleted.length} deleting`:''})</div>
        </div>
        <input placeholder="Search owned..." value={ownedSearch} onChange={e=>setOwnedSearch(e.target.value)}
          style={{ background:C.surf2, border:`1px solid ${C.border}`, borderRadius:7, padding:'6px 10px', color:C.text, fontSize:12, outline:'none', marginBottom:6, flexShrink:0 }}
        />
        <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:3, flex:1 }}>
          {deleted.map(c=>(
            <div key={c.unid} style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 8px', background:'rgba(224,82,82,.08)', border:`1px solid rgba(224,82,82,.3)`, borderRadius:6 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:C.red, textDecoration:'line-through' }}>{cname(c.crdb)}</div>
                {cbrand(c.crdb) && <div style={{ fontSize:9, color:C.red, opacity:.7 }}>{cbrand(c.crdb)}</div>}
              </div>
              <span style={{ fontSize:10, color:C.red, flexShrink:0 }}>DELETE</span>
              <button onClick={()=>restore(c.unid)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:13, lineHeight:1, padding:'0 2px' }}>↩</button>
            </div>
          ))}
          {filteredOwned.map(c=>{
            const isMaxed = garageMaxout[c.unid]
            const brand   = cbrand(c.crdb)
            return (
              <div key={c.unid} style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 8px', background:C.surf2, border:`1px solid ${C.border}`, borderRadius:6 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cname(c.crdb)}</div>
                  {brand && <div style={{ fontSize:9, color:C.muted }}>{brand}</div>}
                </div>
                {isMaxed && <span style={{ fontSize:9, color:C.gold, flexShrink:0 }}>maxed</span>}
                <button onClick={()=>toggleMaxout(c.unid)} title="Max Out" style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, lineHeight:1, padding:'0 2px', color:isMaxed?C.gold:C.muted }}>★</button>
                <button onClick={()=>del(c.unid,c.crdb)} title="Delete" style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, lineHeight:1, padding:'0 2px', color:C.muted }}>×</button>
              </div>
            )
          })}
          {filteredOwned.length===0 && deleted.length===0 && <div style={{ color:C.muted, fontSize:12 }}>No cars in garage.</div>}
        </div>
      </div>
    </div>
  )
}

// ─── Prvr modal ────────────────────────────────────────────────────────────────
function PrvrModal({ current, onSave, onClose }) {
  const [val, setVal] = useState(current)
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
      <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:12, padding:24, width:320, maxWidth:'90vw' }}>
        <div style={{ fontWeight:700, marginBottom:14, fontSize:14 }}>Edit Save Version</div>
        <input type="text" value={val} onChange={e=>setVal(e.target.value)}
          style={{ width:'100%', boxSizing:'border-box', background:C.surf2, border:`1px solid ${C.border}`, borderRadius:7, padding:'8px 10px', color:C.text, fontSize:14, outline:'none', marginBottom:14 }}
          autoFocus onKeyDown={e=>{ if(e.key==='Enter') onSave(val) }}
        />
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ background:C.surf2, border:`1px solid ${C.border}`, borderRadius:6, padding:'7px 14px', color:C.muted, fontSize:12, cursor:'pointer' }}>Cancel</button>
          <button onClick={()=>onSave(val)} style={{ background:C.accent, border:'none', borderRadius:6, padding:'7px 16px', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>Save</button>
        </div>
      </div>
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
  const [prvrModal, setPrvrModal] = useState(false)
  const fileRef  = useRef(null)
  const inputRef = useRef(null)
  const [toastOn, fireToast] = useToast()

  const [currency, setCurrency]           = useState({})
  const [legends, setLegends]             = useState({})
  const [fusions, setFusions]             = useState({})
  const [fusionsAll, setFusionsAll]       = useState(null)
  const [stage6, setStage6]               = useState({})
  const [s6All, setS6All]                 = useState(null)
  const [s6Cars,        setS6Cars]         = useState(null)
  const [allCars,       setAllCars]        = useState(null)
  const [fusionBrands,  setFusionBrands]  = useState(null)
  const [carDb,         setCarDb]          = useState(null)
  const [garageDeleted, setGarageDeleted] = useState([])
  const [garageAdded,   setGarageAdded]   = useState([])
  const [garageMaxout,  setGarageMaxout]  = useState({})
  const [setPrvrVal, setSetPrvrVal]       = useState(null)

  async function handleFile(file) {
    if (!file) return
    fileRef.current = file
    setParsing(true); setError(null); setApplyMsg(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/nsb/read', { method:'POST', body:fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const c = {}; ['cash','gold','bronzeKeys','silverKeys','goldKeys','fuel','fusionGreen','fusionBlue','fusionRed','fusionYellow'].forEach(k=>{ c[k]=data.currencies[k]??0 })
      setCurrency(c)
      const l = {}; (data.legends.owned||[]).forEach(o=>{ l[o.crdb]=o.amount })
      setLegends(l)
      const f = {}; (data.fusions.owned||[]).forEach(o=>{ f[o.upma]=o.amount })
      setFusions(f)
      const s = {}; (data.stage6.owned||[]).forEach(o=>{ s[o.esdb]=o.amount })
      setStage6(s)
      setFusionsAll(null); setS6All(null); setGarageDeleted([]); setGarageAdded([]); setGarageMaxout({}); setSetPrvrVal(null); setS6Cars(null); setAllCars(null); setFusionBrands(null); setCarDb(null)
      setParsed(data); setTab('currency')
    } catch (e) { setError('Parse error: '+e.message) }
    finally { setParsing(false) }
  }

  useEffect(() => {
    if (!parsed || s6Cars !== null) return
    fetch('/api/nsb/s6cars-list').then(r=>r.json()).then(d=>setS6Cars(d.cars||[])).catch(()=>setS6Cars([]))
  }, [parsed, s6Cars])

  useEffect(() => {
    if (!parsed || allCars !== null) return
    fetch('/api/nsb/all-cars-list').then(r=>r.json()).then(d=>setAllCars(d.cars||[])).catch(()=>setAllCars([]))
  }, [parsed, allCars])

  useEffect(() => {
    if (!parsed || fusionBrands !== null) return
    fetch('/api/nsb/fusions-list').then(r=>r.json()).then(d=>setFusionBrands(d.brands||[])).catch(()=>setFusionBrands([]))
  }, [parsed, fusionBrands])

  useEffect(() => {
    if (!parsed || carDb !== null) return
    fetch('/api/nsb/car-db-list').then(r=>r.json()).then(d=>setCarDb(d.cars||[])).catch(()=>setCarDb([]))
  }, [parsed, carDb])

  function onDrop(e) { e.preventDefault(); setDragging(false); const f=e.dataTransfer.files[0]; if(f) handleFile(f) }

  async function handleDownload() {
    if (!fileRef.current||!parsed) return
    setApplying(true); setError(null); setApplyMsg(null)
    try {
      const ab = await fileRef.current.arrayBuffer()
      const bytes = new Uint8Array(ab); let bin=''; const ch=8192
      for(let i=0;i<bytes.length;i+=ch) bin+=String.fromCharCode(...bytes.subarray(i,i+ch))
      const nsbBase64 = btoa(bin)
      const body = {
        nsbBase64, currency,
        legends: Object.fromEntries(Object.entries(legends).filter(([,v])=>v>0)),
        fusions: fusionsAll!=null ? undefined : fusions,
        fusionsAll: fusionsAll!=null ? Number(fusionsAll) : undefined,
        stage6: s6All!=null ? undefined : stage6,
        s6All: s6All!=null ? Number(s6All) : undefined,
        garageDeleted: garageDeleted.length ? garageDeleted : undefined,
        garageAdded:   garageAdded.length   ? garageAdded.map(c=>({esdb:c.esdb,maxed:!!c.maxed,paid:c.paid??null})) : undefined,
        garageMaxout:  Object.keys(garageMaxout).length ? garageMaxout : undefined,
        setPrvr: setPrvrVal!=null ? setPrvrVal : undefined,
      }
      const res = await fetch('/api/nsb/write', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      if (!res.ok) { const j=await res.json().catch(()=>({})); throw new Error(j.error||'Server error '+res.status) }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href=url; a.download=fileRef.current.name||'save.nsb'; a.click(); URL.revokeObjectURL(url)
      setApplyMsg('Downloaded successfully.')
    } catch (e) { setError('Error: '+e.message) }
    finally { setApplying(false) }
  }

  // ── Drop zone ─────────────────────────────────────────────────────────────────
  if (!parsed && !parsing) {
    return (
      <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'system-ui,sans-serif', color:C.text }}>
        <div style={{ maxWidth:480, width:'100%' }}>
          <div style={{ fontSize:22, fontWeight:700, marginBottom:6 }}>CSR Racing 2 Editor</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:24 }}>Upload your CSR2 save file to edit currencies, legends, fusions, stage 6, and garage.</div>
          <div onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={onDrop} onClick={()=>inputRef.current?.click()}
            style={{ border:`2px dashed ${dragging?C.accent:C.border}`, borderRadius:12, padding:'40px 24px', textAlign:'center', cursor:'pointer', background:dragging?'#1a1510':C.surf, transition:'all .15s' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>📂</div>
            <div style={{ fontSize:14, color:C.text, marginBottom:6 }}>Drop your NSB file here</div>
            <div style={{ fontSize:12, color:C.muted }}>or click to browse</div>
            <input ref={inputRef} type="file" style={{ display:'none' }} onChange={e=>{const f=e.target.files[0];if(f)handleFile(f)}}/>
          </div>
          {error && <div style={{ marginTop:16, background:'#1f1010', border:`1px solid #4a2020`, borderRadius:8, padding:12, color:C.red, fontSize:13 }}>{error}</div>}
        </div>
      </div>
    )
  }

  if (parsing) {
    return <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', color:C.muted, fontSize:14 }}>Reading save file...</div>
  }

  const TABS = [
    {k:'currency',l:'Currency'},{k:'garage',l:'Garage'},{k:'legends',l:'Legends'},{k:'fusions',l:'Fusions'},{k:'stage6',l:'Stage 6'},
  ]
  const displayPrvr = setPrvrVal!=null ? setPrvrVal : (parsed?.prvr||'')

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:C.bg, color:C.text, fontFamily:'system-ui,sans-serif', overflow:'hidden' }}>
      {prvrModal && <PrvrModal current={displayPrvr} onSave={v=>{setSetPrvrVal(v);setPrvrModal(false);fireToast()}} onClose={()=>setPrvrModal(false)}/>}
      {/* Toast */}
      {toastOn && <div style={{ position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)', background:C.accent, color:'#fff', borderRadius:20, padding:'6px 18px', fontSize:12, fontWeight:600, zIndex:200, pointerEvents:'none' }}>Saved ✓</div>}
      {/* Header */}
      <div style={{ background:C.surf, borderBottom:`1px solid ${C.border}`, padding:'10px 16px', display:'flex', alignItems:'center', flexShrink:0 }}>
        <div style={{ fontWeight:700, fontSize:15 }}>CSR Racing 2 Editor</div>
      </div>
      {/* Body: left panel + right */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <LeftPanel parsed={parsed} currency={currency} legends={legends} garageDeleted={garageDeleted} prvr={setPrvrVal} onEditPrvr={()=>setPrvrModal(true)} onChangeFile={()=>{setParsed(null);setError(null);setApplyMsg(null);fileRef.current=null}}/>
        {/* Right: tabs + content */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Tab bar */}
          <div style={{ background:C.surf, borderBottom:`1px solid ${C.border}`, display:'flex', overflowX:'auto', padding:'0 8px', flexShrink:0 }}>
            {TABS.map(({k,l})=>(
              <button key={k} onClick={()=>setTab(k)} style={{ background:'none', border:'none', padding:'11px 14px', fontSize:13, cursor:'pointer', color:tab===k?C.text:C.muted, fontWeight:tab===k?700:400, borderBottom:`2px solid ${tab===k?C.accent:'transparent'}`, whiteSpace:'nowrap', flexShrink:0 }}>{l}</button>
            ))}
          </div>
          {/* Tab content */}
          <div style={{ flex:1, overflow:'hidden', padding:'14px 16px', display:'flex', flexDirection:'column', minHeight:0 }}>
            {tab==='currency' && <CurrencyTab currency={currency} setCurrency={setCurrency}/>}
            {tab==='garage'   && <GarageTab ownedCars={parsed.garage.ownedCars} garageDeleted={garageDeleted} setGarageDeleted={setGarageDeleted} garageAdded={garageAdded} setGarageAdded={setGarageAdded} garageMaxout={garageMaxout} setGarageMaxout={setGarageMaxout} toast={fireToast} s6Cars={s6Cars} allCars={allCars} setAllCars={setAllCars} carDb={carDb} setCarDb={setCarDb}/>}
            {tab==='legends'  && <LegendsTab legends={legends} setLegends={setLegends} toast={fireToast}/>}
            {tab==='fusions'  && <FusionsTabWrapper fusions={fusions} setFusions={setFusions} fusionsAll={fusionsAll} setFusionsAll={setFusionsAll} ownedFusions={parsed.fusions.owned} toast={fireToast} brands={fusionBrands} setBrands={setFusionBrands}/>}
            {tab==='stage6'   && <Stage6Tab stage6={stage6} setStage6={setStage6} s6All={s6All} setS6All={setS6All} ownedS6={parsed.stage6.owned} toast={fireToast} s6Cars={s6Cars} setS6Cars={setS6Cars}/>}
          </div>
          {/* Footer */}
          <div style={{ background:C.surf, borderTop:`1px solid ${C.border}`, padding:'10px 16px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            {error   && <div style={{ color:C.red,   fontSize:12, flex:1 }}>{error}</div>}
            {applyMsg && !error && <div style={{ color:C.green, fontSize:12, flex:1 }}>{applyMsg}</div>}
            {!error && !applyMsg && (
              <div style={{ fontSize:11, color:C.muted, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {garageAdded.length>0   && <span style={{ color:C.green }}>{garageAdded.length} car(s) adding · </span>}
                {garageDeleted.length>0 && <span style={{ color:C.red }}>{garageDeleted.length} car(s) deleting · </span>}
                {fusionsAll!=null && <span style={{ color:C.green }}>Fusions All: {fmtN(fusionsAll)} · </span>}
                {s6All!=null && <span style={{ color:C.green }}>S6 All: {fmtN(s6All)}</span>}
              </div>
            )}
            <button onClick={handleDownload} disabled={applying} style={{ background:applying?C.surf2:C.accent, color:C.text, border:'none', borderRadius:8, padding:'9px 22px', fontSize:13, fontWeight:700, cursor:applying?'not-allowed':'pointer', flexShrink:0 }}>
              {applying?'Applying...':'💾 Apply & Download'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
