'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, X, Gamepad2, ArrowLeft, Pencil, Eye, AlertCircle, Star, Upload, Link, ChevronLeft, ChevronRight, Download, Flag, Settings, Check } from 'lucide-react'
import { convertAmount } from '../lib/currency'
import FieldEditor from './FieldEditor'
import FieldRenderer, { stripHiddenConditionalValues } from './FieldRenderer'

const STATUS_COLORS = {
  Available: { bg: '#4caf5022', color: '#4caf50' },
  Sold: { bg: '#2196f322', color: '#2196f3' },
  Lost: { bg: '#e0525222', color: '#e05252' },
  Reserved: { bg: '#e8a02022', color: '#e8a020' },
}

const STATUS_TABS = ['All', 'Available', 'Sold', 'Reserved', 'Lost']

const scrollbarStyle = `
  .themed-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
  .themed-scroll::-webkit-scrollbar-track { background: transparent; }
  .themed-scroll::-webkit-scrollbar-thumb { background: #7E655166; border-radius: 10px; }
  .themed-scroll::-webkit-scrollbar-thumb:hover { background: #7E6551aa; }
  @keyframes spin { to { transform: rotate(360deg) } }
`

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const MAX_IMAGE_SIZE = 3 * 1024 * 1024 // 3MB
const EXPECTED_SCANNER_VERSION = '0.7.15'

const CHECKER_KEY_MAP = {
  'server': 'platform', 'platform': 'platform', 'region': 'platform',
  'level': 'summonerLevel', 'summoner level': 'summonerLevel', 'summoner_level': 'summonerLevel',
  'name': 'summonerName', 'summoner name': 'summonerName', 'summoner_name': 'summonerName',
  'solo rank': 'soloRank', 'solo_rank': 'soloRank', 'solo': 'soloRank', 'ranked solo': 'soloRank',
  'solo lp': 'soloLp', 'solo_lp': 'soloLp',
  'flex rank': 'flexRank', 'flex_rank': 'flexRank', 'flex': 'flexRank', 'ranked flex': 'flexRank',
  'flex lp': 'flexLp', 'flex_lp': 'flexLp',
  'rp': 'rp', 'riot points': 'rp',
  'be': 'be', 'blue essence': 'be', 'ip': 'be',
  'oe': 'oe', 'orange essence': 'oe',
  'me': 'me', 'mythic essence': 'me',
  'chests': 'hexChests', 'hextech chests': 'hexChests',
  'keys': 'hexKeys', 'hextech keys': 'hexKeys',
  'champions': 'championsOwned', 'champion count': 'championsOwned', 'champs': 'championsOwned',
  'skins': 'skinCount', 'skin count': 'skinCount',
}

function mapCheckerToFields(checkerData, customFields) {
  const fields = {}
  customFields.forEach(field => {
    const key = CHECKER_KEY_MAP[field.label.toLowerCase().trim()]
    if (key && checkerData[key] != null) fields[field.id] = String(checkerData[key])
  })
  return fields
}

const FIELD_TYPES = ['Text', 'Number', 'Dropdown', 'Checkbox']

const CURRENCY_OPTIONS = [
  { code: 'USD', symbol: '$' }, { code: 'EUR', symbol: '€' }, { code: 'GBP', symbol: '£' },
  { code: 'PHP', symbol: '₱' }, { code: 'SGD', symbol: 'S$' }, { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' }, { code: 'JPY', symbol: '¥' }, { code: 'KRW', symbol: '₩' },
  { code: 'BRL', symbol: 'R$' }, { code: 'MYR', symbol: 'MYR' }, { code: 'THB', symbol: '฿' },
]

const CURRENCY_CODES = {
  '$': 'USD', '€': 'EUR', '£': 'GBP', '₱': 'PHP', 'S$': 'SGD', 'A$': 'AUD',
  'C$': 'CAD', '¥': 'JPY', '₩': 'KRW', 'R$': 'BRL', 'MYR': 'MYR', '฿': 'THB'
}

function getTypeColor(type) {
  const map = { Number: '#2196f3', Dropdown: '#9c27b0', Checkbox: '#4caf50', Text: '#7E6551' }
  return map[type] || '#7E6551'
}

function renderFieldInput(field, value, onChange, inputBg, border, text, muted) {
  const style = { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '14px', outline: 'none' }
  switch (field.type) {
    case 'Number':
      return <input type="number" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}`} style={style} />
    case 'Dropdown':
      return (
        <select value={value || ''} onChange={e => onChange(e.target.value)} style={{ ...style, cursor: 'pointer' }}>
          <option value="">— Select {field.label} —</option>
          {(field.options || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
        </select>
      )
    case 'Checkbox':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div onClick={() => onChange(value === 'true' ? 'false' : 'true')}
            style={{ width: '44px', height: '24px', borderRadius: '12px', background: value === 'true' ? '#7E6551' : border, position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
            <div style={{ position: 'absolute', top: '4px', left: value === 'true' ? '24px' : '4px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
          <span style={{ fontSize: '13px', color: value === 'true' ? text : muted }}>{value === 'true' ? 'Yes' : 'No'}</span>
        </div>
      )
    default:
      return <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}`} style={style} />
  }
}

// ─── Checker Categories Modal ────────────────────────────────────────────────
const CDN_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default'
const cdnUrl = p => p ? CDN_BASE + p.toLowerCase().replace('/lol-game-data/assets', '') : ''

const CAT_TABS = [
  { id: 'SKINS',            label: 'Skins',         type: 'skins'            },
  { id: 'EMOTES',           label: 'Emotes',        type: 'emotes'           },
  { id: 'ICONS',            label: 'Icons',         type: 'icons'            },
  { id: 'WARDS',            label: 'Wards',         type: 'wards'            },
  { id: 'CHROMAS',          label: 'Chromas',       type: 'chromas'          },
  { id: 'FINISHERS',        label: 'Finishers',     type: 'finishers'        },
  { id: 'TFT_COMPANIONS',   label: 'Companions',    type: 'tft_companions'   },
  { id: 'TFT_MAP_SKINS',    label: 'Arenas',        type: 'tft_map_skins'    },
  { id: 'TFT_DAMAGE_SKINS', label: 'Booms',         type: 'tft_damage_skins' },
  { id: 'CATEGORIES',       label: 'All Categories',type: null               },
]
const STAR_COLORS = ['', '#cd7f32', '#c0c0c0', '#ffd700']

