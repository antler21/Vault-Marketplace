'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'

const CDN_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default'
const cdnUrl = p => p ? CDN_BASE + p.toLowerCase().replace('/lol-game-data/assets', '') : ''
const uid = () => Math.random().toString(36).slice(2, 10)
const STAR_COLORS = ['', '#cd7f32', '#c0c0c0', '#ffd700']

// Skins absent from skins.json — hardcoded with constructed tile URLs.
const _T = (champ, n) => `${CDN_BASE}/assets/characters/${champ}/skins/skin${n}/images/${champ}_splash_tile_${n}.jpg`
const MISSING_SKINS = [
  { id: 103085, name: 'Risen Legend Ahri',          imgSrc: _T('ahri', 85) },
  { id: 103086, name: 'Immortalized Legend Ahri',   imgSrc: _T('ahri', 86) },
  { id: 145070, name: "Risen Legend Kai'Sa",        imgSrc: _T('kaisa', 70) },
  { id: 145071, name: "Immortalized Legend Kai'Sa", imgSrc: _T('kaisa', 71) },
  { id:   7055, name: 'Risen Legend LeBlanc',       imgSrc: _T('leblanc', 55) },
  { id:  67064, name: 'Risen Legend Vayne',         imgSrc: _T('vayne', 64) },
]

const CAT_TABS = [
  { id: 'SKINS',            label: 'Skins',          icon: '⚔',  type: 'skins'            },
  { id: 'BORDERS',          label: 'Borders',        icon: '⬡',  type: 'skins'            },
  { id: 'EMOTES',           label: 'Emotes',         icon: '💬', type: 'emotes'           },
  { id: 'ICONS',            label: 'Icons',          icon: '🎭', type: 'icons'            },
  { id: 'WARDS',            label: 'Wards',          icon: '🏮', type: 'wards'            },
  { id: 'CHROMAS',          label: 'Chromas',        icon: '◈',  type: 'chromas'          },
  { id: 'FINISHERS',        label: 'Finishers',      icon: '✨', type: 'finishers'        },
  { id: 'TFT_COMPANIONS',   label: 'Companions',     icon: '♟',  type: 'tft_companions'   },
  { id: 'TFT_MAP_SKINS',    label: 'Arenas',         icon: '🗺', type: 'tft_map_skins'    },
  { id: 'TFT_DAMAGE_SKINS', label: 'Booms',          icon: '💥', type: 'tft_damage_skins' },
  { id: 'CATEGORIES',       label: 'All Categories', icon: '📋', type: null               },
]

const RENDER_BATCH = 250

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: #080c14 url('/background.png') center center / cover no-repeat fixed;
  color: #e8e0d0;
  -webkit-font-smoothing: antialiased;
}
::-webkit-scrollbar { width: 7px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #785a28; border-radius: 4px; min-height: 40px; }
::-webkit-scrollbar-thumb:hover { background: #c8aa6e; }

.cc-titlebar {
  position: fixed; top: 0; left: 0; right: 0; height: 70px;
  display: flex; align-items: center; gap: 14px;
  background: rgba(6,10,18,0.55);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(200,155,60,0.15);
  z-index: 1000; padding: 0 18px;
}
.cc-title-block { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.cc-title-game { font-family: 'Cinzel', serif; font-size: 18px; font-weight: 700; color: #c89b3c; letter-spacing: 0.06em; line-height: 1.1; }
.cc-title-sub { font-family: 'Inter', sans-serif; font-size: 10px; color: #3c4a5c; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 3px; }
.cc-title-right { display: flex; align-items: center; gap: 10px; }
.cc-back-btn {
  padding: 7px 14px; background: transparent;
  border: 1px solid #2a3a4a; color: #5b6a7e;
  font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500;
  cursor: pointer; transition: border-color 0.15s, color 0.15s; white-space: nowrap;
}
.cc-back-btn:hover { border-color: #7E6551; color: #c89b3c; }
.cc-save-btn {
  padding: 8px 20px; background: #7E6551; color: #FDF4DC;
  border: none; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
  letter-spacing: 0.5px; cursor: pointer; transition: background 0.15s;
}
.cc-save-btn:hover { background: #9a7d65; }
.cc-save-btn:disabled { opacity: 0.5; cursor: default; }
.cc-saved-pill {
  font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600; color: #4caf50;
  background: rgba(76,175,80,0.12); border: 1px solid rgba(76,175,80,0.3);
  padding: 4px 10px; letter-spacing: 0.3px;
}

.cc-tab-bar {
  position: fixed; top: 70px; left: 0; right: 0; height: 34px;
  display: flex; align-items: stretch;
  background: rgba(6,10,18,0.88);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(200,155,60,0.12);
  z-index: 999; padding: 0 6px; gap: 2px; overflow-x: auto; overflow-y: hidden;
}
.cc-tab-bar::-webkit-scrollbar { display: none; }
.cc-tab-item {
  display: flex; align-items: center; gap: 5px; padding: 0 13px; height: 100%;
  background: transparent; border: none; border-bottom: 2px solid transparent;
  color: #5b6a7e; font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 500;
  cursor: pointer; white-space: nowrap; transition: all 0.15s; flex-shrink: 0;
}
.cc-tab-item:hover { color: #e8e0d0; background: rgba(200,155,60,0.06); }
.cc-tab-item.active { color: #c89b3c; border-bottom-color: #c89b3c; background: rgba(200,155,60,0.08); }
.cc-tab-count { font-size: 10px; color: #0ac8b9; font-weight: 600; margin-left: 2px; }

.cc-content { position: fixed; top: 104px; left: 0; right: 0; bottom: 0; display: flex; }

/* ── Left Panel ── */
.cc-panel {
  width: 230px; flex-shrink: 0;
  background: rgba(6,10,18,0.7);
  border-right: 1px solid rgba(200,155,60,0.10);
  display: flex; flex-direction: column;
}
.cc-panel-head {
  padding: 12px 14px 10px;
  border-bottom: 1px solid rgba(200,155,60,0.10);
  flex-shrink: 0;
}
.cc-panel-label {
  font-family: 'Cinzel', serif; font-size: 9px; color: #5b6a7e;
  letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;
}
.cc-cat-input-row { display: flex; gap: 6px; }
.cc-cat-input {
  flex: 1; padding: 7px 10px; background: rgba(0,0,0,0.3);
  border: 1px solid rgba(200,155,60,0.2); color: #c89b3c;
  font-family: 'Inter', sans-serif; font-size: 12px; outline: none;
  transition: border-color 0.15s;
}
.cc-cat-input:focus { border-color: #c89b3c; }
.cc-cat-input::placeholder { color: #3c4a5c; }
.cc-cat-add-btn {
  padding: 7px 10px; border: none; background: #7E6551; color: #FDF4DC;
  font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.cc-cat-add-btn:disabled { background: #2a3040; cursor: default; color: #3c4a5c; }
.cc-cat-add-btn:not(:disabled):hover { background: #9a7d65; }

.cc-cat-list { flex: 1; overflow-y: auto; padding: 6px; }
.cc-cat-item {
  padding: 9px 11px; margin-bottom: 3px; cursor: pointer;
  border: 1px solid transparent; transition: all 0.12s;
  display: flex; align-items: center; gap: 6px;
}
.cc-cat-item:hover { background: rgba(200,155,60,0.04); border-color: rgba(200,155,60,0.1); }
.cc-cat-item.selected { background: rgba(126,101,81,0.15); border-color: rgba(126,101,81,0.4); }
.cc-cat-text { flex: 1; min-width: 0; }
.cc-cat-name { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; color: #7b8a9e; transition: color 0.12s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cc-cat-item.selected .cc-cat-name { color: #c89b3c; }
.cc-cat-sub { font-family: 'Inter', sans-serif; font-size: 10px; color: #3c4a5c; margin-top: 2px; }
.cc-cat-edit-btn {
  background: transparent; border: none; color: #3c4a5c; cursor: pointer;
  font-size: 11px; padding: 2px 3px; opacity: 0; flex-shrink: 0;
  transition: opacity 0.12s, color 0.12s;
}
.cc-cat-item:hover .cc-cat-edit-btn { opacity: 1; }
.cc-cat-edit-btn:hover { color: #c89b3c; }
.cc-cat-edit-input {
  width: 100%; padding: 2px 6px; background: rgba(0,0,0,0.4);
  border: 1px solid #c89b3c; color: #c89b3c;
  font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; outline: none;
}
.cc-cat-del { background: transparent; border: none; color: #5b3535; cursor: pointer; font-size: 13px; padding: 1px 3px; opacity: 0.6; flex-shrink: 0; transition: opacity 0.12s, color 0.12s; }
.cc-cat-item:hover .cc-cat-del { opacity: 1; }
.cc-cat-del:hover { color: #e05252; }
.cc-cat-empty { padding: 24px 12px; font-family: 'Inter', sans-serif; font-size: 11px; color: #3c4a5c; text-align: center; line-height: 1.6; }

/* ── Main Area ── */
.cc-main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.cc-search-bar {
  padding: 10px 16px; border-bottom: 1px solid rgba(200,155,60,0.10);
  display: flex; gap: 12px; align-items: center; flex-shrink: 0;
  background: rgba(6,10,18,0.5);
}
.cc-search {
  flex: 1; max-width: 300px; padding: 7px 12px;
  background: rgba(0,0,0,0.3); border: 1px solid rgba(200,155,60,0.2);
  color: #c89b3c; font-family: 'Inter', sans-serif; font-size: 12px; outline: none;
  transition: border-color 0.15s;
}
.cc-search:focus { border-color: #c89b3c; }
.cc-search::placeholder { color: #3c4a5c; }
.cc-search-hint { font-family: 'Inter', sans-serif; font-size: 11px; color: #3c4a5c; }
.cc-search-hint.assigning { color: #7E6551; }
.cc-search-count { font-family: 'Inter', sans-serif; font-size: 10px; color: #2a3a50; margin-left: auto; white-space: nowrap; }

.cc-grid-wrap { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-wrap: wrap; gap: 10px; align-content: start; }

.cc-item {
  width: 80px; cursor: pointer; position: relative; user-select: none;
  transition: transform 0.1s;
}
.cc-item:hover { transform: translateY(-2px); }
.cc-item-img-wrap {
  width: 80px; height: 80px; background: #0a1628;
  border: 2px solid rgba(200,155,60,0.12); overflow: hidden;
  transition: border-color 0.12s, box-shadow 0.12s; position: relative;
}
.cc-item.star1 .cc-item-img-wrap { border-color: #cd7f32; box-shadow: 0 0 8px rgba(205,127,50,0.3); }
.cc-item.star2 .cc-item-img-wrap { border-color: #c0c0c0; box-shadow: 0 0 8px rgba(192,192,192,0.3); }
.cc-item.star3 .cc-item-img-wrap { border-color: #ffd700; box-shadow: 0 0 10px rgba(255,215,0,0.35); }
.cc-item.in-cat .cc-item-img-wrap { border-color: rgba(200,155,60,0.35); }
.cc-item-img { width: 100%; height: 100%; object-fit: cover; display: block; filter: brightness(0.7); transition: filter 0.12s; }
.cc-item.star1 .cc-item-img,
.cc-item.star2 .cc-item-img,
.cc-item.star3 .cc-item-img { filter: brightness(1); }
.cc-star-badge {
  position: absolute; top: 3px; right: 3px;
  background: rgba(0,0,0,0.85); padding: 1px 4px;
  font-size: 9px; font-weight: 700; line-height: 1.4;
}
.cc-item-name {
  margin-top: 4px; font-family: 'Inter', sans-serif; font-size: 8px;
  color: #3c4a5c; text-align: center; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; transition: color 0.12s;
}
.cc-item.star1 .cc-item-name,
.cc-item.star2 .cc-item-name,
.cc-item.star3 .cc-item-name { color: #a09070; }

.cc-loading {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 12px; color: #3c4a5c;
  font-family: 'Inter', sans-serif; font-size: 12px; letter-spacing: 1px;
}
.cc-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #3c4a5c; font-family: 'Inter', sans-serif; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; }

.cc-load-more-row { width: 100%; display: flex; justify-content: center; padding: 12px 0 4px; }
.cc-load-more-btn {
  padding: 7px 22px; background: transparent; border: 1px solid rgba(200,155,60,0.2);
  color: #5b6a7e; font-family: 'Inter', sans-serif; font-size: 11px; cursor: pointer;
  transition: all 0.15s;
}
.cc-load-more-btn:hover { border-color: #c89b3c; color: #c89b3c; }

/* ── Borders Tab ── */
.cc-item.has-border .cc-item-img-wrap { border-color: #c89b3c; box-shadow: 0 0 12px rgba(200,155,60,0.45); }
.cc-item.has-border .cc-item-img { filter: brightness(1); }
.cc-item.has-border .cc-item-name { color: #c89b3c; }
.cc-border-label { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(200,155,60,0.9); font-size: 7px; font-weight: 700; color: #080c14; text-align: center; padding: 2px 0; letter-spacing: 0.06em; pointer-events: none; }
.cc-borders-hint { padding: 10px 20px 0; font-family: 'Inter', sans-serif; font-size: 11px; color: rgba(200,155,60,0.45); letter-spacing: 0.02em; }
.cc-disclaimer-panel { margin: 10px 20px 0; padding: 12px 14px; background: rgba(10,22,40,0.7); border: 1px solid rgba(200,155,60,0.15); display: flex; flex-direction: column; gap: 10px; }
.cc-disclaimer-row { display: flex; align-items: center; gap: 10px; }
.cc-disclaimer-label { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600; color: #7b8a9e; letter-spacing: 0.05em; text-transform: uppercase; flex-shrink: 0; }
.cc-toggle { position: relative; width: 34px; height: 18px; flex-shrink: 0; cursor: pointer; }
.cc-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.cc-toggle-track { position: absolute; inset: 0; background: #1e2535; border: 1px solid rgba(200,155,60,0.2); transition: background 0.2s, border-color 0.2s; }
.cc-toggle input:checked + .cc-toggle-track { background: rgba(200,155,60,0.25); border-color: rgba(200,155,60,0.5); }
.cc-toggle-thumb { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; background: #3c4a5c; transition: transform 0.2s, background 0.2s; }
.cc-toggle input:checked + .cc-toggle-track + .cc-toggle-thumb,
.cc-toggle input:checked ~ .cc-toggle-thumb { background: #c89b3c; transform: translateX(16px); }
.cc-disclaimer-input { flex: 1; padding: 7px 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(200,155,60,0.2); color: #c89b3c; font-family: 'Inter', sans-serif; font-size: 11px; outline: none; transition: border-color 0.15s; }
.cc-disclaimer-input:focus { border-color: rgba(200,155,60,0.5); }
.cc-disclaimer-input::placeholder { color: #3c4a5c; }
.cc-disclaimer-preview { font-family: 'Inter', sans-serif; font-size: 10px; color: rgba(200,155,60,0.4); font-style: italic; }

/* ── Categories Tab ── */
.cc-categories-wrap { flex: 1; overflow-y: auto; padding: 20px 24px; }
.cc-categories-hint { font-family: 'Inter', sans-serif; font-size: 11px; color: #3c4a5c; margin-bottom: 16px; line-height: 1.6; }
.cc-cat-priority-item {
  display: flex; align-items: center; gap: 12px; padding: 12px 16px;
  background: rgba(10,22,40,0.6); border: 1px solid rgba(200,155,60,0.1);
  margin-bottom: 6px; transition: border-color 0.12s;
}
.cc-cat-priority-item:hover { border-color: rgba(200,155,60,0.2); }
.cc-reorder-btns { display: flex; flex-direction: column; gap: 0; flex-shrink: 0; }
.cc-reorder-btn {
  width: 18px; height: 14px; background: transparent; border: none;
  color: #3c4a5c; cursor: pointer; font-size: 10px; padding: 0; line-height: 1;
  transition: color 0.12s;
}
.cc-reorder-btn:not(:disabled):hover { color: #c89b3c; }
.cc-reorder-btn:disabled { color: #1e2535; cursor: default; }
.cc-prio-info { flex: 1; min-width: 0; }
.cc-prio-name { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #c2bdb3; }
.cc-prio-name-input {
  width: 100%; padding: 2px 6px; background: rgba(0,0,0,0.4);
  border: 1px solid #c89b3c; color: #c89b3c;
  font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; outline: none;
}
.cc-prio-sub { font-family: 'Inter', sans-serif; font-size: 10px; color: #3c4a5c; margin-top: 2px; }
.cc-prio-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.cc-prio-key { font-family: 'monospace', monospace; font-size: 10px; color: #2a3a50; }
.cc-prio-edit-btn { background: transparent; border: none; color: #3c4a5c; cursor: pointer; font-size: 12px; padding: 2px 4px; opacity: 0; transition: opacity 0.12s, color 0.12s; }
.cc-cat-priority-item:hover .cc-prio-edit-btn { opacity: 1; }
.cc-prio-edit-btn:hover { color: #c89b3c; }
.cc-prio-del { background: transparent; border: none; color: #5b3535; cursor: pointer; font-size: 14px; padding: 2px 4px; opacity: 0.5; transition: opacity 0.12s, color 0.12s; }
.cc-cat-priority-item:hover .cc-prio-del { opacity: 1; }
.cc-prio-del:hover { color: #e05252; }
.cc-no-cats { padding: 64px 0; text-align: center; font-family: 'Inter', sans-serif; font-size: 11px; color: #3c4a5c; letter-spacing: 2px; text-transform: uppercase; }
`

// Module-level cache — persists for the page's lifetime, cleared on full reload.
const catalogCache = new Map()

async function loadTabCatalog(tabType) {
  if (!tabType) return []
  if (catalogCache.has(tabType)) return catalogCache.get(tabType)

  const toArr = x => Array.isArray(x) ? x : Object.values(x || {})
  let items = []

  if (tabType === 'skins') {
    const json = await fetch(`${CDN_BASE}/v1/skins.json`).then(r => r.json())
    const fromCDN = Object.values(json).filter(s => s && s.id % 1000 !== 0)
      .map(s => ({ id: s.id, name: s.name, imgSrc: cdnUrl(s.tilePath) }))
    const existingIds = new Set(fromCDN.map(s => s.id))
    items = [...fromCDN, ...MISSING_SKINS.filter(s => !existingIds.has(s.id))]
  } else if (tabType === 'chromas') {
    const json = await fetch(`${CDN_BASE}/v1/skins.json`).then(r => r.json())
    for (const s of Object.values(json).filter(s => s && s.id % 1000 !== 0)) {
      for (const c of (s.chromas || [])) items.push({ id: c.id, name: s.name, imgSrc: cdnUrl(c.chromaPath) })
    }
  } else if (tabType === 'emotes') {
    const json = await fetch(`${CDN_BASE}/v1/summoner-emotes.json`).then(r => r.json())
    items = toArr(json).filter(e => e.id != null).map(e => ({ id: e.id, name: e.name || '', imgSrc: cdnUrl(e.inventoryIcon || e.iconPath) }))
  } else if (tabType === 'icons') {
    const json = await fetch(`${CDN_BASE}/v1/summoner-icons.json`).then(r => r.json())
    items = toArr(json).filter(i => i.id > 0).map(i => ({ id: i.id, name: i.title || i.name || '', imgSrc: cdnUrl(i.imagePath) }))
  } else if (tabType === 'wards') {
    const json = await fetch(`${CDN_BASE}/v1/ward-skins.json`).then(r => r.json())
    items = toArr(json).filter(w => w.id != null).map(w => ({ id: w.id, name: w.name || '', imgSrc: cdnUrl(w.wardImagePath) }))
  } else if (tabType === 'finishers') {
    const json = await fetch(`${CDN_BASE}/v1/nexusfinishers.json`).then(r => r.json())
    items = toArr(json).filter(f => f.itemId != null).map(f => ({ id: f.itemId, name: f.name || '', imgSrc: cdnUrl(f.loadoutsIcon) }))
  } else if (tabType === 'tft_damage_skins') {
    const json = await fetch(`${CDN_BASE}/v1/tftdamageskins.json`).then(r => r.json())
    items = toArr(json).filter(d => d.itemId != null).map(d => ({ id: d.itemId, name: d.name || '', imgSrc: cdnUrl(d.loadoutsIcon) }))
  } else if (tabType === 'tft_companions' || tabType === 'tft_map_skins') {
    const verJson = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then(r => r.json())
    const ver = verJson[0]
    const DDRAGON = `https://ddragon.leagueoflegends.com/cdn/${ver}`
    if (tabType === 'tft_companions') {
      const json = await fetch(`${DDRAGON}/data/en_US/tft-tactician.json`).then(r => r.json())
      items = Object.values(json?.data || {}).map(t => ({ id: parseInt(t.id), name: t.name, imgSrc: `${DDRAGON}/img/${t.image?.group}/${t.image?.full}` }))
    } else {
      const json = await fetch(`${DDRAGON}/data/en_US/tft-arena.json`).then(r => r.json())
      items = Object.values(json?.data || {}).map(a => ({ id: parseInt(a.id), name: a.name, imgSrc: `${DDRAGON}/img/${a.image?.group}/${a.image?.full}` }))
    }
  }

  catalogCache.set(tabType, items)
  return items
}

export default function CheckerCategoriesPage() {
  const { gameId } = useParams()
  const [gameName, setGameName]           = useState('')
  const [categories, setCategories]       = useState([])
  const [activeTab, setActiveTab]         = useState('SKINS')
  const [catalog, setCatalog]             = useState([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [selectedCatId, setSelectedCatId] = useState(null)
  const [search, setSearch]               = useState('')
  const [newCatName, setNewCatName]       = useState('')
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)
  const [loading, setLoading]             = useState(true)
  const [renderLimit, setRenderLimit]     = useState(RENDER_BATCH)
  const [editingCatId, setEditingCatId]   = useState(null)
  const [editingCatName, setEditingCatName] = useState('')
  const [borderSkinIds, setBorderSkinIds]         = useState(new Set())
  const DEFAULT_DISCLAIMER = 'Border detection is ~95% accurate — some skins may have a border but not be marked.'
  const [disclaimerEnabled, setDisclaimerEnabled] = useState(true)
  const [disclaimerMsg, setDisclaimerMsg]         = useState('')
  const editInputRef = useRef(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/game-configs').then(r => r.json()).catch(() => []),
      fetch('/api/games').then(r => r.json()).catch(() => []),
    ]).then(([configs, games]) => {
      const cfg = Array.isArray(configs) ? configs.find(c => String(c.game_id) === String(gameId) && c.section === 'checker_categories') : null
      const cats = cfg?.config?.categories || []
      setCategories(cats.map(c => ({ ...c, items: [...(c.items || [])] })))
      const borderIds = cfg?.config?.border_skin_ids || []
      if (borderIds.length) setBorderSkinIds(new Set(borderIds))
      setDisclaimerEnabled(cfg?.config?.disclaimer_enabled ?? true)
      setDisclaimerMsg(cfg?.config?.disclaimer_msg || '')
      const game = Array.isArray(games) ? games.find(g => String(g.id) === String(gameId)) : null
      setGameName(game?.name || `Game ${gameId}`)
      setLoading(false)
    })
  }, [gameId])

  useEffect(() => {
    const tabInfo = CAT_TABS.find(t => t.id === activeTab)
    if (!tabInfo?.type) { setCatalog([]); setCatalogLoading(false); return }
    // If cached, apply immediately with no loading state
    if (catalogCache.has(tabInfo.type)) {
      setCatalog(catalogCache.get(tabInfo.type))
      setCatalogLoading(false)
      return
    }
    setCatalog([])
    setCatalogLoading(true)
    loadTabCatalog(tabInfo.type)
      .then(items => { setCatalog(items); setCatalogLoading(false) })
      .catch(() => { setCatalog([]); setCatalogLoading(false) })
  }, [activeTab])

  // Reset render limit when search changes
  useEffect(() => { setRenderLimit(RENDER_BATCH) }, [search, activeTab])

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingCatId && editInputRef.current) editInputRef.current.focus()
  }, [editingCatId])

  const activeType = CAT_TABS.find(t => t.id === activeTab)?.type
  const tabCategories = categories.filter(c => c.type === activeType)
  const selectedCat = categories.find(c => c.id === selectedCatId)

  const filteredCatalog = search
    ? catalog.filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
    : catalog

  // When searching: show all matches. When browsing: limit to renderLimit.
  const displayedItems = search ? filteredCatalog : filteredCatalog.slice(0, renderLimit)
  const hasMore = !search && filteredCatalog.length > renderLimit

  const getStars = itemId => {
    if (!selectedCatId) return 0
    return selectedCat?.items.find(i => i.id === itemId)?.stars || 0
  }
  const isInAnyCat = itemId => tabCategories.some(c => c.items.some(i => i.id === itemId))

  const toggleItem = useCallback(item => {
    if (!selectedCatId) return
    setCategories(prev => prev.map(cat => {
      if (cat.id !== selectedCatId) return cat
      const ex = cat.items.find(i => i.id === item.id)
      if (!ex) return { ...cat, items: [...cat.items, { id: item.id, name: item.name, stars: 1 }] }
      if (ex.stars < 3) return { ...cat, items: cat.items.map(i => i.id === item.id ? { ...i, stars: i.stars + 1 } : i) }
      return { ...cat, items: cat.items.filter(i => i.id !== item.id) }
    }))
  }, [selectedCatId])

  const toggleBorder = useCallback(item => {
    setBorderSkinIds(prev => {
      const next = new Set(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
  }, [])

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
    if (editingCatId === catId) setEditingCatId(null)
  }

  const moveCat = (catId, dir) => {
    setCategories(prev => {
      const idx = prev.findIndex(c => c.id === catId)
      if (idx < 0) return prev
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
      return arr
    })
  }

  const startEdit = (cat, e) => {
    e.stopPropagation()
    setEditingCatId(cat.id)
    setEditingCatName(cat.name)
  }

  const commitEdit = () => {
    if (editingCatId && editingCatName.trim()) {
      setCategories(prev => prev.map(c => c.id === editingCatId ? { ...c, name: editingCatName.trim() } : c))
    }
    setEditingCatId(null)
  }

  const handleEditKey = e => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditingCatId(null)
    e.stopPropagation()
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/game-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          section: 'checker_categories',
          config: { categories, border_skin_ids: [...borderSkinIds], disclaimer_enabled: disclaimerEnabled, disclaimer_msg: disclaimerMsg },
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const switchTab = tabId => {
    setActiveTab(tabId)
    setSearch('')
    setSelectedCatId(null)
    setEditingCatId(null)
  }

  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3c4a5c', fontFamily: 'Inter, sans-serif', fontSize: 12, letterSpacing: 2 }}>
          LOADING…
        </div>
      </>
    )
  }

  return (
    <>
      <style>{CSS}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <header className="cc-titlebar">
        <div className="cc-title-block">
          <div className="cc-title-game">{gameName}</div>
          <div className="cc-title-sub">Checker Categories</div>
        </div>
        <div className="cc-title-right">
          {saved && <div className="cc-saved-pill">Saved ✓</div>}
          <button className="cc-back-btn" onClick={() => { if (window.history.length > 1) window.history.back(); else window.close() }}>← Back</button>
          <button className="cc-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      <nav className="cc-tab-bar">
        {CAT_TABS.map(t => {
          const count = t.id === 'BORDERS'
            ? borderSkinIds.size
            : t.type ? categories.filter(c => c.type === t.type).length : categories.length
          return (
            <button key={t.id} className={`cc-tab-item${activeTab === t.id ? ' active' : ''}`} onClick={() => switchTab(t.id)}>
              <span>{t.icon}</span>
              {t.label}
              {count > 0 && <span className="cc-tab-count">{count}</span>}
            </button>
          )
        })}
      </nav>

      <div className="cc-content">
        {activeTab === 'BORDERS' ? (
          <div className="cc-main" style={{ width: '100%' }}>
            <div className="cc-search-bar">
              <input
                className="cc-search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search skins…"
              />
              <span className="cc-search-hint">Click a skin to mark it as always having a border from purchase</span>
              {!catalogLoading && <span className="cc-search-count">{borderSkinIds.size} skin{borderSkinIds.size !== 1 ? 's' : ''} marked</span>}
            </div>
            <div className="cc-borders-hint">
              ⬡ These skins come with a border the moment they are obtained — no bundle or vintage flag needed.
            </div>

            <div className="cc-disclaimer-panel">
              <div className="cc-disclaimer-row">
                <span className="cc-disclaimer-label">Disclaimer Tag</span>
                <label className="cc-toggle">
                  <input type="checkbox" checked={disclaimerEnabled} onChange={e => setDisclaimerEnabled(e.target.checked)} />
                  <div className="cc-toggle-track" />
                  <div className="cc-toggle-thumb" />
                </label>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: disclaimerEnabled ? '#c89b3c' : '#3c4a5c' }}>
                  {disclaimerEnabled ? 'Showing on Skins tab' : 'Hidden'}
                </span>
              </div>
              {disclaimerEnabled && (
                <div className="cc-disclaimer-row">
                  <span className="cc-disclaimer-label">Message</span>
                  <input
                    className="cc-disclaimer-input"
                    value={disclaimerMsg}
                    onChange={e => setDisclaimerMsg(e.target.value)}
                    placeholder={DEFAULT_DISCLAIMER}
                  />
                </div>
              )}
              {disclaimerEnabled && (
                <div className="cc-disclaimer-preview">
                  Preview: <span style={{ opacity: 0.8 }}>⚠</span> {disclaimerMsg || DEFAULT_DISCLAIMER}
                </div>
              )}
            </div>
            {catalogLoading ? (
              <div className="cc-loading">
                <div style={{ fontSize: 24, opacity: 0.4 }}>◈</div>
                Loading catalog…
              </div>
            ) : (
              <div className="cc-grid-wrap">
                {displayedItems.length === 0 ? (
                  <div className="cc-empty">{search ? 'No matches' : 'No skins found'}</div>
                ) : displayedItems.map(item => {
                  const hasBorder = borderSkinIds.has(item.id)
                  return (
                    <div
                      key={item.id}
                      className={`cc-item${hasBorder ? ' has-border' : ''}`}
                      onClick={() => toggleBorder(item)}
                      title={item.name}
                    >
                      <div className="cc-item-img-wrap">
                        {item.imgSrc
                          ? <img src={item.imgSrc} alt="" className="cc-item-img" loading="lazy" onError={e => { e.target.style.opacity = 0 }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e2535', fontSize: 22 }}>◈</div>
                        }
                        {hasBorder && <div className="cc-border-label">BORDER</div>}
                      </div>
                      <div className="cc-item-name">{item.name}</div>
                    </div>
                  )
                })}
                {hasMore && (
                  <div className="cc-load-more-row">
                    <button className="cc-load-more-btn" onClick={() => setRenderLimit(p => p + RENDER_BATCH)}>
                      Load more ({(filteredCatalog.length - renderLimit).toLocaleString()} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'CATEGORIES' ? (
          <div className="cc-categories-wrap">
            <div className="cc-categories-hint">
              All categories in priority order — top = highest priority. The key shown in grey is what you map in the Field Mapper. Click ✎ to rename.
            </div>
            {categories.length === 0 ? (
              <div className="cc-no-cats">No categories yet · create them in the type tabs</div>
            ) : (
              categories.map((cat, idx) => {
                const tabLabel = CAT_TABS.find(t => t.type === cat.type)?.label || cat.type
                const isEditing = editingCatId === cat.id
                return (
                  <div key={cat.id} className="cc-cat-priority-item">
                    <div className="cc-reorder-btns">
                      <button className="cc-reorder-btn" onClick={() => moveCat(cat.id, -1)} disabled={idx === 0}>▲</button>
                      <button className="cc-reorder-btn" onClick={() => moveCat(cat.id, 1)} disabled={idx === categories.length - 1}>▼</button>
                    </div>
                    <div className="cc-prio-info">
                      {isEditing
                        ? <input
                            ref={editInputRef}
                            className="cc-prio-name-input"
                            value={editingCatName}
                            onChange={e => setEditingCatName(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleEditKey}
                          />
                        : <div className="cc-prio-name">{cat.name}</div>
                      }
                      <div className="cc-prio-sub">{tabLabel} · {cat.items.length} item{cat.items.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="cc-prio-actions">
                      <span className="cc-prio-key">cat_{cat.id.slice(0, 8)}</span>
                      <button className="cc-prio-edit-btn" onClick={e => startEdit(cat, e)} title="Rename">✎</button>
                      <button className="cc-prio-del" onClick={() => deleteCategory(cat.id)}>✕</button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <>
            <div className="cc-panel">
              <div className="cc-panel-head">
                <div className="cc-panel-label">Categories</div>
                <div className="cc-cat-input-row">
                  <input
                    className="cc-cat-input"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCategory() }}
                    placeholder="New category…"
                  />
                  <button className="cc-cat-add-btn" onClick={addCategory} disabled={!newCatName.trim()}>+</button>
                </div>
              </div>
              <div className="cc-cat-list">
                {tabCategories.length === 0 ? (
                  <div className="cc-cat-empty">No categories for this type.<br />Type a name above and press Enter.</div>
                ) : tabCategories.map(cat => {
                  const isEditing = editingCatId === cat.id
                  return (
                    <div
                      key={cat.id}
                      className={`cc-cat-item${selectedCatId === cat.id ? ' selected' : ''}`}
                      onClick={() => { if (!isEditing) setSelectedCatId(selectedCatId === cat.id ? null : cat.id) }}
                    >
                      <div className="cc-cat-text">
                        {isEditing
                          ? <input
                              ref={editInputRef}
                              className="cc-cat-edit-input"
                              value={editingCatName}
                              onChange={e => setEditingCatName(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={handleEditKey}
                              onClick={e => e.stopPropagation()}
                            />
                          : <div className="cc-cat-name">{cat.name}</div>
                        }
                        <div className="cc-cat-sub">{cat.items.length} item{cat.items.length !== 1 ? 's' : ''}</div>
                      </div>
                      <button className="cc-cat-edit-btn" onClick={e => startEdit(cat, e)} title="Rename">✎</button>
                      <button className="cc-cat-del" onClick={e => { e.stopPropagation(); deleteCategory(cat.id) }}>✕</button>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="cc-main">
              <div className="cc-search-bar">
                <input
                  className="cc-search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search items…"
                />
                {selectedCatId
                  ? <span className="cc-search-hint assigning">Assigning to <strong>{selectedCat?.name}</strong> · click to cycle ★→★★→★★★→off</span>
                  : <span className="cc-search-hint">← Select a category to start assigning</span>
                }
                {!catalogLoading && catalog.length > 0 && (
                  <span className="cc-search-count">
                    {search
                      ? `${filteredCatalog.length} result${filteredCatalog.length !== 1 ? 's' : ''}`
                      : `${Math.min(renderLimit, catalog.length).toLocaleString()} / ${catalog.length.toLocaleString()}`
                    }
                  </span>
                )}
              </div>

              {catalogLoading ? (
                <div className="cc-loading">
                  <div style={{ fontSize: 24, opacity: 0.4 }}>◈</div>
                  Loading catalog…
                </div>
              ) : (
                <div className="cc-grid-wrap">
                  {displayedItems.length === 0 ? (
                    <div className="cc-empty">{search ? 'No matches' : 'No items found'}</div>
                  ) : displayedItems.map(item => {
                    const stars = getStars(item.id)
                    const inCat = isInAnyCat(item.id)
                    const starClass = stars > 0 ? `star${stars}` : inCat ? 'in-cat' : ''
                    return (
                      <div
                        key={item.id}
                        className={`cc-item${starClass ? ` ${starClass}` : ''}`}
                        onClick={() => toggleItem(item)}
                        title={item.name}
                      >
                        <div className="cc-item-img-wrap">
                          {item.imgSrc
                            ? <img src={item.imgSrc} alt="" className="cc-item-img" loading="lazy" onError={e => { e.target.style.opacity = 0 }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e2535', fontSize: 22 }}>◈</div>
                          }
                          {stars > 0 && (
                            <div className="cc-star-badge" style={{ color: STAR_COLORS[stars] }}>
                              {'★'.repeat(stars)}
                            </div>
                          )}
                        </div>
                        <div className="cc-item-name">{item.name}</div>
                      </div>
                    )
                  })}
                  {hasMore && (
                    <div className="cc-load-more-row">
                      <button className="cc-load-more-btn" onClick={() => setRenderLimit(p => p + RENDER_BATCH)}>
                        Load more ({(filteredCatalog.length - renderLimit).toLocaleString()} remaining)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