function CheckerCategoriesModal({ initialConfig, onSave, onClose, card, border, text, muted, inputBg, sectionBg }) {
  const [categories, setCategories] = useState(() => (initialConfig?.categories || []).map(c => ({ ...c, items: [...(c.items || [])] })))
  const [activeTab, setActiveTab] = useState('SKINS')
  const [catalogs, setCatalogs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedCatId, setSelectedCatId] = useState(null)
  const [search, setSearch] = useState('')
  const [newCatName, setNewCatName] = useState('')

  useEffect(() => {
    const DDRAGON = 'https://ddragon.leagueoflegends.com'
    const toArr = x => Array.isArray(x) ? x : Object.values(x || {})
    const ddragonFetch = fetch(`${DDRAGON}/api/versions.json`)
      .then(r => r.json())
      .then(versions => {
        const ver = versions[0]
        return Promise.all([
          fetch(`${DDRAGON}/cdn/${ver}/data/en_US/tft-tactician.json`).then(r => r.json()).catch(() => ({ data: {} })),
          fetch(`${DDRAGON}/cdn/${ver}/data/en_US/tft-arena.json`).then(r => r.json()).catch(() => ({ data: {} })),
        ]).then(([tacticianJson, arenaJson]) => ({
          tft_companions: Object.values(tacticianJson?.data || {}).map(t => ({
            id: parseInt(t.id), name: t.name,
            imgSrc: `${DDRAGON}/cdn/${ver}/img/${t.image?.group}/${t.image?.full}`,
          })),
          tft_map_skins: Object.values(arenaJson?.data || {}).map(a => ({
            id: parseInt(a.id), name: a.name,
            imgSrc: `${DDRAGON}/cdn/${ver}/img/${a.image?.group}/${a.image?.full}`,
          })),
        }))
      }).catch(() => ({ tft_companions: [], tft_map_skins: [] }))

    Promise.all([
      fetch(`${CDN_BASE}/v1/skins.json`).then(r => r.json()).catch(() => ({})),
      fetch(`${CDN_BASE}/v1/summoner-icons.json`).then(r => r.json()).catch(() => []),
      fetch(`${CDN_BASE}/v1/summoner-emotes.json`).then(r => r.json()).catch(() => []),
      fetch(`${CDN_BASE}/v1/ward-skins.json`).then(r => r.json()).catch(() => []),
      fetch(`${CDN_BASE}/v1/nexusfinishers.json`).then(r => r.json()).catch(() => []),
      fetch(`${CDN_BASE}/v1/tftdamageskins.json`).then(r => r.json()).catch(() => []),
      ddragonFetch,
    ]).then(([skinsJson, iconsJson, emotesJson, wardsJson, finishersJson, boomJson, tftData]) => {
      const allSkinsList = Object.values(skinsJson).filter(s => s && !s.isBase && s.id % 1000 !== 0)
      const chromas = []
      for (const s of allSkinsList) {
        for (const c of (s.chromas || [])) {
          chromas.push({ id: c.id, name: s.name, imgSrc: cdnUrl(c.chromaPath) })
        }
      }
      setCatalogs({
        skins:            allSkinsList.map(s => ({ id: s.id, name: s.name, imgSrc: cdnUrl(s.tilePath) })),
        emotes:           toArr(emotesJson).filter(e => e.id != null).map(e => ({ id: e.id, name: e.name || '', imgSrc: cdnUrl(e.inventoryIcon || e.iconPath) })),
        icons:            toArr(iconsJson).filter(i => i.id > 0).map(i => ({ id: i.id, name: i.title || i.name || '', imgSrc: cdnUrl(i.imagePath) })),
        wards:            toArr(wardsJson).filter(w => w.id != null).map(w => ({ id: w.id, name: w.name || '', imgSrc: cdnUrl(w.wardImagePath) })),
        chromas,
        finishers:        toArr(finishersJson).filter(f => f.itemId != null).map(f => ({ id: f.itemId, name: f.name || '', imgSrc: cdnUrl(f.loadoutsIcon) })),
        tft_companions:   tftData.tft_companions,
        tft_map_skins:    tftData.tft_map_skins,
        tft_damage_skins: toArr(boomJson).filter(d => d.itemId != null).map(d => ({ id: d.itemId, name: d.name || '', imgSrc: cdnUrl(d.loadoutsIcon) })),
      })
      setLoading(false)
    })
  }, [])

  const activeType = CAT_TABS.find(t => t.id === activeTab)?.type
  const tabCategories = categories.filter(c => c.type === activeType)
  const selectedCat = categories.find(c => c.id === selectedCatId)

  const getStars = itemId => {
    if (!selectedCatId) return 0
    return categories.find(c => c.id === selectedCatId)?.items.find(i => i.id === itemId)?.stars || 0
  }
  const isInAnyCat = itemId => tabCategories.some(c => c.items.some(i => i.id === itemId))

  const toggleItem = item => {
    if (!selectedCatId) return
    setCategories(prev => prev.map(cat => {
      if (cat.id !== selectedCatId) return cat
      const ex = cat.items.find(i => i.id === item.id)
      if (!ex) return { ...cat, items: [...cat.items, { id: item.id, name: item.name, stars: 1 }] }
      if (ex.stars < 3) return { ...cat, items: cat.items.map(i => i.id === item.id ? { ...i, stars: i.stars + 1 } : i) }
      return { ...cat, items: cat.items.filter(i => i.id !== item.id) }
    }))
  }

  const addCategory = () => {
    if (!newCatName.trim() || !activeType) return
    const cat = { id: uid(), name: newCatName.trim(), type: activeType, items: [] }
    setCategories(prev => [...prev, cat])
    setSelectedCatId(cat.id)
    setNewCatName('')
  }

  const deleteCategory = catId => {
    setCategories(prev => prev.filter(c => c.id !== catId))
    if (selectedCatId === catId) setSelectedCatId(null)
  }

  const moveCat = (catId, dir) => {
    setCategories(prev => {
      const idx = prev.findIndex(c => c.id === catId)
      if (idx < 0) return prev
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
      return arr
    })
  }

  const catalogItems = (!loading && activeType && catalogs)
    ? (catalogs[activeType] || []).filter(item => !search || item.name.toLowerCase().includes(search.toLowerCase()))
    : []

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column', zIndex: 300 }}>
      <style>{scrollbarStyle}</style>

      {/* Header */}
      <div style={{ background: card, borderBottom: `1px solid ${border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: text }}>Checker Categories</div>
          <div style={{ fontSize: '11px', color: muted, marginTop: 2 }}>Assign items to named categories. At scan time, owned matches populate mapped fields.</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onSave({ categories })}
            style={{ padding: '8px 18px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
            Save
          </button>
          <button onClick={onClose}
            style={{ padding: '8px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: card, borderBottom: `1px solid ${border}`, display: 'flex', overflowX: 'auto', flexShrink: 0 }}>
        {CAT_TABS.map(t => {
          const catCount = t.type ? categories.filter(c => c.type === t.type).length : 0
          return (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setSearch(''); setSelectedCatId(null) }}
              style={{ padding: '9px 14px', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === t.id ? '#7E6551' : 'transparent'}`, color: activeTab === t.id ? '#7E6551' : muted, fontSize: '12px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
              {t.label}
              {catCount > 0 && <span style={{ fontSize: 9, color: '#4caf50', fontWeight: 700, background: '#4caf5022', borderRadius: '8px', padding: '1px 5px' }}>{catCount}</span>}
            </button>
          )
        })}
      </div>

      {/* Body */}
      {activeTab === 'CATEGORIES' ? (
        <div className="themed-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: muted, marginBottom: '12px' }}>All categories in priority order (top = highest). Use ↑↓ to reorder. Category key used in Field Mapper shown in grey.</div>
          {categories.length === 0
            ? <div style={{ color: muted, fontSize: '13px', textAlign: 'center', padding: '48px 0' }}>No categories yet. Create them in the type tabs.</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {categories.map((cat, idx) => (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: sectionBg, border: `1px solid ${border}`, borderRadius: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      <button onClick={() => moveCat(cat.id, -1)} disabled={idx === 0}
                        style={{ width: 18, height: 14, background: 'transparent', border: 'none', color: idx === 0 ? border : muted, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 10, padding: 0, lineHeight: 1 }}>▲</button>
                      <button onClick={() => moveCat(cat.id, 1)} disabled={idx === categories.length - 1}
                        style={{ width: 18, height: 14, background: 'transparent', border: 'none', color: idx === categories.length - 1 ? border : muted, cursor: idx === categories.length - 1 ? 'default' : 'pointer', fontSize: 10, padding: 0, lineHeight: 1 }}>▼</button>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: text }}>{cat.name}</div>
                      <div style={{ fontSize: '11px', color: muted, marginTop: 1 }}>{CAT_TABS.find(t => t.type === cat.type)?.label} · {cat.items.length} item{cat.items.length !== 1 ? 's' : ''}</div>
                    </div>
                    <span style={{ fontSize: 9, color: border, fontFamily: 'monospace' }}>cat_{cat.id.slice(0, 8)}</span>
                    <button onClick={() => deleteCategory(cat.id)} style={{ background: 'transparent', border: 'none', color: '#e05252', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
          }
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left: categories panel */}
          <div style={{ width: '210px', flexShrink: 0, borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', background: card }}>
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
              <div style={{ fontSize: '10px', fontWeight: '600', color: muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '7px' }}>Categories</div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCategory() }}
                  placeholder="New category…"
                  style={{ flex: 1, padding: '5px 8px', borderRadius: '6px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '11px', outline: 'none' }} />
                <button onClick={addCategory} disabled={!newCatName.trim()}
                  style={{ padding: '5px 7px', background: newCatName.trim() ? '#7E6551' : border, color: '#FDF4DC', border: 'none', borderRadius: '6px', cursor: newCatName.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}>
                  <Plus size={11} />
                </button>
              </div>
            </div>
            <div className="themed-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
              {tabCategories.length === 0
                ? <div style={{ padding: '16px 8px', fontSize: '11px', color: muted, textAlign: 'center' }}>No categories for this type</div>
                : tabCategories.map(cat => (
                    <div key={cat.id} onClick={() => setSelectedCatId(selectedCatId === cat.id ? null : cat.id)}
                      style={{ padding: '8px 10px', borderRadius: '7px', marginBottom: '3px', cursor: 'pointer', background: selectedCatId === cat.id ? '#7E655118' : 'transparent', border: `1px solid ${selectedCatId === cat.id ? '#7E655155' : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: selectedCatId === cat.id ? text : muted }}>{cat.name}</div>
                        <div style={{ fontSize: '10px', color: muted, marginTop: 1 }}>{cat.items.length} items</div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteCategory(cat.id) }}
                        style={{ background: 'transparent', border: 'none', color: '#e05252', cursor: 'pointer', padding: '2px', opacity: 0.7, display: 'flex', alignItems: 'center' }}>
                        <X size={11} />
                      </button>
                    </div>
                  ))
              }
            </div>
          </div>

          {/* Main: catalog grid */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '9px 14px', borderBottom: `1px solid ${border}`, display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…"
                style={{ flex: 1, maxWidth: '280px', padding: '6px 10px', borderRadius: '7px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }} />
              {selectedCatId
                ? <span style={{ fontSize: '11px', color: '#7E6551' }}>Assigning to <strong>{selectedCat?.name}</strong> · click item to cycle ★→★★→★★★→off</span>
                : <span style={{ fontSize: '11px', color: muted }}>← Select a category to assign items</span>
              }
            </div>
            {loading
              ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: muted, fontSize: '13px' }}>Loading catalog…</div>
              : <div className="themed-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignContent: 'start' }}>
                  {catalogItems.length === 0
                    ? <div style={{ width: '100%', textAlign: 'center', color: muted, fontSize: '13px', padding: '40px 0' }}>No items found</div>
                    : catalogItems.map(item => {
                        const stars = getStars(item.id)
                        const anycat = isInAnyCat(item.id)
                        return (
                          <div key={item.id} onClick={() => toggleItem(item)}
                            title={item.name}
                            style={{ width: 72, cursor: selectedCatId ? 'pointer' : 'default', position: 'relative', userSelect: 'none' }}>
                            <div style={{ width: 72, height: 72, background: '#0a1628', border: `2px solid ${stars > 0 ? STAR_COLORS[stars] : anycat ? '#3a4a5c' : '#1a2a3a'}`, overflow: 'hidden', position: 'relative', transition: 'border-color 0.12s' }}>
                              {item.imgSrc
                                ? <img src={item.imgSrc} alt="" width={72} height={72} style={{ display: 'block', objectFit: 'cover', filter: stars > 0 ? 'none' : 'brightness(0.65)' }}
                                    loading="lazy" onError={e => { e.target.style.opacity = 0 }} />
                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3c4a5c', fontSize: 20 }}>◈</div>
                              }
                              {stars > 0 && (
                                <div style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.85)', borderRadius: '3px', padding: '1px 3px', fontSize: 9, color: STAR_COLORS[stars], fontWeight: 700, lineHeight: 1.3 }}>
                                  {'★'.repeat(stars)}
                                </div>
                              )}
                            </div>
                            <div style={{ marginTop: 3, fontSize: 8, color: stars > 0 ? text : muted, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.name}
                            </div>
                          </div>
                        )
                      })
                  }
                </div>
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Field Mapper Modal ──────────────────────────────────────────────────────
// Checkbox / RichText / Radio are not directly mappable — instead their sub-fields
// are exposed as indented rows. When a sub-field of a Checkbox gets a value,
// the parent Checkbox is auto-ticked to true at applyMapping time.
function FieldMapperModal({ gameName, customFields, flatData, initialMapping, scannerKeyLabels, onSave, onClose, card, border, text, muted, inputBg, sectionBg }) {
  const [localMappings, setLocalMappings] = useState({
    fieldMappings: { ...(initialMapping.fieldMappings || {}) },
    valueMappings: { ...(initialMapping.valueMappings || {}) },
  })

  const scanKeys = Object.keys(scannerKeyLabels)

  const setFieldMapping = (fieldId, scanKey) => {
    setLocalMappings(prev => {
      const fm = { ...prev.fieldMappings }
      if (!scanKey) { delete fm[fieldId] } else { fm[fieldId] = scanKey }
      return { ...prev, fieldMappings: fm }
    })
  }

  const setValueMapping = (fieldId, rawVal, mappedVal) => {
    setLocalMappings(prev => ({
      ...prev,
      valueMappings: {
        ...prev.valueMappings,
        [fieldId]: { ...(prev.valueMappings[fieldId] || {}), [rawVal]: mappedVal },
      },
    }))
  }

  const usedScanKeys = new Set(Object.values(localMappings.fieldMappings))

  // Build flat list of rows: direct-mappable fields + sub-fields of Checkbox/Radio/Dropdown
  const SKIP_TOP = new Set(['Checkbox', 'RichText', 'Radio'])
  const rows = []
  for (const field of customFields) {
    if (!SKIP_TOP.has(field.type)) {
      rows.push({ field, indent: false, parentLabel: null })
    }
    // Sub-fields from conditionalFields
    const cf = field.conditionalFields || {}
    for (const [trigger, subs] of Object.entries(cf)) {
      for (const sub of (subs || [])) {
        rows.push({ field: sub, indent: true, parentLabel: field.label, parentTrigger: trigger, parentType: field.type })
      }
    }
  }

  const renderRow = ({ field, indent, parentLabel, parentTrigger, parentType }) => {
    const mappedKey = localMappings.fieldMappings[field.id] || ''
    const previewVal = mappedKey && flatData[mappedKey] != null ? String(flatData[mappedKey]) : null
    const scanValues = (mappedKey && field.type === 'Dropdown') ? [String(flatData[mappedKey] ?? '')].filter(Boolean) : []
    const vm = localMappings.valueMappings[field.id] || {}

    return (
      <div key={field.id} style={{ background: sectionBg, borderRadius: '10px', border: `1px solid ${border}`, padding: '10px 14px', marginLeft: indent ? '16px' : '0', borderLeft: indent ? `3px solid #7E655144` : undefined }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: '12px', alignItems: 'center' }}>
          <div>
            {indent && <div style={{ fontSize: '10px', color: muted, marginBottom: '2px' }}>↳ {parentLabel} {parentType === 'Checkbox' ? '(when ticked)' : `(when "${parentTrigger}")`}</div>}
            <div style={{ fontSize: '13px', fontWeight: '500', color: text }}>{field.label}</div>
            <div style={{ fontSize: '10px', color: muted, marginTop: '2px' }}>{field.type}</div>
          </div>
          <select value={mappedKey} onChange={e => setFieldMapping(field.id, e.target.value)}
            style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }}>
            <option value="">— Not mapped —</option>
            {scanKeys.map(k => (
              <option key={k} value={k} disabled={!!(usedScanKeys.has(k) && k !== mappedKey)}>
                {scannerKeyLabels[k]}
              </option>
            ))}
          </select>
          <div style={{ fontSize: '12px', color: previewVal != null ? '#4caf50' : muted, fontWeight: previewVal != null ? '600' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {previewVal ?? '—'}
          </div>
        </div>

        {field.type === 'Dropdown' && mappedKey && scanValues.map(raw => {
          const isUnmapped = vm[raw] == null
          return (
            <div key={raw} style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: '12px', alignItems: 'center', paddingTop: '8px', borderTop: `1px solid ${border}` }}>
              <div style={{ fontSize: '11px', color: muted }}>
                Value: <span style={{ color: isUnmapped ? '#e8a020' : text, fontWeight: '600', fontFamily: 'monospace' }}>{raw}</span>
              </div>
              <select value={vm[raw] || ''} onChange={e => setValueMapping(field.id, raw, e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: '7px', border: `1px solid ${isUnmapped ? '#e8a02088' : border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }}>
                <option value="">— Pick option —</option>
                {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <div style={{ fontSize: '11px', color: vm[raw] ? '#4caf50' : '#e8a020' }}>{vm[raw] || '⚠ unmapped'}</div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '20px' }}>
      <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '680px', border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>

        <div style={{ padding: '18px 24px 14px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: text, margin: 0 }}>Configure Field Mapping</h2>
            <div style={{ fontSize: '12px', color: muted, marginTop: '3px' }}>Map scanner data to your custom fields for {gameName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: '12px', padding: '10px 24px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          {['Your Custom Field', 'Scanner Key → Value', 'Preview'].map(h => (
            <div key={h} style={{ fontSize: '10px', fontWeight: '700', color: muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
          ))}
        </div>

        <div className="themed-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {rows.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: muted, fontSize: '13px' }}>
              No mappable fields for {gameName}.<br />
              <span style={{ fontSize: '12px' }}>Add Text, Number, or Dropdown fields (or add sub-fields to Checkbox/Radio) in Config first.</span>
            </div>
          )}
          {rows.map(row => renderRow(row))}
        </div>

        <div style={{ padding: '14px 24px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          <button onClick={() => onSave(localMappings)}
            style={{ width: '100%', padding: '11px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Save Mapping
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Gacha Config Modal (OUTSIDE GachaAccountsView to prevent remount) ──────
function GachaConfigModal({ configuringGame, configData, setConfigData, onSave, onClose, card, border, text, muted, bg, inputBg, sectionBg }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' }}>
      <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '500px', border: `1px solid ${border}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: text }}>🎰 {configuringGame?.name} — Gacha Config</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(configData.groups || []).map(group => (
            <div key={group.id} style={{ background: sectionBg, borderRadius: '10px', border: `1px solid ${border}`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${border}` }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: text }}>
                  {group.name} <span style={{ color: muted, fontWeight: '400', fontSize: '11px' }}>({(group.products || []).length} products)</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setConfigData(prev => ({ ...prev, expandedGroup: prev.expandedGroup === group.id ? null : group.id }))}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, fontSize: '12px' }}>
                    {configData.expandedGroup === group.id ? '▲' : '▼'}
                  </button>
                  <button onClick={() => setConfigData(prev => ({ ...prev, groups: prev.groups.filter(g => g.id !== group.id) }))}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={14} /></button>
                </div>
              </div>
              {configData.expandedGroup === group.id && (
                <div style={{ padding: '12px 14px' }}>
                  {(group.products || []).map((prod, j) => (
                    <div key={j} style={{ padding: '8px 10px', background: bg, borderRadius: '6px', marginBottom: '4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '500', color: text }}>{prod.title}</div>
                        <div style={{ fontSize: '11px', color: '#4caf50' }}>${prod.price}</div>
                        {(prod.suppliers || []).length > 0 && <div style={{ fontSize: '11px', color: muted }}>{prod.suppliers.map(s => s.name).join(', ')}</div>}
                      </div>
                      <button onClick={() => setConfigData(prev => ({
                        ...prev,
                        groups: prev.groups.map(g => g.id === group.id ? { ...g, products: g.products.filter((_, idx) => idx !== j) } : g)
                      }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={12} /></button>
                    </div>
                  ))}
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <input value={configData.newProductTitle || ''} onChange={e => setConfigData(prev => ({ ...prev, newProductTitle: e.target.value }))}
                      placeholder="Product title e.g. 80 Pulls"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }} />
                    <input type="number" value={configData.newProductPrice || ''} onChange={e => setConfigData(prev => ({ ...prev, newProductPrice: e.target.value }))}
                      placeholder="Price (USD)"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }} />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input value={configData.newSupplierName || ''} onChange={e => setConfigData(prev => ({ ...prev, newSupplierName: e.target.value }))}
                        placeholder="Supplier name"
                        style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }} />
                      <input value={configData.newSupplierLink || ''} onChange={e => setConfigData(prev => ({ ...prev, newSupplierLink: e.target.value }))}
                        placeholder="Supplier link"
                        style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }} />
                    </div>
                    <button onClick={() => {
                      if (!configData.newProductTitle?.trim()) return
                      const product = {
                        title: configData.newProductTitle,
                        price: configData.newProductPrice || '',
                        suppliers: configData.newSupplierName ? [{ name: configData.newSupplierName, link: configData.newSupplierLink || '' }] : []
                      }
                      setConfigData(prev => ({
                        ...prev,
                        groups: prev.groups.map(g => g.id === group.id ? { ...g, products: [...(g.products || []), product] } : g),
                        newProductTitle: '', newProductPrice: '', newSupplierName: '', newSupplierLink: ''
                      }))
                    }} style={{ width: '100%', padding: '8px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                      <Plus size={13} /> Add Product
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div style={{ background: sectionBg, borderRadius: '10px', padding: '14px', border: `1px solid ${border}` }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: text, marginBottom: '8px' }}>Add Group</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={configData.newGroupName || ''} onChange={e => setConfigData(prev => ({ ...prev, newGroupName: e.target.value }))}
                placeholder="Group name e.g. NA Server"
                style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }} />
              <button onClick={() => {
                if (!configData.newGroupName?.trim()) return
                setConfigData(prev => ({ ...prev, groups: [...(prev.groups || []), { id: uid(), name: prev.newGroupName, products: [] }], newGroupName: '' }))
              }} style={{ padding: '9px 14px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer' }}><Plus size={16} /></button>
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          <button onClick={onSave} style={{ width: '100%', padding: '11px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Gacha sub-view ──────────────────────────────────────────────
function GachaAccountsView({ games, gameConfigs, saveGameConfig, card, border, text, muted, bg, sectionBg }) {
  const [selectedGame, setSelectedGame] = useState(null)
  const [expandedGroup, setExpandedGroup] = useState(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [configuringGame, setConfiguringGame] = useState(null)
  const [configData, setConfigData] = useState({})
  const inputBg = card

  const gachaGames = games.filter(g => (g.sections || []).includes('gacha'))

  const getConfig = (gameId) => {
    const config = gameConfigs.find(c => c.game_id === gameId && c.section === 'gacha')
    return config?.config || { groups: [] }
  }

  const openConfig = (game, e) => {
    if (e) e.stopPropagation()
    const existing = getConfig(game.id)
    setConfiguringGame(game)
    setConfigData({
      groups: existing.groups || [],
      newGroupName: '', expandedGroup: null,
      newProductTitle: '', newProductPrice: '',
      newSupplierName: '', newSupplierLink: ''
    })
    setShowConfigModal(true)
  }

  const handleSaveConfig = async () => {
    if (!configuringGame || !saveGameConfig) return
    await saveGameConfig(configuringGame.id, 'gacha', { groups: configData.groups })
    setShowConfigModal(false)
    setConfiguringGame(null)
  }

  if (!selectedGame) {
    return (
      <>
        {gachaGames.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🎰</span>
            <div style={{ fontSize: '17px', fontWeight: '600', color: text, marginBottom: '8px' }}>No gacha games found</div>
            <div style={{ fontSize: '13px', color: muted }}>Add a game and enable the Gacha section first</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
            {gachaGames.map(game => {
              const config = getConfig(game.id)
              const groupCount = (config.groups || []).length
              const productCount = (config.groups || []).reduce((sum, g) => sum + (g.products || []).length, 0)
              return (
                <div key={game.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                  <button onClick={e => openConfig(game, e)} title="Configure gacha"
                    style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.4)'}>
                    <Settings size={13} />
                  </button>
                  <div onClick={() => setSelectedGame(game)} style={{ cursor: 'pointer' }}>
                    <div style={{ width: '100%', height: '100px', background: game.image ? `url(${game.image}) center/cover no-repeat` : '#e0525222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {!game.image && <span style={{ fontSize: '32px' }}>🎰</span>}
                    </div>
                    <div style={{ padding: '16px' }}>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: text, marginBottom: '6px' }}>{game.name}</div>
                      {groupCount > 0
                        ? <div style={{ fontSize: '12px', color: '#4caf50', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={10} /> {groupCount} groups • {productCount} products</div>
                        : <div style={{ fontSize: '12px', color: '#e8a020', display: 'flex', alignItems: 'center', gap: '4px' }}><Settings size={10} /> Configure groups first</div>
                      }
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {showConfigModal && configuringGame && (
          <GachaConfigModal
            configuringGame={configuringGame} configData={configData} setConfigData={setConfigData}
            onSave={handleSaveConfig} onClose={() => setShowConfigModal(false)}
            card={card} border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg}
          />
        )}
      </>
    )
  }

  const config = getConfig(selectedGame.id)
  const groups = config.groups || []

  return (
    <>
      <button onClick={() => setSelectedGame(null)}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: muted, fontSize: '13px', marginBottom: '20px', padding: 0 }}>
        <ArrowLeft size={15} /> Back to Games
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: selectedGame.image ? `url(${selectedGame.image}) center/cover no-repeat` : '#e0525222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!selectedGame.image && <span>🎰</span>}
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: text }}>{selectedGame.name}</h2>
            <p style={{ fontSize: '13px', color: muted, marginTop: '2px' }}>{groups.length} groups</p>
          </div>
        </div>
        <button onClick={e => openConfig(selectedGame, e)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '10px', cursor: 'pointer', fontSize: '14px' }}>
          <Settings size={15} /> Config
        </button>
      </div>
      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: card, borderRadius: '12px', border: `1px solid ${border}`, color: muted }}>
          No groups configured yet. Click Config to get started.
        </div>
      ) : groups.map(group => (
        <div key={group.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', marginBottom: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderBottom: expandedGroup === group.id ? `1px solid ${border}` : 'none' }}
            onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: text }}>{group.name}</div>
              <div style={{ fontSize: '12px', color: muted, marginTop: '2px' }}>{(group.products || []).length} products</div>
            </div>
            <span style={{ color: muted, fontSize: '12px' }}>{expandedGroup === group.id ? '▲' : '▼'}</span>
          </div>
          {expandedGroup === group.id && (
            <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(group.products || []).map((product, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: bg, borderRadius: '10px', border: `1px solid ${border}` }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: text }}>{product.title}</div>
                    {(product.suppliers || []).length > 0 && (
                      <div style={{ fontSize: '11px', color: muted, marginTop: '4px' }}>
                        {product.suppliers.map((s, j) => s.link
                          ? <a key={j} href={s.link} target="_blank" rel="noreferrer" style={{ color: '#2196f3', textDecoration: 'none', marginRight: '8px' }}>↗ {s.name}</a>
                          : <span key={j} style={{ marginRight: '8px' }}>{s.name}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#4caf50' }}>${product.price}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {showConfigModal && configuringGame && (
        <GachaConfigModal
          configuringGame={configuringGame} configData={configData} setConfigData={setConfigData}
          onSave={handleSaveConfig} onClose={() => setShowConfigModal(false)}
          card={card} border={border} text={text} muted={muted} bg={bg} inputBg={card} sectionBg={sectionBg}
        />
      )}
    </>
  )
}

// ─── Config Modal (OUTSIDE main component to prevent remount) ────
function convertTemplateToLabels(template, customFields) {
  if (!template) return template
  let result = template
  for (const cf of (customFields || [])) {
    result = result.replace(new RegExp(`\\{\\{${cf.id}\\}\\}`, 'g'), `{{${cf.label.toLowerCase()}}}`)
  }
  return result
}

function renderTemplate(template, fields, separator) {
  if (!template) return ''
  const sep = separator || ' | '
  const segments = template.split(sep)
  const rendered = segments.map(seg => {
    const vars = seg.match(/\{\{([^}]+)\}\}/g) || []
    for (const v of vars) {
      const key = v.slice(2, -2)
      const val = fields[key]
      if (val === undefined || val === null || val === '') return null
    }
    return seg.replace(/\{\{([^}]+)\}\}/g, (_, key) => fields[key] ?? '')
  }).filter(s => s !== null && s.trim() !== '')
  return rendered.join(sep)
}

// Builds label-based field lookup: { 'level': '50', 'server': 'NA', ... }
function buildLabelFields(accountFields, customFields) {
  const result = { ...accountFields }
  for (const cf of (customFields || [])) {
    const val = accountFields[cf.id]
    if (val != null) result[cf.label.toLowerCase()] = val
  }
  return result
}

// Builds category type variables: { 'skins category': 'Ahri + Kai\'Sa', 'icons category': 'S1 Chall', ... }
function buildCategoryFields(categories, accountFields, categoryLimits, isDesc) {
  const typeItems = {}
  for (const cat of (categories || [])) {
    const val = accountFields?.[`cat_${cat.id}`]
    if (!val) continue
    if (!typeItems[cat.type]) typeItems[cat.type] = []
    typeItems[cat.type].push(...val.split(', ').filter(Boolean))
  }
  const result = {}
  for (const [type, items] of Object.entries(typeItems)) {
    const tabLabel = CAT_TABS.find(t => t.type === type)?.label || type
    const varKey = `${tabLabel.toLowerCase()} category`
    const limit = !isDesc && categoryLimits?.[type] ? parseInt(categoryLimits[type]) : null
    const subset = (limit && limit > 0) ? items.slice(0, limit) : items
    if (subset.length > 0) result[varKey] = isDesc ? subset.join(', ') : subset.join(' + ')
  }
  return result
}

function TitleMakerTab({ configData, setConfigData, border, text, muted, inputBg, sectionBg }) {
  const titleRef = useRef(null)
  const descRef = useRef(null)
  const [titleVar, setTitleVar] = useState('')
  const [descVar, setDescVar] = useState('')

  // Build category type entries from checker categories (one per unique type, in encounter order)
  const catTypesWithLabel = []
  const seenTypes = new Set()
  for (const cat of (configData.checkerCategories || [])) {
    if (cat.type && !seenTypes.has(cat.type)) {
      seenTypes.add(cat.type)
      const tabLabel = CAT_TABS.find(t => t.type === cat.type)?.label || cat.type
      catTypesWithLabel.push({ type: cat.type, label: tabLabel, varKey: `${tabLabel.toLowerCase()} category` })
    }
  }

  const allVars = [
    ...(configData.customFields || []).map(f => ({ label: f.label, value: `{{${f.label.toLowerCase()}}}` })),
    ...catTypesWithLabel.map(ct => ({ label: `${ct.label} Category`, value: `{{${ct.varKey}}}` })),
    { label: 'Preview Link', value: '{{preview}}' },
  ]

  // Sample fields map for preview: field labels + category samples
  const previewFields = {
    ...Object.fromEntries((configData.customFields || []).map(f => [f.id, `[${f.label}]`])),
    ...Object.fromEntries((configData.customFields || []).map(f => [f.label.toLowerCase(), `[${f.label}]`])),
    ...Object.fromEntries(catTypesWithLabel.map(ct => [ct.varKey, `[${ct.label} Category]`])),
    preview: '[Preview Link]',
  }

  const insertAt = (ref, varVal, field) => {
    const el = ref.current
    if (!el || !varVal) return
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? start
    const cur = configData[field] || ''
    const next = cur.slice(0, start) + varVal + cur.slice(end)
    setConfigData(prev => ({ ...prev, [field]: next }))
    setTimeout(() => { el.focus(); el.setSelectionRange(start + varVal.length, start + varVal.length) }, 0)
  }

  const sep = configData.titleSeparator ?? ' | '

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '6px' }}>Segment Separator</label>
        <input value={sep} onChange={e => setConfigData(prev => ({ ...prev, titleSeparator: e.target.value }))}
          placeholder=" | "
          style={{ width: '160px', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }} />
        <div style={{ fontSize: '11px', color: muted, marginTop: '4px' }}>Segments split by this separator — if a variable in a segment is missing, the whole segment is dropped.</div>
      </div>

      <div>
        <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '6px' }}>Title Template</label>
        <textarea ref={titleRef} value={configData.titleTemplate || ''} onChange={e => setConfigData(prev => ({ ...prev, titleTemplate: e.target.value }))}
          placeholder={`e.g. [{{server}}]${sep}Lvl {{level}}${sep}{{rank}}`} rows={2}
          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'monospace' }} />
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
          <select value={titleVar} onChange={e => setTitleVar(e.target.value)}
            style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }}>
            <option value=''>— pick a field —</option>
            {allVars.map(v => <option key={v.value} value={v.value}>{v.label} → {v.value}</option>)}
          </select>
          <button onClick={() => { insertAt(titleRef, titleVar, 'titleTemplate'); setTitleVar('') }}
            style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#7E6551', color: '#FDF4DC', fontSize: '12px', cursor: 'pointer' }}>+ Insert</button>
        </div>
      </div>

      <div>
        <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '6px' }}>Description Template</label>
        <textarea ref={descRef} value={configData.descriptionTemplate || ''} onChange={e => setConfigData(prev => ({ ...prev, descriptionTemplate: e.target.value }))}
          placeholder={`e.g. Server: {{server}}${sep}Rank: {{rank}}${sep}Skins: {{total skins}}`} rows={4}
          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'monospace' }} />
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
          <select value={descVar} onChange={e => setDescVar(e.target.value)}
            style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }}>
            <option value=''>— pick a field —</option>
            {allVars.map(v => <option key={v.value} value={v.value}>{v.label} → {v.value}</option>)}
          </select>
          <button onClick={() => { insertAt(descRef, descVar, 'descriptionTemplate'); setDescVar('') }}
            style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#7E6551', color: '#FDF4DC', fontSize: '12px', cursor: 'pointer' }}>+ Insert</button>
        </div>
      </div>

      {catTypesWithLabel.length > 0 && (
        <div>
          <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '6px' }}>Category Limits <span style={{ fontWeight: '400' }}>(title only — 0 or blank = no limit)</span></label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {catTypesWithLabel.map(ct => (
              <div key={ct.type} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: text, width: '120px' }}>{ct.label}</span>
                <input type="number" min="0"
                  value={configData.categoryLimits?.[ct.type] ?? ''}
                  onChange={e => {
                    const v = parseInt(e.target.value)
                    setConfigData(prev => ({ ...prev, categoryLimits: { ...(prev.categoryLimits || {}), [ct.type]: isNaN(v) ? 0 : v } }))
                  }}
                  placeholder="0 = no limit"
                  style={{ width: '100px', padding: '5px 8px', borderRadius: '6px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {(configData.titleTemplate || configData.descriptionTemplate) && (
        <div style={{ padding: '12px', background: sectionBg, borderRadius: '8px', border: `1px solid ${border}` }}>
          <div style={{ fontSize: '11px', color: muted, marginBottom: '6px', fontWeight: '600' }}>PREVIEW (sample values)</div>
          {configData.titleTemplate && <div style={{ fontSize: '13px', color: text, marginBottom: '4px' }}><span style={{ color: muted, fontSize: '11px' }}>Title: </span>{renderTemplate(configData.titleTemplate, previewFields, sep) || <span style={{ color: muted, fontStyle: 'italic' }}>—</span>}</div>}
          {configData.descriptionTemplate && <div style={{ fontSize: '13px', color: text }}><span style={{ color: muted, fontSize: '11px' }}>Desc: </span>{renderTemplate(configData.descriptionTemplate, previewFields, sep) || <span style={{ color: muted, fontStyle: 'italic' }}>—</span>}</div>}
        </div>
      )}
    </div>
  )
}

function ConfigModal({ card, border, text, muted, bg, inputBg, sectionBg, configTab, setConfigTab, configData, setConfigData, configuringGame, onSave, onClose }) {
  const toggleSummaryField = (id) => {
    setConfigData(prev => {
      const already = prev.summaryFields.includes(id)
      if (already) return { ...prev, summaryFields: prev.summaryFields.filter(s => s !== id) }
      if (prev.summaryFields.length >= 3) return prev
      return { ...prev, summaryFields: [...prev.summaryFields, id] }
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' }}>
      <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '500px', border: `1px solid ${border}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: text }}>🎮 {configuringGame?.name} — Accounts Config</h2>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[{ key: 'fields', label: 'Custom Fields' }, { key: 'summary', label: 'Summary Fields' }, { key: 'titles', label: 'Title / Description' }].map(tab => (
              <button key={tab.key} onClick={() => setConfigTab(tab.key)}
                style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', background: configTab === tab.key ? '#7E6551' : sectionBg, color: configTab === tab.key ? '#FDF4DC' : muted, fontWeight: configTab === tab.key ? '500' : '400' }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {configTab === 'fields' && (
            <FieldEditor
              fields={configData.customFields}
              onFieldsChange={(newFields) => {
                const removedIds = configData.customFields
                  .filter(f => !newFields.find(nf => nf.id === f.id))
                  .map(f => f.id)
                setConfigData(prev => ({
                  ...prev,
                  customFields: newFields,
                  summaryFields: prev.summaryFields.filter(id => !removedIds.includes(id)),
                }))
              }}
              border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg}
              showTooltip={false} showVideoUrl={false}
            />
          )}

          {configTab === 'summary' && (
            <div>
              <div style={{ fontSize: '13px', color: muted, marginBottom: '12px' }}>Select up to 3 fields to show on account cards.</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {configData.customFields.map(f => {
                  const selected = configData.summaryFields.includes(f.id)
                  return (
                    <button key={f.id} onClick={() => toggleSummaryField(f.id)}
                      style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${selected ? '#7E6551' : border}`, background: selected ? '#7E6551' : 'transparent', color: selected ? '#FDF4DC' : muted, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {selected && <Check size={11} />}{f.label}
                    </button>
                  )
                })}
              </div>
              {configData.customFields.length === 0 && <div style={{ fontSize: '13px', color: muted }}>Add custom fields first.</div>}
              <div style={{ fontSize: '11px', color: muted, marginTop: '8px' }}>{configData.summaryFields.length}/3 selected</div>
            </div>
          )}

          {configTab === 'titles' && (
            <TitleMakerTab configData={configData} setConfigData={setConfigData} border={border} text={text} muted={muted} inputBg={inputBg} sectionBg={sectionBg} />
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          <button onClick={onSave}
            style={{ width: '100%', padding: '11px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Account Modal (OUTSIDE main component to prevent remount) ───
function AccountModal({ game, gameConfig, newAccount, setNewAccount, handleSave, handleStatusChange, onClose, editingAccount, card, border, text, muted, inputBg, bg, getSoldForLabel, platforms, saving, catConfig }) {
  // Filter platforms to only ones allowed for this game (empty = all allowed)
  const allowedPlatforms = (game?.allowedPlatformIds || []).length > 0
    ? platforms.filter(p => game.allowedPlatformIds.includes(p.id))
    : platforms
  const customFields = gameConfig?.customFields || []
  const [uploadErrors, setUploadErrors] = useState({})
  const [titleAutoFill, setTitleAutoFill] = useState(true)
  const [descAutoFill, setDescAutoFill] = useState(true)

  const titleTemplate = gameConfig?.titleTemplate || ''
  const descTemplate = gameConfig?.descriptionTemplate || ''
  const titleSeparator = gameConfig?.titleSeparator ?? ' | '

  const fieldsJson = JSON.stringify(newAccount.fields)
  const customFieldsKey = customFields.map(f => f.id).join(',')
  useEffect(() => {
    if (!titleAutoFill || !titleTemplate) return
    const f = newAccount.fields || {}
    const base = buildLabelFields(f, customFields)
    const cats = buildCategoryFields(catConfig?.categories, f, gameConfig?.categoryLimits, false)
    const fields = { ...base, ...cats, preview: '' }
    const rendered = renderTemplate(titleTemplate, fields, titleSeparator)
    setNewAccount(prev => prev.title === rendered ? prev : { ...prev, title: rendered })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleAutoFill, titleTemplate, titleSeparator, fieldsJson, customFieldsKey])

  useEffect(() => {
    if (!descAutoFill || !descTemplate) return
    const f = newAccount.fields || {}
    const base = buildLabelFields(f, customFields)
    const cats = buildCategoryFields(catConfig?.categories, f, null, true)
    const fields = { ...base, ...cats, preview: '' }
    const rendered = renderTemplate(descTemplate, fields, titleSeparator)
    setNewAccount(prev => prev.description === rendered ? prev : { ...prev, description: rendered })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descAutoFill, descTemplate, titleSeparator, fieldsJson, customFieldsKey])

  const scanId = newAccount.fields?._scanId || null
  const [scanShare, setScanShare] = useState({ expiresAt: null, hideName: false, loading: false, expiryOpt: 'never' })

  useEffect(() => {
    if (!scanId) return
    fetch(`/api/lol-skins/${scanId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) return
        let expiryOpt = 'never'
        if (d.expires_at) {
          const msLeft = new Date(d.expires_at) - Date.now()
          if (msLeft > 0) expiryOpt = msLeft < 2 * 86400000 ? '1d' : '1m'
        }
        setScanShare({ expiresAt: d.expires_at || null, hideName: d.hide_name || false, loading: false, expiryOpt })
      })
      .catch(() => {})
  }, [scanId])

  const patchScanShare = async (patch) => {
    if (!scanId) return
    setScanShare(prev => ({ ...prev, loading: true }))
    try {
      const res = await fetch(`/api/lol-skins/${scanId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      })
      const d = await res.json()
      if (!d.error) {
        let expiryOpt = 'never'
        if (d.expires_at) {
          const msLeft = new Date(d.expires_at) - Date.now()
          if (msLeft > 0) expiryOpt = msLeft < 2 * 86400000 ? '1d' : '1m'
        }
        setScanShare(prev => ({ ...prev, expiresAt: d.expires_at || null, hideName: d.hide_name ?? prev.hideName, loading: false, expiryOpt }))
      } else {
        setScanShare(prev => ({ ...prev, loading: false }))
      }
    } catch { setScanShare(prev => ({ ...prev, loading: false })) }
  }

  const setShareExpiry = (opt) => {
    let expiresAt = null
    if (opt === '1d') expiresAt = new Date(Date.now() + 86400000).toISOString()
    else if (opt === '1m') expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()
    setScanShare(prev => ({ ...prev, expiryOpt: opt }))
    patchScanShare({ expiresAt })
  }

  const handleMultiUpload = (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    const errors = {}
    files.forEach(file => {
      if (file.size > MAX_IMAGE_SIZE) {
        errors[file.name] = `${file.name} exceeds 3MB`
        return
      }
      const reader = new FileReader()
      reader.onload = (ev) => {
        setNewAccount(prev => {
          const emptySlot = prev.images.find(i => i.url === '')
          if (emptySlot) return { ...prev, images: prev.images.map(i => i.id === emptySlot.id ? { ...i, url: ev.target.result, mode: 'upload' } : i) }
          return { ...prev, images: [...prev.images, { id: uid(), url: ev.target.result, mode: 'upload' }] }
        })
      }
      reader.readAsDataURL(file)
    })
    if (Object.keys(errors).length > 0) setUploadErrors(errors)
  }

  const handleSingleUpload = (e, id) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > MAX_IMAGE_SIZE) {
      setUploadErrors(prev => ({ ...prev, [id]: 'Image exceeds 3MB limit' }))
      return
    }
    setUploadErrors(prev => { const n = { ...prev }; delete n[id]; return n })
    const reader = new FileReader()
    reader.onload = (ev) => setNewAccount(prev => ({ ...prev, images: prev.images.map(img => img.id === id ? { ...img, url: ev.target.result } : img) }))
    reader.readAsDataURL(file)
  }

  const clearImage = (id) => setNewAccount(prev => ({ ...prev, images: prev.images.map(img => img.id === id ? { ...img, url: '' } : img) }))
  const addImageSlot = () => setNewAccount(prev => ({ ...prev, images: [...prev.images, { id: uid(), url: '', mode: 'url' }] }))
  const removeImageSlot = (id) => {
    setNewAccount(prev => {
      const newImages = prev.images.filter(img => img.id !== id)
      return { ...prev, images: newImages.length > 0 ? newImages : [{ id: uid(), url: '', mode: 'url' }], thumbnailIndex: Math.min(prev.thumbnailIndex, Math.max(0, newImages.length - 1)) }
    })
  }
  const setThumbnail = (index) => setNewAccount(prev => ({ ...prev, thumbnailIndex: index }))
  const setImageMode = (id, mode) => setNewAccount(prev => ({ ...prev, images: prev.images.map(img => img.id === id ? { ...img, mode, url: '' } : img) }))
  const toggleTargetPlatform = (platformName) => {
    setNewAccount(prev => {
      const existing = (prev.targetPlatforms || []).find(p => p.platformName === platformName)
      return existing
        ? { ...prev, targetPlatforms: prev.targetPlatforms.filter(p => p.platformName !== platformName) }
        : { ...prev, targetPlatforms: [...(prev.targetPlatforms || []), { platformName, posted: false }] }
    })
  }
  const isTargeted = (platformName) => (newAccount.targetPlatforms || []).some(p => p.platformName === platformName)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '20px' }}>
      <style>{`
        .themed-scroll::-webkit-scrollbar{width:6px}
        .themed-scroll::-webkit-scrollbar-track{background:transparent}
        .themed-scroll::-webkit-scrollbar-thumb{background:#7E655166;border-radius:10px}
        .themed-scroll::-webkit-scrollbar-thumb:hover{background:#7E6551aa}
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
      <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '500px', border: `1px solid ${border}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '24px 28px 16px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '17px', fontWeight: '600', color: text }}>{editingAccount ? 'Edit Account' : `Save Account — ${game.name}`}</h2>
            <button onClick={onClose} disabled={saving} style={{ background: 'transparent', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: muted }}><X size={18} /></button>
          </div>
        </div>

        <div className="themed-scroll" style={{ padding: '20px 28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Title */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', color: muted }}>
                Title <span style={{ fontSize: '10px', background: '#7E655122', color: '#7E6551', padding: '1px 6px', borderRadius: '10px', marginLeft: '4px' }}>used for order matching</span>
              </label>
              {titleTemplate && (
                <button type="button" onClick={() => setTitleAutoFill(v => !v)}
                  style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', border: `1px solid ${titleAutoFill ? '#7E6551' : border}`, background: titleAutoFill ? '#7E655122' : 'transparent', color: titleAutoFill ? '#7E6551' : muted, cursor: 'pointer' }}>
                  {titleAutoFill ? '⚡ Auto' : '✎ Manual'}
                </button>
              )}
            </div>
            <input value={newAccount.title || ''} onChange={e => { setTitleAutoFill(false); setNewAccount(prev => ({ ...prev, title: e.target.value })) }} placeholder="e.g. [NA] Diamond II Account"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '14px', outline: 'none' }} />
          </div>

          {/* Description */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', color: muted }}>Description</label>
              {descTemplate && (
                <button type="button" onClick={() => setDescAutoFill(v => !v)}
                  style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', border: `1px solid ${descAutoFill ? '#7E6551' : border}`, background: descAutoFill ? '#7E655122' : 'transparent', color: descAutoFill ? '#7E6551' : muted, cursor: 'pointer' }}>
                  {descAutoFill ? '⚡ Auto' : '✎ Manual'}
                </button>
              )}
            </div>
            <textarea value={newAccount.description || ''} onChange={e => { setDescAutoFill(false); setNewAccount(prev => ({ ...prev, description: e.target.value })) }} placeholder="Account description…" rows={4}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {/* Preview Link (if created from scan) */}
          {scanId && (
            <div style={{ padding: '12px 14px', background: `${border}33`, border: `1px solid ${border}`, borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: muted, fontWeight: '500' }}>Preview Link</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <a href={`https://lolprev.site/preview/lol/${scanId}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: '11px', color: '#7E6551', textDecoration: 'none', padding: '3px 8px', border: '1px solid #7E655155', borderRadius: '4px' }}>
                    Open ↗
                  </a>
                  <button onClick={() => navigator.clipboard.writeText(`https://lolprev.site/preview/lol/${scanId}`)}
                    style={{ fontSize: '11px', color: muted, background: 'transparent', border: `1px solid ${border}`, borderRadius: '4px', padding: '3px 8px', cursor: 'pointer' }}>
                    Copy
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={scanShare.expiryOpt} onChange={e => setShareExpiry(e.target.value)}
                  disabled={scanShare.loading}
                  style={{ fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: `1px solid ${border}`, background: inputBg, color: text, cursor: 'pointer', outline: 'none', opacity: scanShare.loading ? 0.6 : 1 }}>
                  <option value="never">Never expire</option>
                  <option value="1d">Expire in 1 day</option>
                  <option value="1m">Expire in 1 month</option>
                </select>
                {scanShare.expiresAt && (
                  <span style={{ fontSize: '11px', color: muted }}>
                    Until {new Date(scanShare.expiresAt).toLocaleDateString()}
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                  <span style={{ fontSize: '12px', color: muted }}>Censor name</span>
                  <div onClick={() => !scanShare.loading && patchScanShare({ hideName: !scanShare.hideName })}
                    style={{ width: '34px', height: '18px', borderRadius: '9px', cursor: scanShare.loading ? 'not-allowed' : 'pointer', background: scanShare.hideName ? '#7E6551' : border, position: 'relative', transition: 'background 0.2s', opacity: scanShare.loading ? 0.5 : 1 }}>
                    <div style={{ position: 'absolute', top: '2px', left: scanShare.hideName ? '18px' : '2px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Priority */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: newAccount.postingPriority ? '#e8a02011' : bg, borderRadius: '8px', border: `1px solid ${newAccount.postingPriority ? '#e8a02044' : border}` }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: text }}>High Priority</div>
              <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>Shows at top of posting list</div>
            </div>
            <div onClick={() => setNewAccount(prev => ({ ...prev, postingPriority: prev.postingPriority ? 0 : 1 }))}
              style={{ width: '40px', height: '22px', borderRadius: '11px', cursor: 'pointer', background: newAccount.postingPriority ? '#e8a020' : border, position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: '3px', left: newAccount.postingPriority ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
          </div>

          {/* Status */}
          <div>
            <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '8px' }}>Status</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Object.keys(STATUS_COLORS).map(s => (
                <button key={s} onClick={() => handleStatusChange(s)}
                  style={{ padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', border: `1px solid ${newAccount.status === s ? STATUS_COLORS[s].color : border}`, background: newAccount.status === s ? STATUS_COLORS[s].bg : 'transparent', color: newAccount.status === s ? STATUS_COLORS[s].color : muted, fontWeight: newAccount.status === s ? '500' : '400' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Bought For / Sold For */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', minWidth: 0 }}>
            <div>
              <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '6px' }}>Bought For</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <select value={newAccount.boughtForCurrency || 'USD'} onChange={e => setNewAccount(prev => ({ ...prev, boughtForCurrency: e.target.value }))}
                  style={{ width: '72px', flexShrink: 0, padding: '10px 4px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '11px', outline: 'none', cursor: 'pointer' }}>
                  {CURRENCY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
                <input type="number" value={newAccount.boughtFor || ''} onChange={e => setNewAccount(prev => ({ ...prev, boughtFor: parseFloat(e.target.value) || 0 }))} placeholder="0.00"
                  style={{ width: 0, flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '14px', outline: 'none' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '6px' }}>{getSoldForLabel(newAccount.status)}</label>
              {newAccount.status === 'Lost' ? (
                <div style={{ padding: '10px 14px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: '#e05252', fontSize: '14px' }}>0.00 (auto)</div>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select value={newAccount.soldForCurrency || 'USD'} onChange={e => setNewAccount(prev => ({ ...prev, soldForCurrency: e.target.value }))}
                    style={{ width: '72px', flexShrink: 0, padding: '10px 4px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '11px', outline: 'none', cursor: 'pointer' }}>
                    {CURRENCY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                  <input type="number" value={newAccount.soldFor || ''} onChange={e => setNewAccount(prev => ({ ...prev, soldFor: parseFloat(e.target.value) || 0 }))} placeholder="0.00"
                    style={{ width: 0, flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '14px', outline: 'none' }} />
                </div>
              )}
            </div>
          </div>

          {/* Target Platforms */}
          {allowedPlatforms && allowedPlatforms.length > 0 && (
            <div>
              <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '8px' }}>Target Platforms</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {allowedPlatforms.map(p => (
                  <button key={p.id} onClick={() => toggleTargetPlatform(p.name)}
                    style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${isTargeted(p.name) ? '#7E6551' : border}`, background: isTargeted(p.name) ? '#7E655122' : 'transparent', color: isTargeted(p.name) ? '#7E6551' : muted, fontSize: '13px', cursor: 'pointer', fontWeight: isTargeted(p.name) ? '500' : '400', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {isTargeted(p.name) && <Check size={11} />} {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Fields */}
          <FieldRenderer
            fields={customFields}
            values={newAccount.fields}
            onChange={(fieldId, value) => setNewAccount(prev => ({ ...prev, fields: { ...prev.fields, [fieldId]: value } }))}
            border={border} text={text} muted={muted} inputBg={inputBg}
          />

          {/* Images */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', color: muted }}>Images</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#7E6551', cursor: 'pointer', padding: '4px 10px', borderRadius: '8px', border: `1px solid #7E655144`, background: '#7E655112' }}>
                <Upload size={12} /> Upload multiple
                <input type="file" accept="image/*" multiple onChange={handleMultiUpload} style={{ display: 'none' }} />
              </label>
            </div>

            {/* 3MB notice */}
            <div style={{ fontSize: '11px', color: muted, marginBottom: '10px', padding: '6px 10px', background: '#7E655108', borderRadius: '6px', border: `1px solid #7E655122` }}>
              ⚠ Max 3MB per image. Large images may slow down saving.
            </div>

            {/* Upload errors */}
            {Object.values(uploadErrors).length > 0 && (
              <div style={{ marginBottom: '10px', padding: '10px 12px', background: '#e0525211', border: '1px solid #e0525233', borderRadius: '8px' }}>
                {Object.values(uploadErrors).map((err, i) => (
                  <div key={i} style={{ fontSize: '12px', color: '#e05252' }}>⚠ {err}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {newAccount.images.map((img, index) => (
                <div key={`modal-img-${img.id}`} style={{ background: bg, borderRadius: '10px', padding: '12px', border: `1px solid ${border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: muted }}>Image {index + 1}</span>
                      <button onClick={() => setThumbnail(index)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', cursor: 'pointer', border: 'none', background: newAccount.thumbnailIndex === index ? '#7E6551' : '#7E655122', color: newAccount.thumbnailIndex === index ? '#FDF4DC' : '#7E6551' }}>
                        <Star size={10} fill={newAccount.thumbnailIndex === index ? '#FDF4DC' : 'none'} />
                        {newAccount.thumbnailIndex === index ? 'Thumbnail' : 'Set as thumbnail'}
                      </button>
                    </div>
                    {newAccount.images.length > 1 && <button onClick={() => removeImageSlot(img.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={14} /></button>}
                  </div>
                  {img.url ? (
                    <div style={{ position: 'relative' }}>
                      <img src={img.url} alt="preview" style={{ width: '100%', height: '100px', objectFit: 'contain', background: '#000', borderRadius: '8px' }} />
                      <button onClick={() => clearImage(img.id)} style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                        {['url', 'upload'].map(mode => (
                          <button key={mode} onClick={() => setImageMode(img.id, mode)}
                            style={{ flex: 1, padding: '6px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', border: `1px solid ${border}`, background: img.mode === mode ? '#7E6551' : inputBg, color: img.mode === mode ? '#FDF4DC' : muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            {mode === 'url' ? <><Link size={11} /> Paste URL</> : <><Upload size={11} /> Upload</>}
                          </button>
                        ))}
                      </div>
                      {img.mode === 'url' ? (
                        <input value={img.url} onChange={e => setNewAccount(prev => ({ ...prev, images: prev.images.map(i => i.id === img.id ? { ...i, url: e.target.value } : i) }))} placeholder="https://example.com/image.jpg"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }} />
                      ) : (
                        <input type="file" accept="image/*" onChange={e => handleSingleUpload(e, img.id)}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }} />
                      )}
                      {uploadErrors[img.id] && <div style={{ fontSize: '11px', color: '#e05252', marginTop: '4px' }}>⚠ {uploadErrors[img.id]}</div>}
                    </>
                  )}
                </div>
              ))}
              <button onClick={addImageSlot} style={{ width: '100%', padding: '10px', background: 'transparent', border: `1px dashed ${border}`, borderRadius: '8px', cursor: 'pointer', color: muted, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Plus size={14} /> Add another image
              </button>
            </div>
          </div>
        </div>

        {/* Save Button with saving state */}
        <div style={{ padding: '16px 28px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          {!editingAccount && (
            <div style={{ fontSize: '11px', color: muted, textAlign: 'center', marginBottom: '8px' }}>
              Preview link will be generated automatically after saving.
            </div>
          )}
          {saving ? (
            <div style={{ width: '100%', padding: '12px', background: '#7E655188', color: '#FDF4DC', borderRadius: '10px', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <div style={{ width: '16px', height: '16px', border: '2px solid #FDF4DC44', borderTop: '2px solid #FDF4DC', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Saving account...
            </div>
          ) : (
            <button onClick={handleSave}
              style={{ width: '100%', padding: '12px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
              {editingAccount ? 'Save Changes' : 'Save Account'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Accounts Component ─────────────────────────────────────
export default function Accounts({ darkMode, games, gameConfigs, accounts, platforms, addAccount, updateAccount, deleteAccount, bulkAddAccounts, setActivePage, currency, exchangeRates, saveGameConfig, toolImportScanId, toolImportGameId, onToolImportDone }) {
  const [accountsSubTab, setAccountsSubTab] = useState('accounts')
  const [selectedGame, setSelectedGame] = useState(null)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showAddChoice, setShowAddChoice] = useState(false)
  // 0=choose 1=run_scanner 2=open_league 3=scanning 4=data_preview
  const [checkerStep, setCheckerStep] = useState(0)
  const [checkerData, setCheckerData] = useState(null)   // mapped field values for account creation
  const [checkerError, setCheckerError] = useState(null)
  const [scanData, setScanData]           = useState(null)   // raw scan result
  const [scanPreviewId, setScanPreviewId] = useState(null)   // lol_skin_scans UUID
  const [scanOwnerToken, setScanOwnerToken] = useState(null) // owner_token for overview link
  const [scannerOnline, setScannerOnline] = useState(false)
  const [scannerVersion, setScannerVersion] = useState(null)
  const [leagueOpen, setLeagueOpen]       = useState(false)
  const [showFieldMapper, setShowFieldMapper]                 = useState(false)
  const [scannerMapping, setScannerMapping]                   = useState(null)

  const [linkSettings, setLinkSettings]                       = useState({ hideIgn: false, expiry: 'never', oge: false, ogi: false, ogiPartial: false, ogiVerified: false, showPrice: false, priceAmount: '', priceCurrency: 'USD' })
  const [generatingLink, setGeneratingLink]                   = useState(false)
  const [generatingLinkError, setGeneratingLinkError]         = useState(null)
  const [editingLinkSettings, setEditingLinkSettings]         = useState(false)
  const [infoModal, setInfoModal]                             = useState(null) // 'oge' | 'ogi' | null
  const [scanRetryActive, setScanRetryActive]                 = useState(false)
  const [scanRetryElapsed, setScanRetryElapsed]               = useState(0)
  const [versionMismatch, setVersionMismatch]                 = useState(false)
  const [ownerLinkCopyWarning, setOwnerLinkCopyWarning]       = useState(false)
  const [copiedCardId, setCopiedCardId]                       = useState(null)
  const [toolImportLoading, setToolImportLoading]             = useState(false)
  const scanCancelRef                                         = useRef(false)
  const pendingScanDataRef                                    = useRef(null) // snapshot of scanData when Save Account is clicked
  const importRunRef                                          = useRef(null) // tracks which scanId we already processed
  const [editingAccount, setEditingAccount] = useState(null)
  const [saving, setSaving] = useState(false)
  const [newAccount, setNewAccount] = useState({ title: '', description: '', status: 'Available', fields: {}, images: [], thumbnailIndex: 0, boughtFor: 0, soldFor: 0, boughtForCurrency: 'USD', soldForCurrency: 'USD', targetPlatforms: [], postingPriority: 0 })
  const [mainImageIndex, setMainImageIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [statusTab, setStatusTab] = useState('All')
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [configuringGame, setConfiguringGame] = useState(null)
  const [configTab, setConfigTab] = useState('fields')
  const [configData, setConfigData] = useState({ customFields: [], summaryFields: [], scriptUrl: '' })

  const card = darkMode ? '#1e1e1e' : '#fff'
  const border = darkMode ? '#2e2e2e' : '#e8d9b8'
  const text = darkMode ? '#FDF4DC' : '#151515'
  const muted = darkMode ? '#a08570' : '#7E6551'
  const bg = darkMode ? '#151515' : '#FDF4DC'
  const inputBg = darkMode ? '#2a2a2a' : '#fff'
  const sectionBg = darkMode ? '#252525' : '#f9f4ea'
  const cur = currency || '$'
  const curCode = CURRENCY_CODES[cur] || 'USD'

  const accountGames = games.filter(g => (g.sections || []).includes('accounts'))
  const allGameAccounts = selectedGame ? accounts.filter(a => a.gameId === selectedGame.id) : []
  const gameAccounts = statusTab === 'All' ? allGameAccounts : allGameAccounts.filter(a => a.status === statusTab)

  const getGameConfig = (gameId) => {
    const config = gameConfigs.find(c => c.game_id === gameId && c.section === 'accounts')
    return config?.config || { customFields: [], summaryFields: [], scriptUrl: '' }
  }

  const isConfigured = (gameId) => (getGameConfig(gameId).customFields || []).length > 0

  const displayAmount = (amount, fromCurrency) => {
    if (!exchangeRates || !amount) return `${cur}${Number(amount || 0).toFixed(2)}`
    const converted = convertAmount(Number(amount) || 0, fromCurrency || 'USD', curCode, exchangeRates)
    return `${cur}${(converted || 0).toFixed(2)}`
  }

  const getSoldForLabel = (status) => {
    switch (status) {
      case 'Sold': return 'Sold For'
      case 'Lost': return 'Lost For'
      default: return 'Selling For'
    }
  }

  const handleStatusChange = (status) => {
    setNewAccount(prev => ({ ...prev, status, soldFor: status === 'Lost' ? 0 : prev.soldFor }))
  }

  const openConfigModal = (game, e) => {
    if (e) e.stopPropagation()
    const existing = getGameConfig(game.id)
    const catConfig = getCheckerCategoriesConfig(game.id)
    const customFields = existing.customFields || []
    setConfiguringGame(game)
    setConfigData({
      customFields,
      summaryFields: existing.summaryFields || [],
      scriptUrl: existing.scriptUrl || '',
      titleTemplate: convertTemplateToLabels(existing.titleTemplate || '', customFields),
      descriptionTemplate: convertTemplateToLabels(existing.descriptionTemplate || '', customFields),
      titleSeparator: existing.titleSeparator ?? ' | ',
      categoryLimits: existing.categoryLimits || {},
      checkerCategories: catConfig.categories || [],
    })
    setConfigTab('fields')
    setShowConfigModal(true)
  }

  const handleSaveConfig = async () => {
    if (!configuringGame) return
    await saveGameConfig(configuringGame.id, 'accounts', {
      customFields: configData.customFields,
      summaryFields: configData.summaryFields,
      scriptUrl: configData.scriptUrl,
      titleTemplate: configData.titleTemplate || '',
      descriptionTemplate: configData.descriptionTemplate || '',
      titleSeparator: configData.titleSeparator ?? ' | ',
      categoryLimits: configData.categoryLimits || {},
    })
    setShowConfigModal(false)
    setConfiguringGame(null)
  }

  // Handle tool import — navigate to game + show loading, then open modal with prefilled data
  useEffect(() => {
    if (!toolImportScanId || !games.length) return
    if (importRunRef.current === toolImportScanId) return
    importRunRef.current = toolImportScanId

    const targetGame = (toolImportGameId ? games.find(g => g.id === toolImportGameId) : null)
      || games.find(g => g.scriptEnabled && g.scannerType === 'lol')
      || games[0]
    if (!targetGame) { onToolImportDone?.(); return }

    // Navigate to game and show loading spinner — user knows something is happening
    setSelectedGame(targetGame)
    setToolImportLoading(true)
    setScanPreviewId(toolImportScanId)
    onToolImportDone?.()

    const openForm = (prefillFields, scanOwnerTok, priceSoldFor, priceCurrency) => {
      setEditingAccount(null)
      pendingScanDataRef.current = null
      if (scanOwnerTok) setScanOwnerToken(scanOwnerTok)
      setNewAccount({ title: '', description: '', status: 'Available', fields: prefillFields || {}, images: [{ id: uid(), url: '', mode: 'url' }], thumbnailIndex: 0, boughtFor: 0, soldFor: priceSoldFor || 0, boughtForCurrency: 'USD', soldForCurrency: priceCurrency || 'USD', targetPlatforms: [], postingPriority: 0 })
      setShowModal(true)
      setToolImportLoading(false)
    }

    fetch(`/api/lol-skins/${toolImportScanId}`)
      .then(r => r.json())
      .then(scan => {
        if (scan.error) { openForm({}, null, 0, 'USD'); return }
        const raw = {
          summonerName: scan.summoner_name, tagLine: scan.tag_line, region: scan.region,
          profileIconId: scan.profile_icon_id, summonerLevel: scan.summoner_level,
          soloRank: scan.solo_rank, flexRank: scan.flex_rank,
          soloPeakRank: scan.solo_peak_rank, soloPrevRank: scan.solo_prev_rank,
          rp: scan.rp, be: scan.be, ownedSkinIds: scan.owned_skin_ids,
          lootSummary: scan.loot_summary, rankHistory: scan.rank_history,
          champCount: scan.champ_count, ownedChromaIds: scan.owned_chroma_ids,
          ownedEmoteIds: scan.owned_emote_ids, ownedIconIds: scan.owned_icon_ids,
          championMastery: scan.champion_mastery,
        }
        const flat = flattenScanData(raw)
        const mapping = getScannerMapping(targetGame.id)
        const cf = getGameConfig(targetGame.id)?.customFields || []
        const prefillFields = applyMapping(flat, mapping, cf)
        openForm(prefillFields, scan.owner_token || null, scan.price_amount ?? 0, scan.price_currency || 'USD')
      })
      .catch(() => openForm({}, null, 0, 'USD'))
  }, [toolImportScanId, toolImportGameId, games])

  // Poll vault-scanner on localhost every 2s while automatic modal is open
  useEffect(() => {
    if (!(showAddChoice && checkerStep >= 1)) return
    const poll = async () => {
      try {
        const r = await fetch(`http://localhost:35199/ping?t=${Date.now()}`, { signal: AbortSignal.timeout(1500), cache: 'no-store' })
        if (r.ok) {
          const d = await r.json()
          const versionMatch = d.version === EXPECTED_SCANNER_VERSION
          setScannerOnline(versionMatch)
          setScannerVersion(d.version || null)
          setLeagueOpen(versionMatch ? !!d.leagueOpen : false)
        } else {
          setScannerOnline(false); setScannerVersion(null); setLeagueOpen(false)
        }
      } catch {
        setScannerOnline(false); setScannerVersion(null); setLeagueOpen(false)
      }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [showAddChoice, checkerStep])

  // ── Scanner helpers ────────────────────────────────────────────────────────

  function flattenScanData(raw) {
    const l = raw.lootSummary || {}
    const fmt = tier => tier ? (String(tier).charAt(0) + String(tier).slice(1).toLowerCase()) : null
    return {
      summonerName:       raw.summonerName   || '',
      tagLine:            raw.tagLine        || '',
      summonerLevel:      raw.summonerLevel  ?? null,
      profileIconId:      raw.profileIconId  ?? null,
      region:             raw.region         || '',
      soloRank:           fmt(raw.soloRank)  || 'Unranked',
      flexRank:           fmt(raw.flexRank)  || 'Unranked',
      tftRank:            fmt(raw.tftRank)   || 'Unranked',
      rp:                 raw.rp             ?? null,
      be:                 raw.be             ?? null,
      oe:                 l.oe               ?? null,
      me:                 l.me               ?? null,
      hexChests:          l.hexChests        ?? null,
      hexKeys:            l.hexKeys          ?? null,
      capsules:           l.capsules         ?? null,
      skinCount:          (raw.ownedSkinIds       || []).length,
      skinsOwned:         (raw.ownedSkinIds       || []).length,
      chromaCount:        (raw.ownedChromaIds     || []).length,
      emoteCount:         (raw.ownedEmoteIds      || []).length,
      iconCount:          (raw.ownedIconIds       || []).length,
      wardCount:          (raw.ownedWardIds       || []).length,
      finisherCount:      (raw.ownedFinisherIds   || []).length,
      tftCompanionCount:  (raw.tftCompanionIds    || []).length,
      tftMapSkinCount:    (raw.tftMapSkinIds      || []).length,
      tftDamageSkinCount: (raw.tftDamageSkinIds   || []).length,
    }
  }

  const SCANNER_KEY_LABELS = {
    summonerName: 'Summoner Name', tagLine: 'Tag Line', summonerLevel: 'Level',
    profileIconId: 'Profile Icon ID', region: 'Region/Server',
    soloRank: 'Solo/Duo Rank', flexRank: 'Flex Rank', tftRank: 'TFT Rank',
    rp: 'RP', be: 'Blue Essence', oe: 'Orange Essence', me: 'Mythic Essence',
    hexChests: 'Hextech Chests', hexKeys: 'Keys / Fragments', capsules: 'Capsules',
    skinCount: 'Total Skins', chromaCount: 'Total Chromas', emoteCount: 'Total Emotes',
    iconCount: 'Total Icons', wardCount: 'Total Wards', finisherCount: 'Total Finishers',
    tftCompanionCount: 'TFT Companions', tftMapSkinCount: 'TFT Arenas', tftDamageSkinCount: 'TFT Booms',
  }

  const getScannerMapping = (gameId) => {
    if (scannerMapping?.gameId === gameId) return scannerMapping.mapping
    const cfg = gameConfigs.find(c => c.game_id === gameId && c.section === 'scanner_mapping')
    return cfg?.config || { fieldMappings: {}, valueMappings: {} }
  }

  const getCheckerCategoriesConfig = (gameId) => {
    const cfg = gameConfigs.find(c => c.game_id === gameId && c.section === 'checker_categories')
    return cfg?.config || { categories: [] }
  }


  function evaluateCategories(scanRaw, categories) {
    const ownedByType = {
      skins:            new Set(scanRaw.ownedSkinIds || []),
      emotes:           new Set(scanRaw.ownedEmoteIds || []),
      icons:            new Set(scanRaw.ownedIconIds || []),
      wards:            new Set(scanRaw.ownedWardIds || []),
      chromas:          new Set(scanRaw.ownedChromaIds || []),
      finishers:        new Set(scanRaw.ownedFinisherIds || []),
      tft_companions:   new Set(scanRaw.tftCompanionIds || []),
      tft_map_skins:    new Set(scanRaw.tftMapSkinIds || []),
      tft_damage_skins: new Set(scanRaw.tftDamageSkinIds || []),
    }
    const result = {}
    for (const cat of categories) {
      const owned = ownedByType[cat.type]
      if (!owned) continue
      const matches = (cat.items || [])
        .filter(item => owned.has(item.id))
        .sort((a, b) => b.stars - a.stars)
        .map(item => item.name)
      if (matches.length > 0) result[`cat_${cat.id}`] = matches.join(', ')
    }
    return result
  }

  const getScannerKeyLabels = (gameId) => {
    const cats = getCheckerCategoriesConfig(gameId).categories || []
    const catLabels = {}
    for (const cat of cats) catLabels[`cat_${cat.id}`] = `[Cat] ${cat.name}`
    return { ...SCANNER_KEY_LABELS, ...catLabels }
  }

  function applyMapping(flatData, mapping, customFields) {
    const { fieldMappings = {}, valueMappings = {} } = mapping
    const result = {}
    for (const [fieldId, scanKey] of Object.entries(fieldMappings)) {
      // Find field in top-level or as a sub-field (conditionalFields)
      let field = customFields.find(f => f.id === fieldId)
      let parentField = null
      if (!field) {
        for (const pf of customFields) {
          const cf = pf.conditionalFields || {}
          for (const subs of Object.values(cf)) {
            const sub = (subs || []).find(s => s.id === fieldId)
            if (sub) { field = sub; parentField = pf; break }
          }
          if (field) break
        }
      }
      if (!field || flatData[scanKey] == null) continue
      if (field.type === 'Dropdown') {
        const vm = valueMappings[fieldId] || {}
        const mapped = vm[String(flatData[scanKey])]
        if (mapped != null) {
          result[fieldId] = mapped
          if (parentField?.type === 'Checkbox') result[parentField.id] = 'true'
        }
      } else {
        result[fieldId] = String(flatData[scanKey])
        if (parentField?.type === 'Checkbox') result[parentField.id] = 'true'
      }
    }
    return result
  }

  function findUnmappedValues(flatData, mapping, customFields) {
    const { fieldMappings = {}, valueMappings = {} } = mapping
    const unmapped = []
    // Build flat lookup of all fields (top-level + sub-fields)
    const allFields = {}
    for (const f of customFields) {
      allFields[f.id] = f
      for (const subs of Object.values(f.conditionalFields || {})) {
        for (const sub of (subs || [])) allFields[sub.id] = sub
      }
    }
    for (const [fieldId, scanKey] of Object.entries(fieldMappings)) {
      const field = allFields[fieldId]
      if (!field || field.type !== 'Dropdown') continue
      const raw = String(flatData[scanKey] ?? '')
      if (!raw) continue
      const vm = valueMappings[fieldId] || {}
      if (vm[raw] == null) {
        unmapped.push({ fieldId, fieldLabel: field.label, scanKey, rawValue: raw, options: field.options || [] })
      }
    }
    return unmapped
  }

  const handleScan = async () => {
    setCheckerStep(3); setCheckerError(null); setScanData(null); setScanPreviewId(null); setScanOwnerToken(null)
    setScanRetryActive(false); setScanRetryElapsed(0); setVersionMismatch(false)
    scanCancelRef.current = false
    const startTime = Date.now()

    while (true) {
      if (scanCancelRef.current) {
        setCheckerError('Scan cancelled.')
        setCheckerStep(4)
        return
      }
      try {
        const res = await fetch('http://localhost:35199/scan', { method: 'POST', signal: AbortSignal.timeout(120000) })
        const raw = await res.json()
        if (!res.ok) throw new Error(raw.error || 'Scan failed')

        // Version check
        if (raw._scannerVersion && raw._scannerVersion !== EXPECTED_SCANNER_VERSION) {
          setVersionMismatch(true)
          setCheckerError(`AIO Tool is outdated (found v${raw._scannerVersion}, need v${EXPECTED_SCANNER_VERSION}). Please download the latest version.`)
          setCheckerStep(4)
          return
        }

        const skinCount = (raw.ownedSkinIds || []).length
        const elapsed = Date.now() - startTime

        // Retry if no skins and still within 2 minutes
        if (skinCount === 0 && elapsed < 120000) {
          setScanRetryActive(true)
          setScanRetryElapsed(elapsed)
          await new Promise(r => setTimeout(r, 5000))
          continue
        }

        setScanRetryActive(false)
        setScanData(raw)

        // Determine mapped data for account fields
        const customFields = getGameConfig(selectedGame.id).customFields || []
        const mapping = getScannerMapping(selectedGame.id)
        const catConfig = getCheckerCategoriesConfig(selectedGame.id)
        const catResults = evaluateCategories(raw, catConfig.categories || [])
        const flat = { ...flattenScanData(raw), ...catResults }

        const hasMappings = Object.keys(mapping.fieldMappings || {}).length > 0
        if (hasMappings) {
          const unmapped = findUnmappedValues(flat, mapping, customFields)
          if (unmapped.length === 0) {
            setCheckerData(applyMapping(flat, mapping, customFields))
          } else {
            setCheckerData(null)
          }
        }

        setCheckerStep(4)
        return
      } catch (e) {
        setCheckerError(e.message); setCheckerStep(4)
        return
      }
    }
  }

  const handleGenerateLink = async () => {
    if (!scanData || generatingLink) return
    setGeneratingLink(true)
    setGeneratingLinkError(null)
    try {
      let expiresAt = null
      if (linkSettings.expiry === '1d') expiresAt = new Date(Date.now() + 86400000).toISOString()
      else if (linkSettings.expiry === '1m') expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()

      const linkPayload = {
        hideName:    linkSettings.hideIgn,
        expiresAt,
        oge:         linkSettings.oge,
        ogi:         linkSettings.ogi,
        ogiPartial:  linkSettings.ogiPartial,
        ogiVerified: linkSettings.ogiVerified,
        priceAmount: linkSettings.showPrice && linkSettings.priceAmount ? parseFloat(linkSettings.priceAmount) : null,
        priceCurrency: linkSettings.showPrice ? linkSettings.priceCurrency : null,
      }

      if (scanPreviewId) {
        // Update existing record
        const res = await fetch(`/api/lol-skins/${scanPreviewId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(linkPayload),
        })
        const stored = await res.json()
        if (stored.error) setGeneratingLinkError(stored.error)
        else setEditingLinkSettings(false)
      } else {
        // Create new record
        const res = await fetch('/api/lol-skins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...scanData, ...linkPayload }),
        })
        const stored = await res.json()
        if (stored.error) setGeneratingLinkError(stored.error)
        else { setScanPreviewId(stored.id); setScanOwnerToken(stored.owner_token) }
      }
    } catch (err) {
      setGeneratingLinkError(err.message)
    } finally {
      setGeneratingLink(false)
    }
  }

  const handleSaveMapping = async (gameId, mapping) => {
    setScannerMapping({ gameId, mapping })
    if (saveGameConfig) {
      await saveGameConfig(gameId, 'scanner_mapping', mapping).catch(() => {})
    }
    // Re-apply mapping now that it's saved
    if (scanData) {
      const customFields = getGameConfig(gameId).customFields || []
      const catResults = evaluateCategories(scanData, getCheckerCategoriesConfig(gameId).categories || [])
      const flat = { ...flattenScanData(scanData), ...catResults }
      const unmapped = findUnmappedValues(flat, mapping, customFields)
      if (unmapped.length === 0) {
        setCheckerData(applyMapping(flat, mapping, customFields))
      }
    }
  }

  const handleOpenAdd = (prefillFields = {}, prefillSoldFor = null, prefillSoldForCurrency = null) => {
    setEditingAccount(null)
    pendingScanDataRef.current = scanData // snapshot so save works even if checker modal closes
    setNewAccount({ title: '', description: '', status: 'Available', fields: prefillFields, images: [{ id: uid(), url: '', mode: 'url' }], thumbnailIndex: 0, boughtFor: 0, soldFor: prefillSoldFor ?? 0, boughtForCurrency: 'USD', soldForCurrency: prefillSoldForCurrency || 'USD', targetPlatforms: [], postingPriority: 0 })
    setShowModal(true)
  }

  const handleOpenEdit = (account) => {
    setEditingAccount(account.id)
    setNewAccount({
      title: account.title || '', description: account.description || '', status: account.status, fields: { ...account.fields },
      images: account.images && account.images.length > 0 ? [...account.images] : [{ id: uid(), url: '', mode: 'url' }],
      thumbnailIndex: account.thumbnailIndex || 0, boughtFor: account.boughtFor || 0, soldFor: account.soldFor || 0,
      boughtForCurrency: account.boughtForCurrency || 'USD', soldForCurrency: account.soldForCurrency || 'USD',
      targetPlatforms: account.targetPlatforms || [], postingPriority: account.postingPriority || 0,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const cleanImages = newAccount.images.filter(img => img.url && img.url.trim() !== '')
      const soldFor = newAccount.status === 'Lost' ? 0 : (newAccount.soldFor || 0)
      const saveConfig = getGameConfig(selectedGame.id)
      const saveCustomFields = saveConfig.customFields || []
      const cleanFields = stripHiddenConditionalValues(saveCustomFields, newAccount.fields)
      const payload = {
        gameId: selectedGame.id, title: newAccount.title || '', description: newAccount.description || '',
        status: newAccount.status,
        fields: cleanFields, images: cleanImages, thumbnailIndex: newAccount.thumbnailIndex,
        boughtFor: newAccount.boughtFor || 0, soldFor,
        boughtForCurrency: newAccount.boughtForCurrency || 'USD', soldForCurrency: newAccount.soldForCurrency || 'USD',
        targetPlatforms: newAccount.targetPlatforms || [], postingPriority: newAccount.postingPriority || 0,
      }
      if (editingAccount) {
        await updateAccount({ ...payload, id: editingAccount })
        if (selectedAccount && selectedAccount.id === editingAccount) setSelectedAccount(prev => ({ ...prev, ...payload }))
      } else {
        const savedAccount = await addAccount(payload)

        // Generate preview link if this came from a checker scan (new scan record needed)
        const activeScanData = pendingScanDataRef.current
        if (activeScanData && !scanPreviewId) {
          try {
            let expiresAt = null
            if (linkSettings.expiry === '1d') expiresAt = new Date(Date.now() + 86400000).toISOString()
            else if (linkSettings.expiry === '1m') expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()

            const thumbnailUrl = cleanImages[newAccount.thumbnailIndex]?.url || selectedGame?.image || null
            const accountTitle = newAccount.title || ''

            const res = await fetch('/api/lol-skins', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...activeScanData,
                hideName: linkSettings.hideIgn,
                expiresAt,
                oge: linkSettings.oge,
                ogi: linkSettings.ogi,
                ogiPartial: linkSettings.ogiPartial,
                ogiVerified: linkSettings.ogiVerified,
                priceAmount: linkSettings.showPrice && linkSettings.priceAmount ? parseFloat(linkSettings.priceAmount) : null,
                priceCurrency: linkSettings.showPrice ? linkSettings.priceCurrency : null,
                thumbnailUrl,
                accountTitle,
              }),
            })
            const stored = await res.json()
            if (!stored.error) {
              setScanPreviewId(stored.id)
              setScanOwnerToken(stored.owner_token)
              // Persist scan ID on the account so links are always accessible later
              if (savedAccount) {
                const updatedFields = { ...cleanFields, _scanId: stored.id, _scanOwnerToken: stored.owner_token }
                await updateAccount({ ...payload, id: savedAccount.id, fields: updatedFields })
                if (selectedAccount && selectedAccount.id === savedAccount.id) {
                  setSelectedAccount(prev => ({ ...prev, fields: updatedFields }))
                }
              }
              setShowAddChoice(true)
              setCheckerStep(5)
            }
          } catch {}
          pendingScanDataRef.current = null
        } else if (!activeScanData && scanPreviewId && scanOwnerToken && savedAccount) {
          // Tool import: scan record already exists — just link the IDs to the account silently
          try {
            const updatedFields = { ...cleanFields, _scanId: scanPreviewId, _scanOwnerToken: scanOwnerToken }
            await updateAccount({ ...payload, id: savedAccount.id, fields: updatedFields })
          } catch {}
        }
      }
      setShowModal(false)
      setEditingAccount(null)
      setNewAccount({ title: '', status: 'Available', fields: {}, images: [], thumbnailIndex: 0, boughtFor: 0, soldFor: 0, boughtForCurrency: 'USD', soldForCurrency: 'USD', targetPlatforms: [], postingPriority: 0 })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this account? This cannot be undone.')) return
    await deleteAccount(id)
    if (selectedAccount && selectedAccount.id === id) setSelectedAccount(null)
  }

  const handleDownloadTemplate = () => {
    const cf = getGameConfig(selectedGame.id).customFields || []
    const headers = ['title', 'status', 'bought_for', 'bought_for_currency', 'sold_for', 'sold_for_currency', ...cf.map(f => f.label.toLowerCase().replace(/\s+/g, '_'))]
    const exampleRow = ['My Account Title', 'Available', '10', 'USD', '25', 'USD', ...cf.map(() => '')]
    const blob = new Blob([[headers.join(','), exampleRow.join(',')].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedGame.name.toLowerCase().replace(/\s+/g, '_')}_template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const cf = getGameConfig(selectedGame.id).customFields || []
    const fileText = await file.text()
    const lines = fileText.trim().split('\n')
    if (lines.length < 2) return
    const headers = lines[0].split(',').map(h => h.trim())
    const customFieldHeaders = headers.slice(6)
    const accountsToCreate = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      if (!values.length || values.every(v => !v)) continue
      const fields = {}
      customFieldHeaders.forEach((header, idx) => {
        const match = cf.find(f => f.label.toLowerCase().replace(/\s+/g, '_') === header)
        if (match) fields[match.id] = values[6 + idx] || ''
      })
      accountsToCreate.push({ gameId: selectedGame.id, title: values[0] || '', status: values[1] || 'Available', boughtFor: parseFloat(values[2]) || 0, boughtForCurrency: values[3] || 'USD', soldFor: values[1] === 'Lost' ? 0 : (parseFloat(values[4]) || 0), soldForCurrency: values[5] || 'USD', fields, targetPlatforms: [], postingPriority: 0 })
    }
    if (!accountsToCreate.length) return
    try {
      const res = await fetch('/api/accounts/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accounts: accountsToCreate }) })
      const saved = await res.json()
      if (saved.error) { console.error(saved.error); return }
      bulkAddAccounts(saved.map(a => ({ id: a.id, gameId: a.game_id, title: a.title || '', status: a.status, fields: a.fields || {}, images: a.images || [], thumbnailIndex: a.thumbnail_index || 0, boughtFor: a.bought_for || 0, soldFor: a.sold_for || 0, boughtForCurrency: a.bought_for_currency || 'USD', soldForCurrency: a.sold_for_currency || 'USD', targetPlatforms: a.target_platforms || [], postingPriority: a.posting_priority || 0, createdAt: a.created_at?.split('T')[0] || '' })))
    } catch (err) { console.error(err) }
    e.target.value = ''
  }

  const openLightbox = (index) => { setLightboxIndex(index); setLightboxOpen(true) }
  const closeLightbox = () => setLightboxOpen(false)
  const lightboxPrev = (images) => setLightboxIndex(i => (i - 1 + images.length) % images.length)
  const lightboxNext = (images) => setLightboxIndex(i => (i + 1) % images.length)

  const configModalProps = { card, border, text, muted, bg, inputBg, sectionBg, configTab, setConfigTab, configData, setConfigData, configuringGame, onSave: handleSaveConfig, onClose: () => setShowConfigModal(false) }

  // ─── VIEW 1: Game Grid ───────────────────────────────────────────
  if (!selectedGame) {
    return (
      <div style={{ padding: '32px', background: bg, minHeight: 'unset' }}>
        <style>{scrollbarStyle}</style>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: text }}>
            {accountsSubTab === 'gacha' ? 'Gacha Accounts' : 'Accounts'}
          </h1>
          <p style={{ fontSize: '13px', color: muted, marginTop: '4px' }}>Select a game to manage its accounts</p>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
          {[{ key: 'accounts', label: '🎮 Accounts' }, { key: 'gacha', label: '🎰 Gacha Accounts' }].map(tab => (
            <button key={tab.key} onClick={() => setAccountsSubTab(tab.key)}
              style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: accountsSubTab === tab.key ? '#7E6551' : 'transparent', color: accountsSubTab === tab.key ? '#FDF4DC' : muted, fontSize: '13px', fontWeight: accountsSubTab === tab.key ? '600' : '400', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', transition: 'all 0.15s ease' }}
              onMouseEnter={e => { if (accountsSubTab !== tab.key) { e.currentTarget.style.background = '#7E655122'; e.currentTarget.style.color = '#7E6551' } }}
              onMouseLeave={e => { if (accountsSubTab !== tab.key) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = muted } }}>
              {tab.label}
            </button>
          ))}
        </div>

        {accountsSubTab === 'gacha' ? (
          <GachaAccountsView games={games} gameConfigs={gameConfigs} saveGameConfig={saveGameConfig} card={card} border={border} text={text} muted={muted} bg={bg} sectionBg={sectionBg} />
        ) : (
          <>
            {accountGames.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
                <Gamepad2 size={48} color={muted} style={{ marginBottom: '16px' }} />
                <div style={{ fontSize: '17px', fontWeight: '600', color: text, marginBottom: '8px' }}>No games found</div>
                <div style={{ fontSize: '13px', color: muted, marginBottom: '20px' }}>Add a game and enable the Accounts section first</div>
                <button onClick={() => setActivePage('Games')} style={{ padding: '10px 20px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>Go to Games</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {accountGames.map(game => {
                  const count = accounts.filter(a => a.gameId === game.id).length
                  const available = accounts.filter(a => a.gameId === game.id && a.status === 'Available').length
                  const configured = isConfigured(game.id)
                  return (
                    <div key={game.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                      <button onClick={e => openConfigModal(game, e)} title="Configure fields"
                        style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.4)'}>
                        <Settings size={13} />
                      </button>
                      <div onClick={() => configured ? setSelectedGame(game) : openConfigModal(game)} style={{ cursor: 'pointer' }}>
                        <div style={{ width: '100%', height: '110px', background: game.image ? `url(${game.image}) center/cover no-repeat` : '#7E655122', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {!game.image && <Gamepad2 size={32} color="#7E6551" />}
                        </div>
                        <div style={{ padding: '16px' }}>
                          <div style={{ fontSize: '15px', fontWeight: '600', color: text, marginBottom: '6px' }}>{game.name}</div>
                          {!configured ? (
                            <div style={{ fontSize: '11px', color: '#e8a020', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Settings size={10} /> Configure fields before adding accounts
                            </div>
                          ) : (
                            <div style={{ fontSize: '11px', color: '#4caf50', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Check size={10} /> {(getGameConfig(game.id).customFields || []).length} fields configured
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${border}`, paddingTop: '12px' }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '18px', fontWeight: '600', color: text }}>{count}</div>
                              <div style={{ fontSize: '11px', color: muted }}>Total</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '18px', fontWeight: '600', color: '#4caf50' }}>{available}</div>
                              <div style={{ fontSize: '11px', color: muted }}>Available</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '18px', fontWeight: '600', color: text }}>{count - available}</div>
                              <div style={{ fontSize: '11px', color: muted }}>Others</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {showConfigModal && configuringGame && <ConfigModal {...configModalProps} />}
      </div>
    )
  }

  // ─── VIEW 2: Account Detail ──────────────────────────────────────
  if (selectedAccount) {
    const gameConfig = getGameConfig(selectedGame.id)
    const customFields = gameConfig.customFields || []
    const images = selectedAccount.images || []
    const thumbnailIndex = selectedAccount.thumbnailIndex || 0
    const displayIndex = mainImageIndex < images.length ? mainImageIndex : 0

    return (
      <div style={{ padding: '32px', background: bg, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <style>{scrollbarStyle}</style>
        <button onClick={() => { setSelectedAccount(null); setMainImageIndex(0) }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: muted, fontSize: '13px', marginBottom: '24px', padding: 0, flexShrink: 0 }}>
          <ArrowLeft size={15} /> Back to {selectedGame.name}
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '65fr 35fr', gap: '24px', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflow: 'hidden' }}>
            <div onClick={() => images.length > 0 && openLightbox(displayIndex)}
              style={{ width: '100%', flex: 1, minHeight: 0, borderRadius: '14px', overflow: 'hidden', background: '#000', border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: images.length > 0 ? 'zoom-in' : 'default', position: 'relative' }}>
              {images.length === 0 && <Gamepad2 size={48} color="#7E6551" />}
              {images.length > 0 && (
                <>
                  <img src={images[displayIndex]?.url} alt="main" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', color: '#fff' }}>Click to expand</div>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="themed-scroll" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', overflowY: 'auto', flexShrink: 0, maxHeight: '100px' }}>
                {images.map((img, i) => (
                  <div key={`thumb-${img.id || i}`} style={{ position: 'relative' }}>
                    <div onClick={() => setMainImageIndex(i)} style={{ width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden', background: `url(${img.url}) center/cover no-repeat`, border: `2px solid ${i === displayIndex ? '#7E6551' : border}`, cursor: 'pointer', opacity: i === displayIndex ? 1 : 0.65 }} />
                    {i === thumbnailIndex && (
                      <div style={{ position: 'absolute', top: '4px', right: '4px', background: '#7E6551', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Star size={10} color="#FDF4DC" fill="#FDF4DC" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: text }}>{selectedAccount.title || 'Account'}</div>
                  {selectedAccount.postingPriority === 1 && <span style={{ fontSize: '10px', padding: '2px 7px', background: '#e8a02022', color: '#e8a020', borderRadius: '10px', fontWeight: '500' }}>High Priority</span>}
                </div>
                <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', background: STATUS_COLORS[selectedAccount.status]?.bg, color: STATUS_COLORS[selectedAccount.status]?.color, fontWeight: '500' }}>{selectedAccount.status}</span>
              </div>
              <div style={{ fontSize: '11px', color: muted }}>Added {selectedAccount.createdAt}</div>
              {selectedAccount.description && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: text, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{selectedAccount.description}</div>
              )}
            </div>
            <div className="themed-scroll" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '4px' }}>
                <div style={{ padding: '10px 12px', background: bg, borderRadius: '8px', border: `1px solid ${border}` }}>
                  <div style={{ fontSize: '11px', color: muted, marginBottom: '3px' }}>Bought For</div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: text }}>{selectedAccount.boughtForCurrency} {selectedAccount.boughtFor || 0}</div>
                  {exchangeRates && selectedAccount.boughtForCurrency !== curCode && <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>≈ {displayAmount(selectedAccount.boughtFor, selectedAccount.boughtForCurrency)}</div>}
                </div>
                <div style={{ padding: '10px 12px', background: bg, borderRadius: '8px', border: `1px solid ${border}` }}>
                  <div style={{ fontSize: '11px', color: muted, marginBottom: '3px' }}>{getSoldForLabel(selectedAccount.status)}</div>
                  {selectedAccount.status === 'Lost' ? (
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#e05252' }}>—</div>
                  ) : (
                    <>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#4caf50' }}>{selectedAccount.soldForCurrency} {selectedAccount.soldFor || 0}</div>
                      {exchangeRates && selectedAccount.soldForCurrency !== curCode && <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>≈ {displayAmount(selectedAccount.soldFor, selectedAccount.soldForCurrency)}</div>}
                    </>
                  )}
                </div>
              </div>
              {selectedAccount.soldOnPlatform && (
                <div style={{ padding: '8px 12px', background: '#2196f311', borderRadius: '8px', border: '1px solid #2196f333', fontSize: '12px', color: '#2196f3' }}>Sold on {selectedAccount.soldOnPlatform}</div>
              )}
              {selectedAccount.fields?._scanId && (
                <>
                  <div style={{ padding: '10px 12px', background: '#7E655111', borderRadius: '8px', border: `1px solid #7E655133`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: '#7E6551', fontWeight: '600' }}>Preview Link</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <a href={`https://lolprev.site/preview/lol/${selectedAccount.fields._scanId}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: '11px', color: '#7E6551', textDecoration: 'none', padding: '3px 8px', border: '1px solid #7E655155', borderRadius: '4px' }}>Open ↗</a>
                      <button onClick={() => navigator.clipboard.writeText(`https://lolprev.site/preview/lol/${selectedAccount.fields._scanId}`)}
                        style={{ fontSize: '11px', color: '#7E6551', background: 'transparent', border: '1px solid #7E655155', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer' }}>Copy</button>
                    </div>
                  </div>
                  {selectedAccount.fields?._scanOwnerToken && (
                    <div style={{ padding: '10px 12px', background: bg, borderRadius: '8px', border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: muted }}>Owner Link</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <a href={`/overview/lol/${selectedAccount.fields._scanId}?token=${selectedAccount.fields._scanOwnerToken}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: '11px', color: '#7E6551', textDecoration: 'none', padding: '3px 8px', border: '1px solid #7E655155', borderRadius: '4px' }}>Open ↗</a>
                        <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/overview/lol/${selectedAccount.fields._scanId}?token=${selectedAccount.fields._scanOwnerToken}`)}
                          style={{ fontSize: '11px', color: muted, background: 'transparent', border: `1px solid ${border}`, borderRadius: '4px', padding: '3px 8px', cursor: 'pointer' }}>Copy</button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {customFields.map(field => (
                <div key={field.id} style={{ padding: '10px 12px', background: bg, borderRadius: '8px', border: `1px solid ${border}` }}>
                  <div style={{ fontSize: '11px', color: muted, marginBottom: '3px' }}>{field.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: text }}>{field.type === 'Checkbox' ? (selectedAccount.fields[field.id] === 'true' ? '✓ Yes' : '✗ No') : (selectedAccount.fields[field.id] || '—')}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${border}`, display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button onClick={() => handleOpenEdit(selectedAccount)} style={{ flex: 1, padding: '10px', background: '#7E655122', color: '#7E6551', border: `1px solid #7E655144`, borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Pencil size={13} /> Edit
              </button>
              <button onClick={() => { handleDelete(selectedAccount.id); setSelectedAccount(null) }} style={{ flex: 1, padding: '10px', background: '#e0525222', color: '#e05252', border: `1px solid #e0525244`, borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <X size={13} /> Delete
              </button>
            </div>
          </div>
        </div>

        {lightboxOpen && images.length > 0 && (
          <div onClick={closeLightbox} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <button onClick={closeLightbox} style={{ position: 'absolute', top: '20px', right: '24px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}><X size={20} /></button>
            <div style={{ position: 'absolute', top: '24px', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>{lightboxIndex + 1} / {images.length}</div>
            <div onClick={e => e.stopPropagation()} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '16px', maxWidth: '90vw' }}>
              {images.length > 1 && <button onClick={e => { e.stopPropagation(); lightboxPrev(images) }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '44px', height: '44px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ChevronLeft size={22} /></button>}
              <img src={images[lightboxIndex]?.url} alt="lightbox" style={{ maxWidth: '70vw', maxHeight: '70vh', borderRadius: '12px', objectFit: 'contain' }} />
              {images.length > 1 && <button onClick={e => { e.stopPropagation(); lightboxNext(images) }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '44px', height: '44px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ChevronRight size={22} /></button>}
            </div>
            {images.length > 1 && (
              <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '90vw' }}>
                {images.map((img, i) => (
                  <div key={`lb-${img.id || i}`} onClick={() => setLightboxIndex(i)} style={{ width: '64px', height: '64px', borderRadius: '8px', overflow: 'hidden', background: `url(${img.url}) center/cover no-repeat`, border: `2px solid ${i === lightboxIndex ? '#FDF4DC' : 'rgba(255,255,255,0.2)'}`, cursor: 'pointer', opacity: i === lightboxIndex ? 1 : 0.5 }} />
                ))}
              </div>
            )}
          </div>
        )}

        {showModal && <AccountModal game={selectedGame} gameConfig={getGameConfig(selectedGame.id)} newAccount={newAccount} setNewAccount={setNewAccount} handleSave={handleSave} handleStatusChange={handleStatusChange} onClose={() => { if (!saving) setShowModal(false) }} editingAccount={editingAccount} card={card} border={border} text={text} muted={muted} inputBg={inputBg} bg={bg} getSoldForLabel={getSoldForLabel} platforms={platforms} saving={saving} catConfig={getCheckerCategoriesConfig(selectedGame.id)} />}
        {showConfigModal && configuringGame && <ConfigModal {...configModalProps} />}
      </div>
    )
  }

  // ─── VIEW 3: Accounts List ───────────────────────────────────────
  const gameConfig = getGameConfig(selectedGame.id)
  const customFields = gameConfig.customFields || []
  const summaryFields = gameConfig.summaryFields || []

  return (
    <div style={{ padding: '32px', background: bg, minHeight: 'unset' }}>
      <style>{scrollbarStyle}</style>
      <button onClick={() => setSelectedGame(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: muted, fontSize: '13px', marginBottom: '24px', padding: 0 }}>
        <ArrowLeft size={15} /> Back to Games
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: selectedGame.image ? `url(${selectedGame.image}) center/cover no-repeat` : '#7E655122', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!selectedGame.image && <Gamepad2 size={20} color="#7E6551" />}
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '600', color: text }}>{selectedGame.name}</h1>
            <p style={{ fontSize: '13px', color: muted, marginTop: '2px' }}>{allGameAccounts.length} accounts total</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={e => openConfigModal(selectedGame, e)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '10px', cursor: 'pointer', fontSize: '14px' }}>
            <Settings size={15} /> Config
          </button>
          <button onClick={handleDownloadTemplate}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '10px', padding: '10px 18px', fontSize: '14px', cursor: 'pointer' }}>
            <Download size={16} /> Template
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '10px', padding: '10px 18px', fontSize: '14px', cursor: 'pointer' }}>
            <Upload size={16} /> Bulk Upload
            <input type="file" accept=".csv" onChange={handleBulkUpload} style={{ display: 'none' }} />
          </label>
          <button onClick={() => {
              const hasScript = selectedGame?.scriptEnabled && (selectedGame?.scriptSections || []).includes('accounts')
              if (hasScript) { setShowAddChoice(true); setCheckerStep(0); setCheckerData(null); setCheckerError(null); setScanData(null); setScanPreviewId(null); setScanOwnerToken(null) }
              else handleOpenAdd()
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', padding: '10px 18px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            <Plus size={16} /> Add Account
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {STATUS_TABS.map(tab => {
          const count = tab === 'All' ? allGameAccounts.length : allGameAccounts.filter(a => a.status === tab).length
          return (
            <button key={tab} onClick={() => setStatusTab(tab)}
              style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: statusTab === tab ? '#7E6551' : 'transparent', color: statusTab === tab ? '#FDF4DC' : muted, fontSize: '13px', fontWeight: statusTab === tab ? '600' : '400', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', transition: 'all 0.15s ease' }}
              onMouseEnter={e => { if (statusTab !== tab) { e.currentTarget.style.background = '#7E655122'; e.currentTarget.style.color = '#7E6551' } }}
              onMouseLeave={e => { if (statusTab !== tab) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = muted } }}>
              {tab}
              <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '8px', background: statusTab === tab ? 'rgba(255,255,255,0.2)' : '#7E655122', color: statusTab === tab ? '#FDF4DC' : muted }}>{count}</span>
            </button>
          )
        })}
      </div>

      {gameAccounts.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
          <AlertCircle size={40} color={muted} style={{ marginBottom: '16px' }} />
          <div style={{ fontSize: '16px', fontWeight: '600', color: text, marginBottom: '6px' }}>{statusTab === 'All' ? 'No accounts yet' : `No ${statusTab} accounts`}</div>
          <div style={{ fontSize: '13px', color: muted, marginBottom: '20px' }}>{statusTab === 'All' ? `Add your first account for ${selectedGame.name}` : `No accounts with ${statusTab} status`}</div>
          {statusTab === 'All' && <button onClick={() => {
              const hasScript = selectedGame?.scriptEnabled && (selectedGame?.scriptSections || []).includes('accounts')
              if (hasScript) { setShowAddChoice(true); setCheckerStep(0); setCheckerData(null); setCheckerError(null); setScanData(null); setScanPreviewId(null); setScanOwnerToken(null) }
              else handleOpenAdd()
            }} style={{ padding: '10px 20px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>Add Account</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {gameAccounts.sort((a, b) => (b.postingPriority || 0) - (a.postingPriority || 0)).map(account => {
            const thumbnail = account.images && account.images.length > 0 ? account.images[account.thumbnailIndex || 0]?.url : null
            const postedCount = (account.targetPlatforms || []).filter(p => p.posted).length
            const totalTargets = (account.targetPlatforms || []).length
            return (
              <div key={account.id} style={{ background: card, border: `1px solid ${account.postingPriority ? '#e8a02044' : border}`, borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '140px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {thumbnail ? <img src={thumbnail} alt="thumb" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <Gamepad2 size={28} color="#7E6551" />}
                  {account.postingPriority === 1 && (
                    <div style={{ position: 'absolute', top: '8px', left: '8px', background: '#e8a020', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', color: '#fff', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Flag size={9} /> HIGH
                    </div>
                  )}
                  {account.fields?._scanId && (
                    <button onClick={(e) => {
                      e.stopPropagation()
                      navigator.clipboard.writeText(`https://lolprev.site/preview/lol/${account.fields._scanId}`)
                      setCopiedCardId(account.id)
                      setTimeout(() => setCopiedCardId(null), 2000)
                    }} style={{ position: 'absolute', top: '8px', right: '8px', background: copiedCardId === account.id ? '#4caf50' : 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#fff', fontSize: '10px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', transition: 'background 0.2s' }}>
                      {copiedCardId === account.id ? <><Check size={10} /> Copied!</> : <><Link size={10} /> Copy Link</>}
                    </button>
                  )}
                </div>
                <div style={{ padding: '14px' }}>
                  {account.title && <div style={{ fontSize: '13px', fontWeight: '600', color: text, marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.title}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: STATUS_COLORS[account.status]?.bg, color: STATUS_COLORS[account.status]?.color, fontWeight: '500' }}>{account.status}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => { setSelectedAccount(account); setMainImageIndex(account.thumbnailIndex || 0) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, padding: '4px' }}><Eye size={14} /></button>
                      <button onClick={() => handleOpenEdit(account)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, padding: '4px' }}><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(account.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, padding: '4px' }}><X size={14} /></button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {summaryFields.length > 0 ? summaryFields.map(fid => {
                      const field = customFields.find(f => f.id === fid)
                      if (!field) return null
                      return (
                        <div key={fid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: muted }}>{field.label}</span>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: text }}>{field.type === 'Checkbox' ? (account.fields[fid] === 'true' ? '✓' : '✗') : (account.fields[fid] || '—')}</span>
                        </div>
                      )
                    }) : <div style={{ fontSize: '12px', color: muted }}>No summary fields configured</div>}
                  </div>
                  <div style={{ borderTop: `1px solid ${border}`, paddingTop: '10px', marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: muted }}>{totalTargets > 0 ? `${postedCount}/${totalTargets} posted` : 'No platforms set'}</span>
                    <span style={{ fontSize: '11px', color: account.status === 'Lost' ? '#e05252' : '#4caf50', fontWeight: '500' }}>{account.status === 'Lost' ? 'Lost' : displayAmount(account.soldFor, account.soldForCurrency)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

        {/* ── Add Account Choice Modal ── */}
        {showAddChoice && selectedGame && (() => {
          const closeModal = () => { setShowAddChoice(false); setCheckerStep(0); setScanData(null); setScanPreviewId(null); setScanOwnerToken(null); setCheckerData(null); setCheckerError(null); setVersionMismatch(false); setGeneratingLinkError(null); setEditingLinkSettings(false); setScanRetryActive(false); setScanRetryElapsed(0); scanCancelRef.current = false; pendingScanDataRef.current = null }
          const _rawFlat = scanData ? flattenScanData(scanData) : null
          const _catResults = scanData ? evaluateCategories(scanData, getCheckerCategoriesConfig(selectedGame.id).categories || []) : {}
          const flat = _rawFlat ? { ..._rawFlat, ..._catResults } : null
          const mapping = getScannerMapping(selectedGame.id)
          const hasMappings = Object.keys(mapping.fieldMappings || {}).length > 0
          const customFields = getGameConfig(selectedGame.id).customFields || []
          const unmappedValues = (flat && hasMappings) ? findUnmappedValues(flat, mapping, customFields) : []
          const needsConfigure = flat && (!hasMappings || unmappedValues.length > 0)

          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' }}>
              <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '520px', border: `1px solid ${border}`, overflow: 'hidden' }}>

                {/* Header */}
                <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: '600', color: text, margin: 0 }}>Add Account — {selectedGame.name}</h2>
                  <button onClick={closeModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
                </div>

                {/* Step 0: Choose */}
                {checkerStep === 0 && (
                  <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '13px', color: muted }}>How would you like to add this account?</div>
                    <button onClick={() => setCheckerStep(1)}
                      style={{ padding: '16px', background: '#7E655108', border: '1px solid #7E655144', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '24px' }}>🤖</span>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: text, marginBottom: '3px' }}>Automatic</div>
                        <div style={{ fontSize: '12px', color: muted }}>Use the AIO Tool — level, skins, currencies and more are read directly from the League client.</div>
                      </div>
                    </button>
                    <button onClick={() => { setShowAddChoice(false); handleOpenAdd() }}
                      style={{ padding: '16px', background: sectionBg, border: `1px solid ${border}`, borderRadius: '12px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '24px' }}>✏️</span>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: text, marginBottom: '3px' }}>Manual</div>
                        <div style={{ fontSize: '12px', color: muted }}>Fill in the account details yourself.</div>
                      </div>
                    </button>
                  </div>
                )}

                {/* Step 1: Run Vault Scanner */}
                {checkerStep === 1 && (
                  <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: text }}>1. Run AIO Tool</div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: scannerOnline ? '#4caf50' : scannerVersion ? '#e05252' : muted }}>
                        {scannerOnline ? `● Running v${scannerVersion}` : scannerVersion ? `● Wrong version (v${scannerVersion})` : '○ Not detected'}
                      </div>
                    </div>
                    <a href="/aio-tool-v0.7.15.exe" download="aio-tool-v0.7.15.exe" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: scannerOnline ? 'transparent' : '#7E6551', color: scannerOnline ? muted : '#FDF4DC', border: scannerOnline ? `1px solid ${border}` : 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none', width: 'fit-content' }}>
                      ↓ Download AIO Tool v0.7.15
                    </a>
                    {scannerOnline && <div style={{ fontSize: '12px', color: '#4caf50' }}>AIO Tool is running on localhost:35199</div>}
                    {!scannerOnline && scannerVersion && <div style={{ fontSize: '12px', color: '#e05252' }}>Old version detected (v{scannerVersion}) — close it and download the latest.</div>}
                    <button onClick={() => setCheckerStep(2)} disabled={!scannerOnline}
                      style={{ padding: '10px 20px', background: scannerOnline ? '#7E6551' : border, color: scannerOnline ? '#FDF4DC' : muted, border: 'none', borderRadius: '10px', cursor: scannerOnline ? 'pointer' : 'default', fontSize: '13px', fontWeight: '500', alignSelf: 'flex-end' }}>
                      Continue →
                    </button>
                  </div>
                )}

                {/* Step 2: Open League */}
                {checkerStep === 2 && (
                  <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: text }}>2. Open League of Legends</div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: leagueOpen ? '#4caf50' : muted }}>
                        {leagueOpen ? '● Client detected' : '○ Waiting…'}
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: muted, lineHeight: '1.5' }}>
                      Log in to the account you want to scan, then wait for the client to fully load.
                    </div>

                    {/* Checker Categories row */}
                    {(() => {
                      const catConfig = getCheckerCategoriesConfig(selectedGame.id)
                      const catCount = catConfig.categories?.length || 0
                      const itemCount = (catConfig.categories || []).reduce((s, c) => s + (c.items?.length || 0), 0)
                      const configured = catCount > 0 && itemCount > 0
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: sectionBg, borderRadius: '8px', border: `1px solid ${border}` }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: text }}>Checker Categories</div>
                            <div style={{ fontSize: '11px', color: muted, marginTop: 1 }}>
                              {configured ? `${catCount} categor${catCount !== 1 ? 'ies' : 'y'}, ${itemCount} items` : 'Not configured'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: configured ? '#4caf50' : '#e8a020' }}>{configured ? '✓' : '⚠'}</span>
                            <a href={`/checker-categories/${selectedGame.id}`} target="_blank" rel="noreferrer"
                              style={{ padding: '5px 10px', background: 'transparent', border: `1px solid ${border}`, borderRadius: '6px', cursor: 'pointer', color: muted, fontSize: '11px', textDecoration: 'none', display: 'inline-block' }}>
                              Configure ↗
                            </a>
                          </div>
                        </div>
                      )
                    })()}

                    {!leagueOpen && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: sectionBg, borderRadius: '8px', border: `1px solid ${border}` }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: border, flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: muted }}>Waiting for League client…</span>
                      </div>
                    )}
                    {leagueOpen && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#4caf5011', borderRadius: '8px', border: '1px solid #4caf5044' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4caf50', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: '#4caf50' }}>League client detected</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                      <button onClick={() => setCheckerStep(1)} style={{ padding: '9px 16px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '10px', cursor: 'pointer', fontSize: '13px' }}>← Back</button>
                      <button onClick={handleScan} disabled={!leagueOpen}
                        style={{ padding: '10px 20px', background: leagueOpen ? '#7E6551' : border, color: leagueOpen ? '#FDF4DC' : muted, border: 'none', borderRadius: '10px', cursor: leagueOpen ? 'pointer' : 'default', fontSize: '13px', fontWeight: '500' }}>
                        Start Scan →
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Scanning */}
                {checkerStep === 3 && (
                  <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{ width: '40px', height: '40px', border: `3px solid ${border}`, borderTop: '3px solid #7E6551', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <div style={{ fontSize: '15px', fontWeight: '600', color: text }}>
                      {scanRetryActive ? 'Retrying scan…' : 'Scanning…'}
                    </div>
                    <div style={{ fontSize: '13px', color: muted }}>
                      {scanRetryActive
                        ? `No skins detected yet — retrying automatically. (${Math.floor(scanRetryElapsed / 1000)}s elapsed)`
                        : 'Reading data from the League client. This may take up to 30 seconds.'}
                    </div>
                    {scanRetryElapsed >= 20000 && (
                      <button onClick={() => { scanCancelRef.current = true }}
                        style={{ padding: '8px 20px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    )}
                  </div>
                )}

                {/* Step 4: Data Preview + Actions */}
                {checkerStep === 4 && (() => {
                  if (checkerError) return (
                    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ padding: '14px', background: '#e0525210', border: '1px solid #e0525244', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontSize: '13px', color: '#e05252' }}>⚠ {checkerError}</div>
                        {versionMismatch ? (
                          <a href={`/aio-tool-v${EXPECTED_SCANNER_VERSION}.exe`} download={`aio-tool-v${EXPECTED_SCANNER_VERSION}.exe`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#7E6551', color: '#FDF4DC', borderRadius: 8, fontSize: 12, fontWeight: 500, textDecoration: 'none', width: 'fit-content' }}>
                            ↓ Download AIO Tool v{EXPECTED_SCANNER_VERSION}.exe
                          </a>
                        ) : (
                          <button onClick={() => { setCheckerStep(2); setCheckerError(null); setVersionMismatch(false) }}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, fontSize: '12px', textDecoration: 'underline', padding: 0, textAlign: 'left' }}>
                            Try again
                          </button>
                        )}
                      </div>
                    </div>
                  )
                  if (!flat) return null

                  const RANK_COLORS = { Challenger: '#f4c874', Grandmaster: '#f4c874', Master: '#c87db4', Diamond: '#6ec6e8', Emerald: '#50c878', Platinum: '#4fc0a0', Gold: '#d4a520', Silver: '#b0b8c0', Bronze: '#c07840', Iron: '#8a7a70', Unranked: null }
                  const statRows = [
                    { label: 'Name',       value: flat.summonerName || '—' },
                    { label: 'Server',     value: flat.region || '—' },
                    { label: 'Level',      value: flat.summonerLevel ?? '—' },
                    { label: 'Solo Rank',  value: flat.soloRank || 'Unranked', color: RANK_COLORS[flat.soloRank] },
                    { label: 'Flex Rank',  value: flat.flexRank || 'Unranked', color: RANK_COLORS[flat.flexRank] },
                    { label: 'TFT Rank',   value: flat.tftRank  || 'Unranked', color: RANK_COLORS[flat.tftRank] },
                    { label: 'Skins',      value: flat.skinCount },
                    { label: 'Chromas',    value: flat.chromaCount },
                    { label: 'Icons',      value: flat.iconCount },
                    { label: 'Wards',      value: flat.wardCount },
                    { label: 'Finishers',  value: flat.finisherCount },
                  ]
                  const currencyRows = [
                    { label: 'RP',  value: flat.rp,  color: '#e8a020' },
                    { label: 'BE',  value: flat.be,  color: '#2196f3' },
                    { label: 'OE',  value: flat.oe,  color: '#9c27b0' },
                    { label: 'ME',  value: flat.me,  color: '#ff9800' },
                  ]
                  const tftRows = [
                    { label: 'Companions', value: flat.tftCompanionCount },
                    { label: 'Arenas',     value: flat.tftMapSkinCount },
                    { label: 'Booms',      value: flat.tftDamageSkinCount },
                  ]

                  const downloadDebug = () => {
                    const blob = new Blob([JSON.stringify(scanData, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = `aio-debug-v${scanData._scannerVersion || 'unknown'}-${Date.now()}.json`
                    a.click(); URL.revokeObjectURL(url)
                  }

                  const setLink = (patch) => setLinkSettings(prev => ({ ...prev, ...patch }))
                  const Toggle = ({ on, onClick }) => (
                    <div onClick={onClick} style={{ width: '36px', height: '20px', borderRadius: '10px', cursor: 'pointer', background: on ? '#7E6551' : border, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: '2px', left: on ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </div>
                  )
                  const InfoLabel = ({ label, which }) => (
                    <span onClick={() => setInfoModal(which)} style={{ fontSize: '12px', color: text, cursor: 'pointer', borderBottom: '1px dashed ' + muted }}>{label}</span>
                  )

                  return (
                    <div className="themed-scroll" style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '70vh', overflowY: 'auto' }}>

                      {/* Header: scan complete + debug icon + configure icon */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#4caf50' }}>✅ Scan complete</div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {!needsConfigure && (
                            <button onClick={() => setShowFieldMapper(true)} title="Configure field mapping"
                              style={{ padding: '4px 6px', background: 'transparent', border: `1px solid ${border}`, borderRadius: '6px', cursor: 'pointer', color: muted, display: 'flex', alignItems: 'center' }}>
                              <Settings size={13} />
                            </button>
                          )}
                          <button onClick={downloadDebug} title="Download full scan data"
                            style={{ padding: '4px 6px', background: 'transparent', border: `1px solid ${border}`, borderRadius: '6px', cursor: 'pointer', color: muted, display: 'flex', alignItems: 'center' }}>
                            <Download size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Stats grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ background: sectionBg, borderRadius: '10px', border: `1px solid ${border}`, padding: '12px 14px' }}>
                          <div style={{ fontSize: '10px', color: muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Account</div>
                          {statRows.map(({ label, value, color }) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '12px', color: muted }}>{label}</span>
                              <span style={{ fontSize: '12px', fontWeight: '600', color: color || text }}>{value != null ? String(value) : '—'}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ background: sectionBg, borderRadius: '10px', border: `1px solid ${border}`, padding: '12px 14px' }}>
                            <div style={{ fontSize: '10px', color: muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Currency</div>
                            {currencyRows.map(({ label, value, color }) => (
                              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '12px', color: muted }}>{label}</span>
                                <span style={{ fontSize: '12px', fontWeight: '600', color: value != null ? color : muted }}>{value != null ? value.toLocaleString() : '—'}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ background: sectionBg, borderRadius: '10px', border: `1px solid ${border}`, padding: '12px 14px' }}>
                            <div style={{ fontSize: '10px', color: muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>TFT</div>
                            {tftRows.map(({ label, value }) => (
                              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '12px', color: muted }}>{label}</span>
                                <span style={{ fontSize: '12px', fontWeight: '600', color: text }}>{value ?? 0}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Unmapped warning */}
                      {unmappedValues.length > 0 && (
                        <div style={{ padding: '10px 12px', background: '#e8a02011', border: '1px solid #e8a02044', borderRadius: '8px', fontSize: '12px', color: '#e8a020' }}>
                          ⚠ {unmappedValues.length} new value{unmappedValues.length > 1 ? 's' : ''} need mapping before creating.
                        </div>
                      )}

                      {/* Link section */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {scanPreviewId && (
                          <>
                            <div style={{ padding: '10px 12px', background: '#7E655111', border: '1px solid #7E655133', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <span style={{ fontSize: '12px', color: muted }}>Preview</span>
                              <a href={`https://lolprev.site/preview/lol/${scanPreviewId}`} target="_blank" rel="noreferrer"
                                style={{ fontSize: '12px', color: '#7E6551', fontWeight: '600', textDecoration: 'none' }}>
                                Open ↗
                              </a>
                            </div>
                            <div style={{ padding: '10px 12px', background: '#7E655111', border: '1px solid #7E655133', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <span style={{ fontSize: '12px', color: muted }}>Owner Link</span>
                              <a href={`/overview/lol/${scanPreviewId}?token=${scanOwnerToken}`} target="_blank" rel="noreferrer"
                                style={{ fontSize: '12px', color: '#7E6551', fontWeight: '600', textDecoration: 'none' }}>
                                Open ↗
                              </a>
                            </div>
                          </>
                        )}

                        {/* Link settings — always shown in step 4 */}
                        <div style={{ background: sectionBg, borderRadius: '10px', border: `1px solid ${border}`, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ fontSize: '10px', color: muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Preview Link Settings</div>

                          {/* Hide IGN */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '12px', color: text }}>Hide IGN</span>
                            <Toggle on={linkSettings.hideIgn} onClick={() => setLink({ hideIgn: !linkSettings.hideIgn })} />
                          </div>

                          {/* Expiry */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '12px', color: text }}>Expiry</span>
                            <select value={linkSettings.expiry} onChange={e => setLink({ expiry: e.target.value })}
                              style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: `1px solid ${border}`, background: inputBg, color: text, outline: 'none', cursor: 'pointer' }}>
                              <option value="never">Never</option>
                              <option value="1d">1 Day</option>
                              <option value="1m">1 Month</option>
                            </select>
                          </div>

                          {/* OGE */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <InfoLabel label="OGE (Original Email)" which="oge" />
                            <Toggle on={linkSettings.oge} onClick={() => setLink({ oge: !linkSettings.oge })} />
                          </div>

                          {/* OGI */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <InfoLabel label="OGI (Original Information)" which="ogi" />
                              <Toggle on={linkSettings.ogi} onClick={() => setLink({ ogi: !linkSettings.ogi, ogiPartial: false, ogiVerified: false })} />
                            </div>
                            {linkSettings.ogi && (
                              <div style={{ paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: `2px solid ${border}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <InfoLabel label="Partial" which="ogi_partial" />
                                  <Toggle on={linkSettings.ogiPartial} onClick={() => setLink({ ogiPartial: !linkSettings.ogiPartial, ogiVerified: linkSettings.ogiPartial ? linkSettings.ogiVerified : false })} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <InfoLabel label="Verified by Riot" which="ogi_verified" />
                                  <Toggle on={linkSettings.ogiVerified} onClick={() => setLink({ ogiVerified: !linkSettings.ogiVerified })} />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Price */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '12px', color: text }}>Selling Price</span>
                              <Toggle on={linkSettings.showPrice} onClick={() => setLink({ showPrice: !linkSettings.showPrice, priceAmount: '', priceCurrency: 'USD' })} />
                            </div>
                            {linkSettings.showPrice && (
                              <div style={{ display: 'flex', gap: '6px', paddingLeft: '12px', borderLeft: `2px solid ${border}` }}>
                                <select value={linkSettings.priceCurrency} onChange={e => setLink({ priceCurrency: e.target.value })}
                                  style={{ width: '72px', flexShrink: 0, padding: '7px 4px', borderRadius: '7px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '11px', outline: 'none', cursor: 'pointer' }}>
                                  {CURRENCY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                                </select>
                                <input type="number" value={linkSettings.priceAmount} onChange={e => setLink({ priceAmount: e.target.value })} placeholder="0.00" min="0"
                                  style={{ flex: 1, padding: '7px 10px', borderRadius: '7px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                        {needsConfigure ? (
                          <button onClick={() => setShowFieldMapper(true)}
                            style={{ flex: 1, padding: '11px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                            {hasMappings ? '⚠ Map New Values' : '⚙ Configure Fields'}
                          </button>
                        ) : (
                          <button onClick={() => {
                            const prefill = checkerData || {}
                            const soldFor = linkSettings.showPrice && linkSettings.priceAmount ? parseFloat(linkSettings.priceAmount) : null
                            setShowAddChoice(false)
                            handleOpenAdd({ ...prefill }, soldFor, linkSettings.showPrice ? linkSettings.priceCurrency : null)
                          }} style={{ flex: 1, padding: '11px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                            ✓ Save Account
                          </button>
                        )}
                        <button onClick={() => { setCheckerStep(2); setScanData(null); setScanPreviewId(null); setScanOwnerToken(null); setCheckerData(null); setCheckerError(null); setVersionMismatch(false); setGeneratingLinkError(null); setEditingLinkSettings(false); setScanRetryActive(false); setScanRetryElapsed(0) }}
                          style={{ padding: '11px 14px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}>
                          Redo
                        </button>
                      </div>
                    </div>
                  )
                })()}

                {/* Step 5: Account saved — show links */}
                {checkerStep === 5 && (
                  <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#4caf50' }}>✅ Account saved!</div>
                    <div style={{ fontSize: '13px', color: muted }}>Your preview link has been generated.</div>

                    {scanPreviewId && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Preview link row */}
                        <div style={{ padding: '10px 14px', background: sectionBg, border: `1px solid ${border}`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Preview
                          </span>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <a href={`https://lolprev.site/preview/lol/${scanPreviewId}`} target="_blank" rel="noreferrer"
                              style={{ padding: '5px 10px', background: 'transparent', border: `1px solid ${border}`, borderRadius: '6px', color: muted, fontSize: '11px', textDecoration: 'none', cursor: 'pointer' }}>
                              Open ↗
                            </a>
                            <button onClick={() => navigator.clipboard.writeText(`https://lolprev.site/preview/lol/${scanPreviewId}`)}
                              style={{ padding: '5px 10px', background: '#7E6551', border: 'none', borderRadius: '6px', color: '#FDF4DC', fontSize: '11px', cursor: 'pointer', fontWeight: '500' }}>
                              Copy
                            </button>
                          </div>
                        </div>

                        {/* Owner link row */}
                        <div style={{ padding: '10px 14px', background: sectionBg, border: `1px solid ${border}`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Owner Link
                          </span>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <a href={`/overview/lol/${scanPreviewId}?token=${scanOwnerToken}`} target="_blank" rel="noreferrer"
                              style={{ padding: '5px 10px', background: 'transparent', border: `1px solid ${border}`, borderRadius: '6px', color: muted, fontSize: '11px', textDecoration: 'none', cursor: 'pointer' }}>
                              Open ↗
                            </a>
                            <button onClick={() => setOwnerLinkCopyWarning(true)}
                              style={{ padding: '5px 10px', background: '#7E6551', border: 'none', borderRadius: '6px', color: '#FDF4DC', fontSize: '11px', cursor: 'pointer', fontWeight: '500' }}>
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <button onClick={() => { setShowAddChoice(false); setCheckerStep(0); setScanData(null); setScanPreviewId(null); setScanOwnerToken(null); setCheckerData(null); setCheckerError(null); setVersionMismatch(false); setGeneratingLinkError(null); setEditingLinkSettings(false); setScanRetryActive(false); setScanRetryElapsed(0); scanCancelRef.current = false; pendingScanDataRef.current = null }}
                      style={{ padding: '10px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '10px', fontSize: '13px', cursor: 'pointer', textAlign: 'center' }}>
                      Done
                    </button>
                  </div>
                )}

              </div>
            </div>
          )
        })()}

        {/* ── Field Mapper Modal ── */}
        {showFieldMapper && selectedGame && scanData && (
          <FieldMapperModal
            gameName={selectedGame.name}
            customFields={getGameConfig(selectedGame.id).customFields || []}
            flatData={{ ...flattenScanData(scanData), ...evaluateCategories(scanData, getCheckerCategoriesConfig(selectedGame.id).categories || []) }}
            initialMapping={getScannerMapping(selectedGame.id)}
            scannerKeyLabels={getScannerKeyLabels(selectedGame.id)}
            onSave={async (mapping) => { await handleSaveMapping(selectedGame.id, mapping); setShowFieldMapper(false) }}
            onClose={() => setShowFieldMapper(false)}
            card={card} border={border} text={text} muted={muted} inputBg={inputBg} sectionBg={sectionBg}
          />
        )}

        {showModal && <AccountModal game={selectedGame} gameConfig={getGameConfig(selectedGame.id)} newAccount={newAccount} setNewAccount={setNewAccount} handleSave={handleSave} handleStatusChange={handleStatusChange} onClose={() => { if (!saving) setShowModal(false) }} editingAccount={editingAccount} card={card} border={border} text={text} muted={muted} inputBg={inputBg} bg={bg} getSoldForLabel={getSoldForLabel} platforms={platforms} saving={saving} catConfig={getCheckerCategoriesConfig(selectedGame.id)} />}
        {showConfigModal && configuringGame && <ConfigModal {...configModalProps} />}

        {/* Loading overlay while tool import data is being fetched */}
        {toolImportLoading && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: '32px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
              <div style={{ width: 36, height: 36, border: `3px solid ${border}`, borderTop: '3px solid #7E6551', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: text }}>Loading account data…</div>
              <div style={{ fontSize: 12, color: muted }}>Fetching scan results from server</div>
            </div>
          </div>
        )}

        {/* Owner link copy warning */}
        {ownerLinkCopyWarning && (
          <div onClick={() => setOwnerLinkCopyWarning(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: '20px' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '400px', border: `1px solid ${border}`, overflow: 'hidden' }}>
              <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: text, margin: 0 }}>⚠ Owner Link Warning</h3>
                <button onClick={() => setOwnerLinkCopyWarning(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={16} /></button>
              </div>
              <div style={{ padding: '16px 22px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '13px', color: text, lineHeight: '1.6', margin: 0 }}>The owner link gives full access to scan details including all account information. <strong>Only share this with trusted parties or keep it for yourself.</strong></p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setOwnerLinkCopyWarning(false)}
                    style={{ flex: 1, padding: '9px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/overview/lol/${scanPreviewId}?token=${scanOwnerToken}`)
                    setOwnerLinkCopyWarning(false)
                  }}
                    style={{ flex: 1, padding: '9px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                    Copy Anyway
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {infoModal && (
          <div onClick={() => setInfoModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: '20px' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '440px', border: `1px solid ${border}`, overflow: 'hidden' }}>
              <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: text, margin: 0 }}>
                  {infoModal === 'oge' ? 'OGE — Original Email' : infoModal === 'ogi_partial' ? 'OGI — Partial' : infoModal === 'ogi_verified' ? 'OGI — Verified by Riot' : 'OGI — Original Information'}
                </h3>
                <button onClick={() => setInfoModal(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={16} /></button>
              </div>
              <div className="themed-scroll" style={{ padding: '16px 22px 20px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '70vh', overflowY: 'auto' }}>
                {infoModal === 'oge' ? (
                  <>
                    <p style={{ fontSize: '13px', color: text, lineHeight: '1.6', margin: 0 }}>Turn on if the account <strong>comes with its original email</strong> — meaning you will give the buyer access to the email the account was registered with.</p>
                    <div style={{ background: sectionBg, borderRadius: '8px', padding: '12px 14px', border: `1px solid ${border}` }}>
                      <div style={{ fontSize: '11px', color: muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>How to check</div>
                      <p style={{ fontSize: '12px', color: text, lineHeight: '1.6', margin: 0 }}>Go to the email linked to the account and search for:<br /><span style={{ fontWeight: '600', color: '#7E6551' }}>"Welcome to Riot Games"</span> or <span style={{ fontWeight: '600', color: '#7E6551' }}>"Your Riot account was created"</span></p>
                    </div>
                  </>
                ) : infoModal === 'ogi_partial' ? (
                  <>
                    <p style={{ fontSize: '13px', color: text, lineHeight: '1.6', margin: 0 }}>Enable this if the OGI available is <strong>incomplete</strong> — some information exists but not everything. For example, you have the creation email but not the billing details.</p>
                    <div style={{ background: sectionBg, borderRadius: '8px', padding: '12px 14px', border: `1px solid ${border}` }}>
                      <div style={{ fontSize: '11px', color: muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>When to use</div>
                      <p style={{ fontSize: '12px', color: text, lineHeight: '1.6', margin: 0 }}>Use Partial when you can provide <em>some</em> verification information to Riot but cannot guarantee full recovery. It signals to the buyer that ownership verification may succeed partially.</p>
                    </div>
                  </>
                ) : infoModal === 'ogi_verified' ? (
                  <>
                    <p style={{ fontSize: '13px', color: text, lineHeight: '1.6', margin: 0 }}>Only enable this if the seller has already <strong>submitted the OGI to Riot Support and it was confirmed valid</strong> — meaning Riot accepted the information and successfully verified ownership.</p>
                    <div style={{ background: '#e0525211', borderRadius: '8px', padding: '12px 14px', border: '1px solid #e0525244' }}>
                      <div style={{ fontSize: '11px', color: '#e05252', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Important</div>
                      <p style={{ fontSize: '12px', color: text, lineHeight: '1.6', margin: 0 }}>Do <strong>not</strong> enable this speculatively. It should only be turned on after the information was actually submitted to Riot, they responded positively, and the account ownership was confirmed. Misuse can mislead buyers.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: '13px', color: text, lineHeight: '1.6', margin: 0 }}>Turn on if the account comes with <strong>original information</strong> that can help verify ownership with Riot Support.</p>
                    <div style={{ background: sectionBg, borderRadius: '8px', padding: '12px 14px', border: `1px solid ${border}` }}>
                      <div style={{ fontSize: '11px', color: muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>What's included</div>
                      {['Creation Date (from "Welcome to Riot Games" email)','Original Email (email name only, no access needed)','Birthdate on the Account (via account.riotgames.com)','Location — Country and City account was created','Gifts Given or Received (to/from whom)','First non-skin RP purchase (ward, rune page, emote, icon)','PayPal email used (if applicable)','PayPal Transaction ID','First 6 & Last 4 digits of Credit Card(s) used','RP Card PIN numbers used','Purchase confirmation codes (search "Purchase Confirmation Receipt")'].map((item, i, arr) => (
                        <div key={i} style={{ fontSize: '12px', color: text, paddingBottom: '5px', marginBottom: '5px', borderBottom: i < arr.length - 1 ? `1px solid ${border}` : 'none', lineHeight: '1.4' }}>• {item}</div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

