'use client'
import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'

const CDN = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default'

function cdnUrl(p) {
  if (!p) return ''
  return CDN + p.toLowerCase().replace('/lol-game-data/assets', '')
}

// Skins absent from CommunityDragon's skins.json — injected manually.
// tilePath follows the standard CDR naming: /v1/champion-tiles/{name}/{name}_{skinNum}.jpg
// tilePath uses /assets/... prefix (not /lol-game-data/assets/...) so cdnUrl() passes it through correctly.
const MISSING_SKINS_MAP = {
  103085: { id: 103085, name: 'Risen Legend Ahri',          tilePath: '/assets/characters/ahri/skins/skin85/images/ahri_splash_tile_85.jpg' },
  103086: { id: 103086, name: 'Immortalized Legend Ahri',   tilePath: '/assets/characters/ahri/skins/skin86/images/ahri_splash_tile_86.jpg' },
  145070: { id: 145070, name: "Risen Legend Kai'Sa",        tilePath: '/assets/characters/kaisa/skins/skin70/images/kaisa_splash_tile_70.jpg' },
  145071: { id: 145071, name: "Immortalized Legend Kai'Sa", tilePath: '/assets/characters/kaisa/skins/skin71/images/kaisa_splash_tile_71.jpg' },
    7055: { id:   7055, name: 'Risen Legend LeBlanc',       tilePath: '/assets/characters/leblanc/skins/skin55/images/leblanc_splash_tile_55.jpg' },
   67064: { id:  67064, name: 'Risen Legend Vayne',         tilePath: '/assets/characters/vayne/skins/skin64/images/vayne_splash_tile_64.jpg' },
}
function resolveUrl(p) {
  if (!p) return ''
  if (p.startsWith('http')) return p
  return cdnUrl(p)
}
function profileIconUrl(id) {
  return `${CDN}/v1/profile-icons/${id}.jpg`
}

// Transcendent + Exalted added at top per user's rarity order
const RARITY_ORDER = ['kTranscendent', 'kExalted', 'kUltimate', 'kMythic', 'kLegendary', 'kEpic', 'kRare', 'kNoRarity']
const RARITY_LABEL = {
  kTranscendent: 'TRANSCENDENT', kExalted: 'EXALTED',
  kUltimate: 'ULTIMATE', kMythic: 'MYTHIC', kLegendary: 'LEGENDARY',
  kEpic: 'EPIC', kRare: 'STANDARD', kNoRarity: 'STANDARD',
}
const RARITY_GLOW = {
  kTranscendent: '#ffffff66', kExalted: '#e0c8ff66',
  kUltimate: '#d4a01766', kMythic: '#c45cc466', kLegendary: '#d4701a66',
  kEpic: '#4a90d966', kRare: 'transparent', kNoRarity: 'transparent',
}
const BORDER_SRC = {
  kTranscendent: '/borders/borders_transcendent.png', kExalted: '/borders/borders_exalted.png',
  kUltimate: '/borders/borders_ultimate.png', kMythic: '/borders/borders_mythic.png',
  kLegendary: '/borders/borders_legendary.png', kEpic: '/borders/borders_epic.png',
  kRare: '/borders/borders_normal.png', kNoRarity: '/borders/borders_normal.png',
}
const GEM_SRC = {
  kTranscendent: '/tier-icons/transcendent.png', kExalted: '/tier-icons/exalted.png',
  kUltimate: '/tier-icons/ultimate.png', kMythic: '/tier-icons/mythic.png',
  kLegendary: '/tier-icons/legendary.png', kEpic: '/tier-icons/epic.png',
  kRare: '/tier-icons/standard.png', kNoRarity: '/tier-icons/standard.png',
}

const TABS = [
  { id: 'OVERVIEW',  label: 'Overview',   icon: '⬡' },
  { id: 'MASTERY',   label: 'Mastery',    icon: '★' },
  { id: 'SKINS',     label: 'Skins',      icon: '⚔' },
  { id: 'EMOTES',    label: 'Emotes',     icon: '💬' },
  { id: 'ICONS',     label: 'Icons',      icon: '🎭' },
  { id: 'WARDS',     label: 'Wards',      icon: '🏮' },
  { id: 'CHROMAS',   label: 'Chromas',    icon: '◈' },
  { id: 'FINISHERS', label: 'Finishers',  icon: '✨' },
  { id: 'LOOT',      label: 'Loot',       icon: '🔮' },
  { id: 'TFT',       label: 'TFT',        icon: '♟' },
]

// ─── 20% reduced from original dimensions ────────────────────────────────────
const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: #080c14 url('/background.png') center center / cover no-repeat;
  color: #e8e0d0;
  -webkit-font-smoothing: antialiased;
}
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #785a28; border-radius: 4px; min-height: 64px; }
::-webkit-scrollbar-thumb:hover { background: #c8aa6e; }

/* ── Titlebar ── */
.rv-titlebar {
  position: fixed; top: 0; left: 0; right: 0; height: 76px;
  display: flex; align-items: center;
  background: rgba(6,10,18,0.45);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(200,155,60,0.12);
  z-index: 1000; padding: 0 14px 0 16px; gap: 0;
}
.rv-summoner-profile { display: flex; align-items: center; gap: 12px; flex: 1; }
.rv-avatar-wrapper {
  position: relative; width: 54px; height: 54px; border-radius: 50%;
  border: 2px solid #00c7db; padding: 2px; background: #010a13;
  box-shadow: 0 0 8px rgba(0,199,219,0.4);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.rv-avatar { width: 100%; height: 100%; border-radius: 50%; border: 1px solid #c89b3c; object-fit: cover; }
.rv-level-outer {
  position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%);
  width: 42px; height: 19px; background: #c89b3c;
  clip-path: polygon(20% 0, 80% 0, 100% 50%, 80% 100%, 20% 100%, 0 50%);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 3px 5px rgba(0,0,0,0.8);
}
.rv-level-inner {
  width: 38px; height: 15px; background: #1e282d;
  clip-path: polygon(20% 0, 80% 0, 100% 50%, 80% 100%, 20% 100%, 0 50%);
  color: #a09b8c; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; letter-spacing: 0.05em;
}
.rv-summoner-details { display: flex; flex-direction: column; justify-content: center; }
.rv-summoner-name { font-family: 'Cinzel', serif; font-size: 18px; font-weight: 700; color: #c89b3c; letter-spacing: 0.06em; line-height: 1.1; }
.rv-summoner-tag { color: #7b8a9e; font-weight: 400; font-size: 13px; font-family: 'Inter', sans-serif; margin-left: 3px; }
.rv-summoner-sub { font-family: 'Inter', sans-serif; font-size: 11px; color: #3c4a5c; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 2px; }

.rv-titlebar-right { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.rv-currency { display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.3); border: 1px solid rgba(200,155,60,0.15); padding: 4px 8px; }
.rv-currency-val { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 700; color: #c89b3c; }
.rv-currency-be { color: #5b9bd5; }
.rv-currency-label { font-family: 'Inter', sans-serif; font-size: 10px; color: #7b8a9e; }
.rv-hide-btn { background: transparent; border: 1px solid rgba(200,155,60,0.3); color: #7b8a9e; padding: 5px 11px; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 1px; cursor: pointer; transition: all 0.2s; }
.rv-hide-btn:hover { border-color: #c89b3c; color: #e8e0d0; }

/* ── Tab Bar ── */
.rv-tab-bar {
  position: fixed; top: 76px; left: 0; right: 0; height: 30px;
  display: flex; align-items: stretch;
  background: rgba(6,10,18,0.85);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(200,155,60,0.12);
  z-index: 999; padding: 0 6px; gap: 2px; overflow-x: auto; overflow-y: hidden;
}
.rv-tab-bar::-webkit-scrollbar { display: none; }
.rv-tab-item {
  display: flex; align-items: center; gap: 5px; padding: 0 11px; height: 100%;
  background: transparent; border: none; border-bottom: 2px solid transparent;
  color: #7b8a9e; font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 500;
  cursor: pointer; white-space: nowrap; transition: all 0.15s; flex-shrink: 0;
}
.rv-tab-item:hover { color: #e8e0d0; background: rgba(200,155,60,0.06); }
.rv-tab-item.active { color: #c89b3c; border-bottom-color: #c89b3c; background: rgba(200,155,60,0.08); }
.rv-tab-icon { font-size: 12px; line-height: 1; }
.rv-tab-count { font-size: 10px; color: #0ac8b9; font-weight: 600; margin-left: 2px; }

/* ── Content ── */
.rv-content { position: fixed; top: 106px; left: 0; right: 0; bottom: 0; display: flex; }

/* ── Panel ── */
.rv-panel {
  width: 280px; flex-shrink: 0; background: transparent;
  display: flex; flex-direction: column;
  padding: 18px 24px 16px; overflow-y: auto; position: relative;
  scrollbar-gutter: stable;
}
.rv-control-pane { position: relative; width: 100%; }
.rv-cp-bg { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; pointer-events: none; z-index: 0; }
.rv-cp-top { width: 100%; height: 178px; background: url('/control-pane/control-pane-frame-top.png') top center / 100% auto no-repeat; flex-shrink: 0; }
.rv-cp-mid { width: 100%; flex-grow: 1; background: url('/control-pane/control-pane-frame-mid.png') top center / 100% auto repeat-y; }
.rv-cp-bot { width: 100%; height: 16px; background: url('/control-pane/control-pane-frame-bot.png') top center / 100% auto no-repeat; flex-shrink: 0; }
.rv-cp-content { position: relative; z-index: 1; display: flex; flex-direction: column; padding: 18px 12px 18px; }
.rv-stats-ring-wrap { display: flex; justify-content: center; padding: 12px 0 10px; }
.rv-stats-ring { width: 112px; height: 112px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.rv-stats-ring-num { font-family: 'Times New Roman', Times, serif; font-size: 51px; font-weight: 700; color: #ceae78; line-height: 1; letter-spacing: 0.01em; white-space: nowrap; }
.rv-stats-ring-num.sm { font-size: 38px; }
.rv-stats-ring-num.xs { font-size: 29px; }
.rv-stats-ring-label { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600; color: #b8b6b3; text-transform: uppercase; letter-spacing: 0.1em; text-align: center; line-height: 1.3; margin-top: 3px; }
.rv-rarity-gems { display: flex; justify-content: center; gap: 10px; padding: 58px 0 13px; border-bottom: 2px solid rgba(200,155,60,0.25); flex-wrap: wrap; }
.rv-gem-item { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.rv-gem { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; }
.rv-gem img { width: 100%; height: 100%; object-fit: contain; }
.rv-gem-count { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500; color: #a09070; }
.rv-mini-stats { display: flex; justify-content: center; gap: 22px; padding: 16px 0 10px; }
.rv-mini-stat { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.rv-mini-stat-icon { width: 26px; height: 26px; object-fit: contain; }
.rv-mini-stat-val { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500; color: #a09070; }
.rv-mini-stat-sub { font-family: 'Inter', sans-serif; font-size: 10px; color: #7b8a9e; margin-top: -3px; }
.rv-panel-divider { border: none; border-top: 1px solid rgba(200,155,60,0.08); margin: 3px 0; }
.rv-panel-controls { margin-top: 18px; display: flex; flex-direction: column; flex: 1; }
.rv-search-wrap { position: relative; margin-bottom: 14px; }
.rv-search-icon { width: 14px; height: 14px; position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #f0e6d0; pointer-events: none; }
.rv-search { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid #7a5c29; color: #c99c3e; font-family: 'Inter', sans-serif; font-size: 13px; padding: 9px 11px 9px 32px; outline: none; transition: border-color 0.2s; }
.rv-search:focus { border-color: #b98a25; }
.rv-search::placeholder { color: #6a6a6a; }
.rv-currency-panel { margin-top: 12px; display: flex; flex-direction: column; gap: 5px; padding: 10px 4px; border-top: 1px solid rgba(200,155,60,0.08); }
.rv-currency-row { display: flex; align-items: center; gap: 6px; }
.rv-currency-row-val { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; color: #e8e0d0; }
.rv-currency-row-label { font-family: 'Inter', sans-serif; font-size: 11px; color: #7b8a9e; margin-left: auto; }

/* ── Dropdowns ── */
.rv-dropdown-wrap { position: relative; margin-bottom: 14px; }
.rv-dropdown-btn { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 5px; background: rgba(0,0,0,0.3); border: 1px solid #a48952; color: #c2bdb3; font-family: 'Inter', sans-serif; font-size: 13px; padding: 9px 11px; cursor: pointer; transition: border-color 0.2s; }
.rv-dropdown-btn:hover { border-color: #d8b878; }
.rv-dropdown-wrap.locked .rv-dropdown-btn { cursor: not-allowed; opacity: 0.5; border-color: #4a4033; color: #6a6558; pointer-events: none; }
.rv-dropdown-arrow { font-size: 11px; color: #ac862f; }
.rv-dropdown-menu {
  position: absolute; left: 0; right: 0; bottom: calc(100% + 4px);
  display: flex; flex-direction: column;
  background: #010a13; border: 1px solid #a48952; z-index: 500;
  overflow: hidden; box-shadow: 0 -8px 30px rgba(0,0,0,0.6);
  opacity: 0; transform: scaleY(0); transform-origin: bottom center;
  transition: opacity 0.15s ease, transform 0.15s cubic-bezier(0.2,0.8,0.2,1);
  pointer-events: none;
}
.rv-dropdown-menu.open { opacity: 1; transform: scaleY(1); pointer-events: auto; }
.rv-dropdown-item { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 10px 13px; background: transparent; border: none; border-bottom: 1px solid rgba(200,155,60,0.15); color: #c2bdb3; font-family: 'Cinzel', serif; font-weight: 600; font-size: 13px; cursor: pointer; text-align: left; transition: background 0.2s, color 0.2s; }
.rv-dropdown-item:last-child { border-bottom: none; }
.rv-dropdown-item:hover { background: #111b2a; color: #c89b3c; }
.rv-dropdown-item.active { color: #c89b3c; }
.rv-dropdown-check { color: #c99c3e; font-size: 15px; display: none; }
.rv-dropdown-item.active .rv-dropdown-check { display: inline; }

/* ── Main ── */
.rv-main { flex: 1; overflow-y: auto; min-width: 0; }

/* ── Overview Tab ── */
.rv-overview { padding: 20px; display: flex; flex-direction: column; gap: 14px; max-width: 680px; }
.rv-overview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.rv-stat-card { background: #111b2a; border: 1px solid rgba(200,155,60,0.12); padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
.rv-stat-card-label { font-family: 'Inter', sans-serif; font-size: 10px; color: #5b6a7e; text-transform: uppercase; letter-spacing: 1px; }
.rv-stat-card-value { font-family: 'Cinzel', serif; font-size: 22px; font-weight: 700; color: #c89b3c; line-height: 1; }
.rv-stat-card-value.small { font-size: 14px; font-family: 'Inter', sans-serif; color: #e8e0d0; font-weight: 600; }
.rv-overview-section { font-family: 'Cinzel', serif; font-size: 11px; color: #7b8a9e; letter-spacing: 2px; text-transform: uppercase; border-bottom: 1px solid rgba(200,155,60,0.12); padding-bottom: 6px; margin-top: 4px; }

/* ── Skin Grid ── */
.rv-skin-grid {
  padding: 22px 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(144px, 173px));
  gap: 19px 32px;
  align-content: start;
  justify-content: center;
}

/* ── Group Header ── */
.rv-group-header { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; padding: 8px 0 3px; }
.rv-group-header-name { font-family: 'Cinzel', serif; font-size: 16px; font-weight: 700; color: #e8e0d0; letter-spacing: 0.04em; }
.rv-group-header-count { font-family: 'Inter', sans-serif; font-size: 13px; color: #0ac8b9; font-weight: 500; }
.rv-group-header-line { flex: 1; height: 1px; background: linear-gradient(to right, rgba(200,155,60,0.12), transparent); }
.rv-group-complete .rv-group-header-name { color: #f0c860; }
.rv-group-complete .rv-group-header-count { color: #c89b3c; }
.rv-group-complete .rv-group-header-count::after { content: ' ✓'; color: #f0c860; font-size: 11px; }
.rv-group-complete .rv-group-header-line { background: linear-gradient(to right, #c89b3c, transparent); }

/* ── Skin Card ── */
.skin-card {
  position: relative; overflow: visible; cursor: pointer; background: transparent;
  width: 100%; aspect-ratio: 260 / 381; margin-bottom: 21px;
  transition: transform 0.2s cubic-bezier(0.4,0,0.2,1), filter 0.2s cubic-bezier(0.4,0,0.2,1);
}
.skin-card:hover { transform: translateY(-3px) scale(1.015); filter: drop-shadow(0 0 14px rgba(200,155,60,0.2)) drop-shadow(0 3px 16px rgba(0,0,0,0.5)); }
.skin-card.ultimate:hover { filter: drop-shadow(0 0 11px #ef4a60) drop-shadow(0 3px 10px rgba(0,0,0,0.8)); }
.skin-card.mythic:hover { filter: drop-shadow(0 0 11px #ee4fa0) drop-shadow(0 3px 10px rgba(0,0,0,0.8)); }
.skin-card.legendary:hover { filter: drop-shadow(0 0 11px #ff8c00) drop-shadow(0 3px 10px rgba(0,0,0,0.8)); }
.skin-card.epic:hover { filter: drop-shadow(0 0 11px #4aa8d8) drop-shadow(0 3px 10px rgba(0,0,0,0.8)); }
.skin-card-mask {
  position: absolute; inset: 0; z-index: 1;
  -webkit-mask-image: url('/borders/card-mask.png'); -webkit-mask-size: 100% 100%; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat;
  mask-image: url('/borders/card-mask.png'); mask-size: 100% 100%; mask-position: center; mask-repeat: no-repeat;
}
.skin-card-img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
.skin-card-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 24px 6px 16px; background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%); z-index: 2; pointer-events: none; }
.skin-card-champ { font-family: 'Inter', sans-serif; font-size: 7px; color: #785a22; letter-spacing: 1px; text-align: center; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.skin-card-name { font-family: 'Cinzel', serif; font-size: 9px; font-weight: 600; color: #e8e0d0; text-align: center; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.skin-card-border { position: absolute; width: calc(264/260*100%); height: auto; left: calc(-2/260*100%); top: calc(-7/260*100%); z-index: 3; pointer-events: none; display: block; }
.skin-card-gem { position: absolute; bottom: calc(-15/260*100%); left: 50%; transform: translateX(-50%); z-index: 5; width: 26px; height: 26px; pointer-events: none; }
.skin-card-gem img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 1px 4px rgba(0,0,0,0.7)); }
.skin-card-gem.epic { bottom: calc(-11/260*100%); }
.skin-card-gem.ultimate img { filter: drop-shadow(0 0 5px #ef4a60); }
.skin-card-gem.mythic img { filter: drop-shadow(0 0 5px #ee4fa0); }
.skin-card-gem.legendary img { filter: drop-shadow(0 0 5px #ff8c00); }
.skin-card-gem.epic img { filter: drop-shadow(0 0 5px #4aa8d8); }
.skin-card-gem.rare img, .skin-card-gem.norarity img { filter: drop-shadow(0 0 3px #6b7a8c); }
.chroma-badge { position: absolute; top: 5px; right: 5px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; z-index: 4; cursor: pointer; transition: transform 0.2s; }
.chroma-badge:hover { transform: scale(1.1); }
.chroma-badge img { position: absolute; width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6)); }
.chroma-count { position: relative; z-index: 1; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
.legacy-badge { position: absolute; left: 5px; top: 5px; z-index: 4; width: 32px; height: 32px; pointer-events: none; }
.legacy-badge img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.9)); }
.border-badge { position: absolute; left: 5px; top: 40px; z-index: 4; background: rgba(200,155,60,0.85); border-radius: 2px; padding: 2px 5px; font-family: 'Inter', sans-serif; font-size: 9px; font-weight: 700; color: #080c14; letter-spacing: 0.04em; pointer-events: none; }
.rv-mastery-list { padding: 22px 20px; display: flex; flex-direction: column; gap: 6px; }
.rv-mastery-row { display: flex; align-items: center; gap: 12px; padding: 9px 12px; background: #111b2a; border: 1px solid rgba(200,155,60,0.1); transition: border-color 0.15s; }
.rv-mastery-row:hover { border-color: rgba(200,155,60,0.3); }
.rv-mastery-icon { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid rgba(200,155,60,0.25); }
.rv-mastery-name { flex: 1; font-family: 'Cinzel', serif; font-size: 12px; font-weight: 600; color: #e8e0d0; }
.rv-mastery-level-badge { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 800; flex-shrink: 0; }
.rv-mastery-pts { font-family: 'Inter', sans-serif; font-size: 11px; color: #5b6a7e; width: 80px; text-align: right; flex-shrink: 0; }

/* ── Item Grid ── */
.rv-item-grid { padding: 22px 20px; display: flex; flex-wrap: wrap; gap: 11px; align-content: start; }
.rv-item-card { width: 80px; background: #111b2a; border: 1px solid rgba(200,155,60,0.12); cursor: default; transition: border-color 0.15s, box-shadow 0.15s; }
.rv-item-card:hover { border-color: #c89b3c; box-shadow: 0 0 10px rgba(200,155,60,0.2); }
.rv-item-img-wrap { width: 80px; height: 80px; background: #0a1628; overflow: hidden; }
.rv-item-img { width: 100%; height: 100%; object-fit: cover; display: block; filter: brightness(0.88); transition: filter 0.15s; }
.rv-item-card:hover .rv-item-img { filter: brightness(1.1); }
.rv-item-name { padding: 4px 5px; font-family: 'Inter', sans-serif; font-size: 8px; color: #7b8a9e; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-top: 1px solid rgba(200,155,60,0.12); }

/* ── Empty ── */
.rv-empty { grid-column: 1/-1; padding: 64px 0; text-align: center; font-family: 'Inter', sans-serif; font-size: 11px; color: #5b5a56; letter-spacing: 2px; text-transform: uppercase; width: 100%; }

/* ── Loot Grid ── */
.rv-loot-section { padding: 22px 20px; display: flex; flex-direction: column; gap: 18px; }
.rv-loot-cat-header { font-family: 'Cinzel', serif; font-size: 10px; color: #7b8a9e; letter-spacing: 2px; text-transform: uppercase; padding: 0 0 6px; border-bottom: 1px solid rgba(200,155,60,0.12); display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.rv-loot-cat-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.rv-loot-card { width: 80px; background: #111b2a; border: 1px solid rgba(200,155,60,0.12); cursor: default; transition: border-color 0.15s, box-shadow 0.15s; position: relative; }
.rv-loot-card:hover { border-color: #c89b3c; box-shadow: 0 0 10px rgba(200,155,60,0.2); }
.rv-loot-card-img-wrap { width: 80px; height: 80px; background: #0a1628; overflow: hidden; position: relative; }
.rv-loot-card-img { width: 100%; height: 100%; object-fit: cover; display: block; filter: brightness(0.88); transition: filter 0.15s; }
.rv-loot-card:hover .rv-loot-card-img { filter: brightness(1.1); }
.rv-loot-count-badge { position: absolute; bottom: 3px; right: 3px; background: rgba(0,0,0,0.8); color: #e8e0d0; font-family: 'Inter', sans-serif; font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 2px; line-height: 1.4; }

/* ── Rank + Badges ── */
.rv-rank-row { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 3px; }
.rv-rank-pill { display: inline-flex; align-items: center; gap: 3px; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 600; color: #7b8a9e; letter-spacing: 0.03em; }
.rv-rank-pill span { font-weight: 700; }
.rv-badge { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; white-space: nowrap; border-radius: 2px; }
.rv-badge-oge { background: rgba(232,160,32,0.15); border: 1px solid rgba(232,160,32,0.35); color: #e8a020; }
.rv-badge-ogi { background: rgba(76,175,80,0.15); border: 1px solid rgba(76,175,80,0.35); color: #4caf50; }
.rv-badge-price { background: rgba(200,155,60,0.15); border: 1px solid rgba(200,155,60,0.35); color: #c89b3c; }
.rv-generated { font-family: 'Inter', sans-serif; font-size: 10px; color: #3c4a5c; white-space: nowrap; align-self: flex-end; padding-bottom: 2px; }

/* ── Chroma Cards ── */
.rv-chroma-card { width: 80px; background: #111b2a; border: 1px solid rgba(200,155,60,0.12); cursor: default; transition: border-color 0.15s, box-shadow 0.15s; }
.rv-chroma-card:hover { border-color: #c89b3c; box-shadow: 0 0 8px rgba(200,155,60,0.2); }
.rv-chroma-img-wrap { width: 80px; height: 80px; overflow: hidden; background: #0a1628; }
.rv-chroma-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.rv-chroma-name { padding: 3px 4px; font-family: 'Inter', sans-serif; font-size: 8px; color: #7b8a9e; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-top: 1px solid rgba(200,155,60,0.12); }

/* ── Modal ── */
.rv-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.92); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 20px; }
.rv-modal { background: #0a1628; border: 1px solid #785a28; max-width: 600px; width: 100%; position: relative; max-height: 90vh; overflow-y: auto; }
.rv-modal-close { position: absolute; top: 10px; right: 10px; z-index: 10; background: transparent; border: none; color: #5b5a56; font-size: 18px; cursor: pointer; padding: 2px 6px; }
.rv-modal-close:hover { color: #e8e0d0; }
.rv-modal-splash { width: 100%; max-height: 280px; object-fit: cover; object-position: top center; display: block; }
.rv-modal-info { padding: 13px 16px 18px; }

.rv-mob-toggle {
  display: none; align-items: center; margin-left: auto; flex-shrink: 0;
  background: transparent; border: 1px solid rgba(200,155,60,0.3);
  color: #c89b3c; font-family: 'Inter', sans-serif; font-size: 10px;
  font-weight: 600; padding: 0 10px; cursor: pointer; letter-spacing: 0.05em;
  white-space: nowrap; height: 22px;
}

.rv-mob-search-bar {
  display: none; position: fixed; top: 86px; left: 0; right: 0; z-index: 998;
  padding: 6px 12px; background: rgba(6,10,18,0.92);
  border-bottom: 1px solid rgba(200,155,60,0.1);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.rv-mob-search-bar input {
  width: 100%; background: rgba(0,0,0,0.4); border: 1px solid #7a5c29;
  color: #c99c3e; font-family: 'Inter', sans-serif; font-size: 13px;
  padding: 8px 12px; outline: none;
}
.rv-mob-search-bar input::placeholder { color: #6a6a6a; }

@media (max-width: 640px) {
  .rv-titlebar { height: 56px; padding: 0 10px; }
  .rv-avatar-wrapper { width: 40px; height: 40px; }
  .rv-level-outer { width: 34px; height: 16px; }
  .rv-level-inner { width: 30px; height: 12px; font-size: 8px; }
  .rv-summoner-name { font-size: 14px; }
  .rv-summoner-sub, .rv-rank-row { display: none; }
  .rv-currency, .rv-badge, .rv-hide-btn { display: none; }
  .rv-tab-bar { top: 56px; }
  .rv-mob-search-bar { display: flex; }
  .rv-content { top: 124px; flex-direction: column; }
  .rv-panel { width: 100%; padding: 0 16px; max-height: 0; overflow: hidden; transition: max-height 0.3s ease; }
  .rv-panel.mob-open { max-height: 50vh; overflow-y: auto; padding: 12px 16px 8px; }
  .rv-cp-bg { display: none; }
  .rv-cp-content { padding: 0; }
  .rv-stats-ring-wrap { padding: 4px 0; }
  .rv-rarity-gems { padding: 4px 0 8px; }
  .rv-mini-stats { padding: 8px 0 4px; }
  .rv-main { flex: 1; overflow-y: auto; min-height: 0; }
  .rv-skin-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px 14px; padding: 14px 12px; justify-content: start; }
  .rv-item-grid { padding: 14px 12px; }
  .rv-mastery-list, .rv-loot-section { padding: 14px 12px; }
  .rv-overview { padding: 14px 12px; max-width: 100%; }
  .rv-modal-backdrop { padding: 0; align-items: flex-end; }
  .rv-modal { max-width: 100%; width: 100%; max-height: 90vh; border-radius: 12px 12px 0 0; }
  .rv-modal-splash { max-height: 180px; }
  .rv-mob-toggle { display: flex; }
}
`

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkinCard({ skin, champName, chromaCount, isVintage, onClick }) {
  const rarity = skin.rarity || 'kNoRarity'
  const rarityClass = rarity.replace('k', '').toLowerCase()
  const skinLabel = (champName && skin.name.startsWith(champName + ' '))
    ? skin.name.slice(champName.length + 1)
    : skin.name
  const skinBorder = skin.borders?.length > 0 ? cdnUrl(skin.borders[0].imagePath) : BORDER_SRC[rarity]

  return (
    <div className={`skin-card ${rarityClass}`} onClick={onClick}>
      <div className="skin-card-mask">
        <img className="skin-card-img" src={cdnUrl(skin.tilePath)} alt={skin.name} loading="lazy"
          onError={e => { e.target.style.opacity = 0 }} />
        <div className="skin-card-overlay">
          {champName && <div className="skin-card-champ">{champName}</div>}
          <div className="skin-card-name">{skinLabel}</div>
        </div>
      </div>
      <img className="skin-card-border" src={skinBorder} alt=""
        onError={e => { e.target.src = BORDER_SRC[rarity]; e.target.onerror = null }} />
      <div className={`skin-card-gem ${rarityClass}`}>
        <img src={GEM_SRC[rarity]} alt="" />
      </div>
      {chromaCount > 0 && (
        <div className="chroma-badge">
          <img src="/tier-icons/chroma.png" alt="" onError={e => { e.target.style.display = 'none' }} />
          <span className="chroma-count">{chromaCount}</span>
        </div>
      )}
      {skin.isLegacy && (
        <div className="legacy-badge">
          <img src="/tier-icons/legacy.png" alt="Legacy" onError={e => { e.target.style.display = 'none' }} />
        </div>
      )}
      {isVintage && <div className="border-badge">BORDER</div>}
    </div>
  )
}

function LootCard({ imgSrc, name, count, accent }) {
  return (
    <div className="rv-loot-card" style={accent ? { borderColor: accent, boxShadow: `0 0 6px ${accent}44` } : {}}>
      <div className="rv-loot-card-img-wrap">
        {imgSrc
          ? <img className="rv-loot-card-img" src={imgSrc} alt={name || ''} loading="lazy"
              onError={e => { e.target.style.opacity = 0 }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3c4a5c', fontSize: 18 }}>◈</div>
        }
        {count > 1 && <div className="rv-loot-count-badge">×{count}</div>}
      </div>
      <div className="rv-item-name">{name || ''}</div>
    </div>
  )
}

function ItemCard({ imgSrc, name }) {
  return (
    <div className="rv-item-card">
      <div className="rv-item-img-wrap">
        {imgSrc
          ? <img className="rv-item-img" src={imgSrc} alt={name || ''} loading="lazy"
              onError={e => { e.target.style.opacity = 0 }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3c4a5c', fontSize: 18 }}>◈</div>
        }
      </div>
      <div className="rv-item-name">{name || ''}</div>
    </div>
  )
}

function Dropdown({ value, options, onChange, locked }) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value)
  return (
    <div className={`rv-dropdown-wrap${locked ? ' locked' : ''}`}>
      <button className="rv-dropdown-btn" onClick={() => !locked && setOpen(o => !o)}>
        <span>{selected?.label}</span>
        <span className="rv-dropdown-arrow">⇅</span>
      </button>
      <div className={`rv-dropdown-menu${open ? ' open' : ''}`}>
        {options.map(opt => (
          <button key={opt.value} className={`rv-dropdown-item${opt.value === value ? ' active' : ''}`}
            onClick={() => { onChange(opt.value); setOpen(false) }}>
            {opt.label}
            <span className="rv-dropdown-check">✓</span>
          </button>
        ))}
      </div>
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 499 }} onClick={() => setOpen(false)} />}
    </div>
  )
}

function GroupHeader({ name, count, total, complete, iconUrl }) {
  return (
    <div className={`rv-group-header${complete ? ' rv-group-complete' : ''}`}>
      {iconUrl && (
        <img src={iconUrl} alt="" width={18} height={18}
          style={{ borderRadius: '50%', border: '1px solid rgba(200,155,60,0.3)', flexShrink: 0 }}
          onError={e => { e.target.style.display = 'none' }} />
      )}
      <span className="rv-group-header-name">{name}</span>
      <span className="rv-group-header-count">
        {total != null ? `${count} / ${total}` : count}
      </span>
      <div className="rv-group-header-line" />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PreviewPage() {
  const { id } = useParams()
  const [scan, setScan]               = useState(null)
  const [catalogs, setCatalogs]       = useState({})
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [tab, setTab]                 = useState('OVERVIEW')
  const [groupBy, setGroupBy]         = useState('tier')
  const [sortBy, setSortBy]           = useState('az')
  const [search, setSearch]           = useState('')
  const [hideIGN, setHideIGN]         = useState(false)
  const [selected, setSelected]       = useState(null)
  const [manualBorderIds, setManualBorderIds]     = useState([])
  const [disclaimerEnabled, setDisclaimerEnabled] = useState(true)
  const [disclaimerMsg, setDisclaimerMsg]         = useState('Border detection is ~95% accurate — some skins may have a border but not be marked.')
  const [panelOpen, setPanelOpen] = useState(false)
  useEffect(() => {
    const DDRAGON = 'https://ddragon.leagueoflegends.com'

    const ddragonFetch = fetch(`${DDRAGON}/api/versions.json`)
      .then(r => r.json())
      .then(versions => {
        const ver = versions[0]
        return Promise.all([
          fetch(`${DDRAGON}/cdn/${ver}/data/en_US/tft-tactician.json`).then(r => r.json()).catch(() => ({ data: {} })),
          fetch(`${DDRAGON}/cdn/${ver}/data/en_US/tft-arena.json`).then(r => r.json()).catch(() => ({ data: {} })),
        ]).then(([tacticianJson, arenaJson]) => ({
          tacticians: Object.values(tacticianJson?.data || {}).map(t => ({
            id: parseInt(t.id), itemId: parseInt(t.id), name: t.name,
            iconPath: `${DDRAGON}/cdn/${ver}/img/${t.image?.group}/${t.image?.full}`,
          })),
          arenas: Object.values(arenaJson?.data || {}).map(a => ({
            id: parseInt(a.id), itemId: parseInt(a.id), name: a.name,
            iconPath: `${DDRAGON}/cdn/${ver}/img/${a.image?.group}/${a.image?.full}`,
          })),
        }))
      })
      .catch(() => ({ tacticians: [], arenas: [] }))

    const boomsFetch = fetch(`${CDN}/v1/tftdamageskins.json`)
      .then(r => r.json())
      .then(arr => (Array.isArray(arr) ? arr : []).map(d => ({
        id: d.itemId, itemId: d.itemId, name: d.name, iconPath: d.loadoutsIcon || null,
      })).filter(d => d.id != null))
      .catch(() => [])

    Promise.all([
      fetch(`/api/lol-skins/${id}`).then(r => r.json()),
      fetch(`${CDN}/v1/skins.json`).then(r => r.json()),
      fetch(`${CDN}/v1/summoner-icons.json`).then(r => r.json()).catch(() => []),
      fetch(`${CDN}/v1/summoner-emotes.json`).then(r => r.json()).catch(() => []),
      fetch(`${CDN}/v1/ward-skins.json`).then(r => r.json()).catch(() => []),
      fetch(`${CDN}/v1/champion-summary.json`).then(r => r.json()).catch(() => []),
      ddragonFetch,
      boomsFetch,
      fetch(`${CDN}/v1/nexusfinishers.json`).then(r => r.json()).catch(() => []),
      fetch('/api/border-skins').then(r => r.json()).catch(() => ({})),
    ]).then(([scanData, skinsJson, iconsJson, emotesJson, wardsJson, champsJson, ddragonData, boomsArr, finishersJson, borderData]) => {
      if (scanData.error) { setError(scanData.error); setLoading(false); return }
      setScan(scanData)
      if (scanData.hide_name) setHideIGN(true)
      if (Array.isArray(borderData?.skin_ids)) setManualBorderIds(borderData.skin_ids)
      setDisclaimerEnabled(borderData?.disclaimer_enabled ?? true)
      if (borderData?.disclaimer_msg) setDisclaimerMsg(borderData.disclaimer_msg)
      const toArr = x => Array.isArray(x) ? x : Object.values(x || {})
      setCatalogs({ skins: { ...MISSING_SKINS_MAP, ...skinsJson }, icons: iconsJson, emotes: emotesJson, wards: wardsJson, champions: champsJson, companions: ddragonData.tacticians, tftMapSkins: ddragonData.arenas, tftDamageSkins: boomsArr, finishers: toArr(finishersJson).map(f => ({ id: f.itemId ?? f.id, itemId: f.itemId ?? f.id, name: f.translatedName || f.name || f.localizedName || '', iconPath: f.iconPath || f.loadoutsIcon || f.inventoryIcon || null })).filter(f => f.id != null) })
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [id])

  const champMap = useMemo(() => {
    if (!Array.isArray(catalogs.champions)) return {}
    const map = {}
    for (const c of catalogs.champions) {
      if (c.id > 0) map[c.id] = { name: c.name, iconUrl: cdnUrl(c.squarePortraitPath) }
    }
    return map
  }, [catalogs.champions])

  const emoteMap = useMemo(() => {
    const arr = Array.isArray(catalogs.emotes) ? catalogs.emotes : Object.values(catalogs.emotes || {})
    const map = {}
    for (const e of arr) if (e.id != null) map[e.id] = e
    return map
  }, [catalogs.emotes])

  const iconCatalogMap = useMemo(() => {
    const arr = Array.isArray(catalogs.icons) ? catalogs.icons : Object.values(catalogs.icons || {})
    const map = {}
    for (const i of arr) if (i.id != null) map[i.id] = i
    return map
  }, [catalogs.icons])

  const wardCatalogMap = useMemo(() => {
    const arr = Array.isArray(catalogs.wards) ? catalogs.wards : Object.values(catalogs.wards || {})
    const map = {}
    for (const w of arr) if (w.id != null) map[w.id] = w
    return map
  }, [catalogs.wards])

  const ownedChromaSet  = useMemo(() => new Set(scan?.owned_chroma_ids  || []), [scan])
  const vintageSkinSet  = useMemo(() => new Set([...(scan?.vintage_skin_ids || []), ...manualBorderIds]), [scan, manualBorderIds])
  const ownedEmoteSet  = useMemo(() => new Set(scan?.owned_emote_ids || []), [scan])
  const ownedIconSet   = useMemo(() => new Set(scan?.owned_icon_ids || []), [scan])
  const ownedWardSet   = useMemo(() => new Set(scan?.owned_ward_ids || []), [scan])

  const ownedSkins = useMemo(() => {
    if (!catalogs.skins || !scan) return []
    const chromaIds = new Set(scan.owned_chroma_ids || [])
    return [...new Set(scan.owned_skin_ids || [])]
      .map(sid => catalogs.skins[sid])
      .filter(s => s && s.id % 1000 !== 0 && !chromaIds.has(s.id))
  }, [catalogs.skins, scan])

  const totalSkinsByChamp = useMemo(() => {
    if (!catalogs.skins) return {}
    const t = {}
    Object.values(catalogs.skins).forEach(s => {
      if (s.id % 1000 === 0) return
      const cid = Math.floor(s.id / 1000)
      t[cid] = (t[cid] || 0) + 1
    })
    return t
  }, [catalogs.skins])

  const counts = useMemo(() => {
    const byRarity = {}
    for (const r of RARITY_ORDER) byRarity[r] = ownedSkins.filter(s => s.rarity === r).length
    return {
      ...byRarity,
      legacy:    ownedSkins.filter(s => s.isLegacy).length,
      chromas:   ownedSkins.filter(s => (s.chromas || []).some(c => ownedChromaSet.has(c.id))).length,
      emotes:    (scan?.owned_emote_ids || []).length,
      icons:     (scan?.owned_icon_ids || []).length,
      wards:     (scan?.owned_ward_ids || []).length,
      finishers: (scan?.owned_finisher_ids || []).length,
      tftCompanions:  (scan?.tft_companion_ids || []).length,
      tftMapSkins:    (scan?.tft_map_skin_ids || []).length,
      tftDamageSkins: (scan?.tft_damage_skin_ids || []).length,
    }
  }, [ownedSkins, ownedChromaSet, scan])

  function applyFilters(list) {
    let result = list
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(s => s.name.toLowerCase().includes(q))
    }
    if (sortBy === 'border') result = result.filter(s => vintageSkinSet.has(s.id))
    return result
  }

  const championGroups = useMemo(() => {
    const list = applyFilters(ownedSkins)
    const byChamp = {}
    for (const skin of list) {
      const cid = Math.floor(skin.id / 1000)
      if (!byChamp[cid]) byChamp[cid] = []
      byChamp[cid].push(skin)
    }
    return Object.entries(byChamp).map(([cid, skins]) => {
      const numId = parseInt(cid)
      const champ = champMap[numId]
      return {
        champId: numId,
        champName: champ?.name || `Champion ${cid}`,
        champIconUrl: champ?.iconUrl || '',
        owned: skins.length,
        total: totalSkinsByChamp[numId] || skins.length,
        skins: skins.slice().sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)),
      }
    }).sort((a, b) => {
      if (sortBy === 'za') return b.champName.localeCompare(a.champName)
      if (sortBy === 'most') return b.owned - a.owned
      return a.champName.localeCompare(b.champName)
    })
  }, [ownedSkins, champMap, totalSkinsByChamp, search, sortBy, vintageSkinSet])

  const tierGroups = useMemo(() => {
    const list = applyFilters(ownedSkins).slice().sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity))
    const groups = {}
    for (const s of list) {
      const r = s.rarity || 'kNoRarity'
      if (!groups[r]) groups[r] = []
      groups[r].push(s)
    }
    return RARITY_ORDER.filter(r => groups[r]?.length).map(r => ({ rarity: r, skins: groups[r] }))
  }, [ownedSkins, search, sortBy, vintageSkinSet])

  const allSkins = useMemo(() => applyFilters(ownedSkins).slice().sort((a, b) => b.id - a.id), [ownedSkins, search, sortBy, vintageSkinSet])

  const chromaSkins = useMemo(() =>
    ownedSkins.filter(s => (s.chromas || []).some(c => ownedChromaSet.has(c.id))),
    [ownedSkins, ownedChromaSet])

  const ownedIcons = useMemo(() => {
    const arr = Array.isArray(catalogs.icons) ? catalogs.icons : Object.values(catalogs.icons || {})
    return arr.filter(i => ownedIconSet.has(i.id))
  }, [catalogs.icons, ownedIconSet])

  const ownedEmotes = useMemo(() => {
    const arr = Array.isArray(catalogs.emotes) ? catalogs.emotes : Object.values(catalogs.emotes || {})
    return arr.filter(e => ownedEmoteSet.has(e.id))
  }, [catalogs.emotes, ownedEmoteSet])

  const ownedWards = useMemo(() => {
    const arr = Array.isArray(catalogs.wards) ? catalogs.wards : Object.values(catalogs.wards || {})
    return arr.filter(w => ownedWardSet.has(w.id))
  }, [catalogs.wards, ownedWardSet])

  const companionMap = useMemo(() => {
    const arr = Array.isArray(catalogs.companions) ? catalogs.companions : []
    const map = {}
    for (const c of arr) {
      if (c.itemId != null) map[c.itemId] = c
      if (c.id != null) map[c.id] = c
    }
    return map
  }, [catalogs.companions])

  const tftMapSkinMap = useMemo(() => {
    const arr = Array.isArray(catalogs.tftMapSkins) ? catalogs.tftMapSkins : []
    const map = {}
    for (const m of arr) {
      if (m.itemId != null) map[m.itemId] = m
      if (m.id != null) map[m.id] = m
    }
    return map
  }, [catalogs.tftMapSkins])

  const tftDamageSkinMap = useMemo(() => {
    const arr = Array.isArray(catalogs.tftDamageSkins) ? catalogs.tftDamageSkins : []
    const map = {}
    for (const d of arr) {
      if (d.itemId != null) map[d.itemId] = d
      if (d.id != null) map[d.id] = d
    }
    return map
  }, [catalogs.tftDamageSkins])

  const finisherMap = useMemo(() => {
    const arr = Array.isArray(catalogs.finishers) ? catalogs.finishers : []
    const map = {}
    for (const f of arr) {
      if (f.itemId != null) map[f.itemId] = f
      if (f.id != null) map[f.id] = f
    }
    return map
  }, [catalogs.finishers])

  const loot = scan?.loot_summary || {}

  const tabCount = {
    OVERVIEW:  null,
    MASTERY:   Array.isArray(scan?.champion_mastery) ? scan.champion_mastery.length : 0,
    SKINS:     ownedSkins.length,
    EMOTES:    counts.emotes,
    ICONS:     counts.icons,
    WARDS:     counts.wards,
    CHROMAS:   (scan?.owned_chroma_ids || []).length,
    FINISHERS: counts.finishers,
    LOOT:      Object.keys(loot.allItems || {}).length,
    TFT:       counts.tftCompanions + counts.tftMapSkins + counts.tftDamageSkins,
  }

  const ringNum = tabCount[tab] ?? 0
  const ringClass = ringNum >= 1000 ? 'rv-stats-ring-num xs' : ringNum >= 100 ? 'rv-stats-ring-num sm' : 'rv-stats-ring-num'

  const groupOptions = [
    { value: 'champion', label: 'Champion' },
    { value: 'tier', label: 'Tier' },
    { value: 'all', label: 'All (Newest)' },
  ]
  const sortOptions = [
    { value: 'az', label: 'A → Z' },
    { value: 'za', label: 'Z → A' },
    { value: 'most', label: 'Most Owned' },
    { value: 'border', label: 'Has Border' },
  ]

  const rp  = scan?.rp ?? null
  const be  = scan?.be ?? null
  const oe  = loot.oe  ?? null
  const me  = loot.me  ?? null

  const RANK_COLORS = { CHALLENGER: '#f4c874', GRANDMASTER: '#f4c874', MASTER: '#c87db4', DIAMOND: '#6ec6e8', EMERALD: '#50c878', PLATINUM: '#4fc0a0', GOLD: '#d4a520', SILVER: '#b0b8c0', BRONZE: '#c07840', IRON: '#8a7a70' }
  const fmtTier = t => t ? (t.charAt(0) + t.slice(1).toLowerCase()) : null
  const soloRank = fmtTier(scan?.solo_rank)
  const flexRank = fmtTier(scan?.flex_rank)
  const tftRank  = fmtTier(scan?.tft_rank)
  const ranks = [
    soloRank && { label: 'SOLO', tier: scan.solo_rank, display: soloRank },
    flexRank && { label: 'FLEX', tier: scan.flex_rank, display: flexRank },
    tftRank  && { label: 'TFT',  tier: scan.tft_rank,  display: tftRank },
  ].filter(Boolean)

  const ogeFlag = !!scan?.oge
  const ogiFlag = !!scan?.ogi
  const ogiPartial  = !!scan?.ogi_partial
  const ogiVerified = !!scan?.ogi_verified
  const priceAmount   = scan?.price_amount ?? null
  const priceCurrency = scan?.price_currency || null

  const generatedDate = scan?.created_at
    ? new Date(scan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080c14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <style>{CSS}</style>
      <svg width={48} height={48} viewBox="0 0 60 60">
        <polygon points="30,3 55,17 55,43 30,57 5,43 5,17" fill="none" stroke="#c89b3c" strokeWidth="1.5"
          strokeDasharray="200" strokeDashoffset="200">
          <animate attributeName="stroke-dashoffset" from="200" to="0" dur="1.5s" repeatCount="indefinite" />
        </polygon>
      </svg>
      <div style={{ fontFamily: 'Cinzel, serif', color: '#c89b3c', fontSize: 12, letterSpacing: 3 }}>LOADING COLLECTION...</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#080c14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontFamily: 'serif', fontSize: 14 }}>
      <style>{CSS}</style>
      {error}
    </div>
  )

  const displayName = hideIGN ? null : (scan.summoner_name || null)
  const canToggleIGN = !scan.hide_name  // if hide_name set on record, don't show reveal button

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <style>{CSS}</style>

      {/* ── Titlebar ── */}
      <header className="rv-titlebar">
        <div className="rv-summoner-profile">
          {scan.profile_icon_id != null && (
            <div className="rv-avatar-wrapper">
              <img src={profileIconUrl(scan.profile_icon_id)} alt="" className="rv-avatar"
                onError={e => { e.target.style.opacity = 0 }} />
              <div className="rv-level-outer">
                <div className="rv-level-inner">{scan.summoner_level}</div>
              </div>
            </div>
          )}
          <div className="rv-summoner-details">
            <div className="rv-summoner-name">
              {displayName
                ? <>{displayName}{scan.tag_line && <span className="rv-summoner-tag">#{scan.tag_line}</span>}</>
                : <span style={{ color: '#3c4a5c', fontFamily: 'Inter, sans-serif', fontSize: 14, letterSpacing: 0 }}>Hidden Account</span>
              }
            </div>
            <div className="rv-summoner-sub">Collection Preview</div>
            {ranks.length > 0 && (
              <div className="rv-rank-row">
                {ranks.map(r => (
                  <span key={r.label} className="rv-rank-pill">
                    <span style={{ color: '#4a5568', fontSize: 9 }}>{r.label}</span>
                    <span style={{ color: RANK_COLORS[r.tier] || '#7b8a9e' }}>{r.display}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rv-titlebar-right">
          {ogeFlag && <span className="rv-badge rv-badge-oge">OGE</span>}
          {ogiFlag && (
            <span className="rv-badge rv-badge-ogi">
              OGI{ogiVerified ? ' ✓' : ogiPartial ? ' ~' : ''}
            </span>
          )}
          {priceAmount != null && priceCurrency && (
            <span className="rv-badge rv-badge-price">
              {priceCurrency} {Number(priceAmount).toLocaleString()}
            </span>
          )}
          {rp !== null && (
            <div className="rv-currency">
              <img src="/icon-rp.png" alt="" width={14} height={14} onError={e => { e.target.style.display = 'none' }} />
              <span className="rv-currency-val">{rp.toLocaleString()}</span>
              <span className="rv-currency-label">RP</span>
            </div>
          )}
          {be !== null && (
            <div className="rv-currency">
              <img src="/icon-be.png" alt="" width={14} height={14} onError={e => { e.target.style.display = 'none' }} />
              <span className="rv-currency-val rv-currency-be">{be.toLocaleString()}</span>
              <span className="rv-currency-label">BE</span>
            </div>
          )}
          {canToggleIGN && (
            <button className="rv-hide-btn" onClick={() => setHideIGN(h => !h)}>
              {hideIGN ? 'SHOW IGN' : 'HIDE IGN'}
            </button>
          )}
        </div>
      </header>
      {generatedDate && <div style={{ position: 'fixed', bottom: 12, left: 18, zIndex: 999, fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#3c4a5c', letterSpacing: '0.05em', pointerEvents: 'none' }}>Generated {generatedDate}</div>}

      {/* ── Tab Bar ── */}
      <div className="rv-tab-bar">
        {TABS.map(t => (
          <button key={t.id} className={`rv-tab-item${tab === t.id ? ' active' : ''}`}
            onClick={() => { setTab(t.id); setSearch(''); setPanelOpen(false) }}>
            <span className="rv-tab-icon">{t.icon}</span>
            <span>{t.label}</span>
            {tabCount[t.id] > 0 && <span className="rv-tab-count">{tabCount[t.id]}</span>}
          </button>
        ))}
        {tab !== 'OVERVIEW' && (
          <button className="rv-mob-toggle" onClick={() => setPanelOpen(o => !o)}>
            {panelOpen ? 'Hide ▲' : 'Stats ▼'}
          </button>
        )}
      </div>

      {/* ── Mobile Search Bar ── */}
      <div className="rv-mob-search-bar">
        <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* ── Content ── */}
      <div className="rv-content">

        {/* ── Left Panel (hidden on Overview tab) ── */}
        {tab !== 'OVERVIEW' && (
          <aside className={`rv-panel${panelOpen ? ' mob-open' : ''}`}>
            <div className="rv-control-pane">
              <div className="rv-cp-bg">
                <div className="rv-cp-top" />
                <div className="rv-cp-mid" />
                <div className="rv-cp-bot" />
              </div>
              <div className="rv-cp-content">
                <div className="rv-stats-ring-wrap">
                  <div className="rv-stats-ring">
                    <span className={ringClass}>{ringNum}</span>
                    <span className="rv-stats-ring-label">
                      {tab === 'SKINS' ? <>TOTAL SKINS<br/>OWNED</> : <>{`TOTAL ${tab}`}<br/>OWNED</>}
                    </span>
                  </div>
                </div>
                {tab === 'SKINS' && (
                  <>
                    <div className="rv-rarity-gems">
                      {[
                        { key: 'kTranscendent', src: '/tier-icons/transcendent.png', count: counts.kTranscendent, label: 'Transcendent' },
                        { key: 'kExalted',      src: '/tier-icons/exalted.png',   count: counts.kExalted,      label: 'Exalted' },
                        { key: 'kUltimate',     src: '/tier-icons/ultimate.png',  count: counts.kUltimate,     label: 'Ultimate' },
                        { key: 'kMythic',       src: '/tier-icons/mythic.png',    count: counts.kMythic,       label: 'Mythic' },
                        { key: 'kLegendary',    src: '/tier-icons/legendary.png', count: counts.kLegendary,    label: 'Legendary' },
                        { key: 'kEpic',         src: '/tier-icons/epic.png',      count: counts.kEpic,         label: 'Epic' },
                      ].filter(g => g.count > 0).map(g => (
                        <div key={g.key} className="rv-gem-item" title={g.label}>
                          <div className="rv-gem"><img src={g.src} alt="" draggable="false" /></div>
                          <span className="rv-gem-count">{g.count}</span>
                        </div>
                      ))}
                    </div>
                    <div className="rv-mini-stats">
                      <div className="rv-mini-stat" title="Legacy skins">
                        <img className="rv-mini-stat-icon" src="/tier-icons/legacy.png" alt="Legacy" draggable="false" />
                        <span className="rv-mini-stat-val">{counts.legacy}</span>
                      </div>
                      <div className="rv-mini-stat" title="Skins with chromas">
                        <img className="rv-mini-stat-icon" src="/tier-icons/chroma.png" alt="Chromas" draggable="false" />
                        <span className="rv-mini-stat-val">{(scan?.owned_chroma_ids || []).length}</span>
                      </div>
                      {rp !== null && (
                        <div className="rv-mini-stat" title="Riot Points">
                          <img className="rv-mini-stat-icon" src="/icon-rp.png" alt="RP" onError={e => { e.target.style.display = 'none' }} draggable="false" />
                          <span className="rv-mini-stat-val">{rp >= 1000 ? `${(rp/1000).toFixed(1)}k` : rp}</span>
                          <span className="rv-mini-stat-sub">RP</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <hr className="rv-panel-divider" />

            <div className="rv-panel-controls">
              <div className="rv-search-wrap">
                <svg className="rv-search-icon" viewBox="0 0 20 20" fill="none">
                  <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M13.5 13.5 L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input type="text" className="rv-search" placeholder="Search"
                  value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" />
              </div>

              {tab === 'SKINS' && (
                <Dropdown value={groupBy} options={groupOptions}
                  onChange={v => { setGroupBy(v); setSortBy('az') }} />
              )}
              {tab === 'SKINS' && (
                <Dropdown value={sortBy} options={sortOptions}
                  onChange={setSortBy} locked={groupBy !== 'champion' && sortBy !== 'border'} />
              )}

              {(be !== null || oe > 0 || me > 0 || loot.hexChests > 0 || loot.hexKeys > 0) && (
                <div className="rv-currency-panel">
                  {be !== null && (
                    <div className="rv-currency-row">
                      <img src="/icon-be.png" alt="" width={16} height={16} onError={e => { e.target.style.display = 'none' }} />
                      <span className="rv-currency-row-val">{be.toLocaleString()}</span>
                      <span className="rv-currency-row-label">Blue Essence</span>
                    </div>
                  )}
                  {oe > 0 && (
                    <div className="rv-currency-row">
                      <span style={{ fontSize: 16, color: '#c89b3c', lineHeight: 1 }}>◈</span>
                      <span className="rv-currency-row-val">{oe.toLocaleString()}</span>
                      <span className="rv-currency-row-label">Orange Essence</span>
                    </div>
                  )}
                  {me > 0 && (
                    <div className="rv-currency-row">
                      <img src="/tier-icons/mythic.png" alt="" width={16} height={16} />
                      <span className="rv-currency-row-val">{me.toLocaleString()}</span>
                      <span className="rv-currency-row-label">Mythic Essence</span>
                    </div>
                  )}
                  {loot.hexChests > 0 && (
                    <div className="rv-currency-row">
                      <span style={{ fontSize: 16, color: '#c89b3c', lineHeight: 1 }}>⬡</span>
                      <span className="rv-currency-row-val">{loot.hexChests}</span>
                      <span className="rv-currency-row-label">Chests</span>
                    </div>
                  )}
                  {loot.hexKeys > 0 && (
                    <div className="rv-currency-row">
                      <span style={{ fontSize: 16, color: '#a09070', lineHeight: 1 }}>⚿</span>
                      <span className="rv-currency-row-val">{loot.hexKeys}</span>
                      <span className="rv-currency-row-label">Keys / Fragments</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* ── Main Content ── */}
        <main className="rv-main">

          {/* ── OVERVIEW ── */}
          {tab === 'OVERVIEW' && (
            <div className="rv-overview">
              <div className="rv-overview-section">Account</div>
              <div className="rv-overview-grid">
                <div className="rv-stat-card">
                  <div className="rv-stat-card-label">Name</div>
                  <div className="rv-stat-card-value small">
                    {displayName
                      ? <>{displayName}{scan.tag_line && <span style={{ color: '#5b6a7e', fontSize: 12 }}> #{scan.tag_line}</span>}</>
                      : <span style={{ color: '#3c4a5c' }}>Hidden</span>
                    }
                  </div>
                </div>
                <div className="rv-stat-card">
                  <div className="rv-stat-card-label">Server</div>
                  <div className="rv-stat-card-value small">{scan.region || '—'}</div>
                </div>
                <div className="rv-stat-card">
                  <div className="rv-stat-card-label">Level</div>
                  <div className="rv-stat-card-value">{scan.summoner_level ?? '—'}</div>
                </div>
                {soloRank && <div className="rv-stat-card"><div className="rv-stat-card-label">Solo Rank</div><div className="rv-stat-card-value small" style={{ color: RANK_COLORS[scan.solo_rank] || '#e8e0d0' }}>{soloRank}</div></div>}
                {flexRank && <div className="rv-stat-card"><div className="rv-stat-card-label">Flex Rank</div><div className="rv-stat-card-value small" style={{ color: RANK_COLORS[scan.flex_rank] || '#e8e0d0' }}>{flexRank}</div></div>}
                {tftRank  && <div className="rv-stat-card"><div className="rv-stat-card-label">TFT Rank</div><div className="rv-stat-card-value small" style={{ color: RANK_COLORS[scan.tft_rank]  || '#e8e0d0' }}>{tftRank}</div></div>}
              </div>

              <div className="rv-overview-section">Collection</div>
              <div className="rv-overview-grid">
                {[
                  { label: 'Skins',     value: ownedSkins.length },
                  { label: 'Icons',     value: counts.icons },
                  { label: 'Chromas',   value: (scan.owned_chroma_ids || []).length },
                  { label: 'Wards',     value: counts.wards },
                  { label: 'Emotes',    value: counts.emotes },
                  { label: 'Finishers', value: counts.finishers },
                ].map(({ label, value }) => (
                  <div key={label} className="rv-stat-card">
                    <div className="rv-stat-card-label">{label}</div>
                    <div className="rv-stat-card-value">{value}</div>
                  </div>
                ))}
              </div>

              <div className="rv-overview-section">Currency</div>
              <div className="rv-overview-grid">
                {[
                  { label: 'RP',             value: rp,          color: '#e8a020' },
                  { label: 'Blue Essence',   value: be,          color: '#5b9bd5' },
                  { label: 'Orange Essence', value: oe,          color: '#c89b3c' },
                  { label: 'Mythic Essence', value: me,          color: '#c45cc4' },
                  { label: 'Hex Chests',     value: loot.hexChests, color: '#e8e0d0' },
                  { label: 'Keys',           value: loot.hexKeys,   color: '#e8e0d0' },
                ].filter(c => c.value != null).map(({ label, value, color }) => (
                  <div key={label} className="rv-stat-card">
                    <div className="rv-stat-card-label">{label}</div>
                    <div className="rv-stat-card-value" style={{ color }}>{value?.toLocaleString() ?? '—'}</div>
                  </div>
                ))}
              </div>

              {(counts.tftCompanions + counts.tftMapSkins + counts.tftDamageSkins) > 0 && (
                <>
                  <div className="rv-overview-section">TFT</div>
                  <div className="rv-overview-grid">
                    {[
                      { label: 'Companions', value: counts.tftCompanions },
                      { label: 'Arenas',     value: counts.tftMapSkins },
                      { label: 'Booms',      value: counts.tftDamageSkins },
                    ].map(({ label, value }) => (
                      <div key={label} className="rv-stat-card">
                        <div className="rv-stat-card-label">{label}</div>
                        <div className="rv-stat-card-value">{value}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── MASTERY ── */}
          {tab === 'MASTERY' && (() => {
            const masteryData = Array.isArray(scan?.champion_mastery) ? scan.champion_mastery : []
            if (masteryData.length === 0) return <div style={{ padding: '22px 20px' }}><div className="rv-empty">No mastery data</div></div>
            const masteryColor = lvl => lvl >= 8 ? '#60a5fa' : lvl === 7 ? '#f59e0b' : lvl === 6 ? '#a855f7' : lvl === 5 ? '#0ac8b9' : '#5b6a7e'
            const sorted = [...masteryData].sort((a, b) => (b.championPoints || 0) - (a.championPoints || 0))
            const q = search.toLowerCase()
            const filtered = q ? sorted.filter(m => champMap[m.championId]?.name?.toLowerCase().includes(q)) : sorted
            if (filtered.length === 0) return <div style={{ padding: '22px 20px' }}><div className="rv-empty">No champions match search</div></div>
            return (
              <div className="rv-mastery-list">
                {filtered.map((m, i) => {
                  const champ = champMap[m.championId]
                  const lvl = m.championLevel ?? 0
                  const color = masteryColor(lvl)
                  return (
                    <div key={m.championId} className="rv-mastery-row">
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#3c4a5c', width: 22, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                      {champ?.iconUrl
                        ? <img className="rv-mastery-icon" src={champ.iconUrl} alt={champ.name} onError={e => { e.target.style.opacity = 0 }} />
                        : <div className="rv-mastery-icon" style={{ background: '#1e2a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3c4a5c', fontSize: 14 }}>?</div>
                      }
                      <span className="rv-mastery-name">{champ?.name || `Champion #${m.championId}`}</span>
                      <img src={`https://raw.communitydragon.org/latest/game/assets/ux/mastery/legendarychampionmastery/masterycrest_level${lvl}.png`} alt={`M${lvl}`} width={24} height={24} style={{ flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
                      <div className="rv-mastery-level-badge" style={{ background: color + '22', border: `1px solid ${color}55`, color }}>{lvl}</div>
                      <div className="rv-mastery-pts">{(m.championPoints || 0).toLocaleString()} pts</div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* ── SKINS: Border disclaimer ── */}
          {tab === 'SKINS' && disclaimerEnabled && (
            <div style={{ padding: '8px 20px 0', fontSize: 11, color: 'rgba(200,155,60,0.55)', fontFamily: 'Inter, sans-serif', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>⚠</span><span>{disclaimerMsg}</span>
            </div>
          )}

          {/* ── SKINS: Champion ── */}
          {tab === 'SKINS' && groupBy === 'champion' && (
            championGroups.length === 0
              ? <div style={{ padding: '22px 20px' }}><div className="rv-empty">No skins found</div></div>
              : <div className="rv-skin-grid">
                  {championGroups.map(({ champId, champName, champIconUrl, owned, total, skins }) => (
                    <div key={champId} style={{ display: 'contents' }}>
                      <GroupHeader name={champName} count={owned} total={total}
                        complete={owned >= total} iconUrl={champIconUrl} />
                      {skins.map(skin => {
                        const ownedChromas = (skin.chromas || []).filter(c => ownedChromaSet.has(c.id))
                        return (
                          <SkinCard key={skin.id} skin={skin} champName={champName}
                            chromaCount={ownedChromas.length} isVintage={vintageSkinSet.has(skin.id)}
                            onClick={() => setSelected({ skin, ownedChromas })} />
                        )
                      })}
                    </div>
                  ))}
                </div>
          )}

          {/* ── SKINS: Tier ── */}
          {tab === 'SKINS' && groupBy === 'tier' && (
            tierGroups.length === 0
              ? <div style={{ padding: '22px 20px' }}><div className="rv-empty">No skins found</div></div>
              : <div className="rv-skin-grid">
                  {tierGroups.map(({ rarity, skins }) => (
                    <div key={rarity} style={{ display: 'contents' }}>
                      <GroupHeader name={RARITY_LABEL[rarity]} count={skins.length} />
                      {skins.map(skin => {
                        const cid = Math.floor(skin.id / 1000)
                        const ownedChromas = (skin.chromas || []).filter(c => ownedChromaSet.has(c.id))
                        return (
                          <SkinCard key={skin.id} skin={skin} champName={champMap[cid]?.name || ''}
                            chromaCount={ownedChromas.length} isVintage={vintageSkinSet.has(skin.id)}
                            onClick={() => setSelected({ skin, ownedChromas })} />
                        )
                      })}
                    </div>
                  ))}
                </div>
          )}

          {/* ── SKINS: All ── */}
          {tab === 'SKINS' && groupBy === 'all' && (
            <div className="rv-skin-grid">
              {allSkins.length === 0
                ? <div className="rv-empty">No skins found</div>
                : allSkins.map(skin => {
                    const cid = Math.floor(skin.id / 1000)
                    const ownedChromas = (skin.chromas || []).filter(c => ownedChromaSet.has(c.id))
                    return (
                      <SkinCard key={skin.id} skin={skin} champName={champMap[cid]?.name || ''}
                        chromaCount={ownedChromas.length} isVintage={vintageSkinSet.has(skin.id)}
                        onClick={() => setSelected({ skin, ownedChromas })} />
                    )
                  })
              }
            </div>
          )}

          {/* ── EMOTES ── */}
          {tab === 'EMOTES' && (
            ownedEmotes.length === 0
              ? <div style={{ padding: '22px 20px' }}><div className="rv-empty">No emotes</div></div>
              : <div className="rv-item-grid">
                  {ownedEmotes.filter(e => !search || e.name?.toLowerCase().includes(search.toLowerCase())).map(e => (
                    <ItemCard key={e.id} imgSrc={cdnUrl(e.inventoryIcon || e.iconPath)} name={e.name} />
                  ))}
                </div>
          )}

          {/* ── ICONS ── */}
          {tab === 'ICONS' && (
            ownedIcons.length === 0
              ? <div style={{ padding: '22px 20px' }}><div className="rv-empty">No icons</div></div>
              : <div className="rv-item-grid">
                  {ownedIcons.filter(i => !search || i.title?.toLowerCase().includes(search.toLowerCase())).map(i => (
                    <ItemCard key={i.id} imgSrc={cdnUrl(i.imagePath)} name={i.title} />
                  ))}
                </div>
          )}

          {/* ── WARDS ── */}
          {tab === 'WARDS' && (
            ownedWards.length === 0
              ? <div style={{ padding: '22px 20px' }}><div className="rv-empty">No wards</div></div>
              : <div className="rv-item-grid">
                  {ownedWards.filter(w => !search || w.name?.toLowerCase().includes(search.toLowerCase())).map(w => (
                    <ItemCard key={w.id} imgSrc={cdnUrl(w.wardImagePath)} name={w.name} />
                  ))}
                </div>
          )}

          {/* ── CHROMAS ── */}
          {tab === 'CHROMAS' && (
            chromaSkins.length === 0
              ? <div style={{ padding: '22px 20px' }}><div className="rv-empty">No chromas owned</div></div>
              : <div style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 26 }}>
                  {chromaSkins.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase())).map(skin => {
                    const ownedChromas = (skin.chromas || []).filter(c => ownedChromaSet.has(c.id))
                    const skinLabel = skin.name
                    return (
                      <div key={skin.id}>
                        <div className="rv-loot-cat-header" style={{ marginBottom: 10 }}>
                          <img src={cdnUrl(skin.tilePath)} alt="" width={16} height={16}
                            style={{ objectFit: 'cover', borderRadius: 1 }}
                            onError={e => { e.target.style.display = 'none' }} />
                          {skinLabel}
                          <span style={{ color: '#0ac8b9', fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600 }}>
                            ({ownedChromas.length}/{skin.chromas?.length})
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {skin.chromas.map(c => {
                            const owned = ownedChromaSet.has(c.id)
                            return (
                              <div key={c.id} className="rv-chroma-card"
                                style={{ opacity: owned ? 1 : 0.25, borderColor: owned ? 'rgba(200,155,60,0.3)' : 'rgba(30,42,58,0.8)' }}>
                                <div className="rv-chroma-img-wrap">
                                  <img className="rv-chroma-img" src={cdnUrl(c.chromaPath)} alt=""
                                    loading="lazy"
                                    onError={e => { e.target.style.background = c.colors?.[0] || '#1e2a3a'; e.target.style.opacity = 0 }} />
                                </div>
                                <div className="rv-chroma-name">{skinLabel}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
          )}

          {/* ── FINISHERS ── */}
          {tab === 'FINISHERS' && (
            (scan?.owned_finisher_ids || []).length === 0
              ? <div style={{ padding: '22px 20px' }}><div className="rv-empty">No finishers</div></div>
              : <div className="rv-item-grid">
                  {(scan?.owned_finisher_ids || [])
                    .filter(id => !search || finisherMap[id]?.name?.toLowerCase().includes(search.toLowerCase()))
                    .map(id => {
                      const item = finisherMap[id]
                      return <ItemCard key={id} imgSrc={cdnUrl(item?.iconPath)} name={item?.name || `Finisher #${id}`} />
                    })}
                </div>
          )}

          {/* ── LOOT ── */}
          {tab === 'LOOT' && (() => {
            const LOOT_SKIP = new Set(['CURRENCY_cosmetic', 'CURRENCY_mythic'])
            const CATS = [
              { key: 'champion',    label: 'Champion Shards',       test: id => id.startsWith('CHAMPION_RENTAL_') },
              { key: 'skin_perm',   label: 'Skin Permanents',       test: id => id.startsWith('CHAMPION_SKIN_') && !id.includes('RENTAL') },
              { key: 'skin_shard',  label: 'Skin Shards',           test: id => id.startsWith('SKIN_RENTAL_') || id.startsWith('CHAMPION_SKIN_RENTAL_') },
              { key: 'emote_shard', label: 'Emote Shards',          test: id => id.startsWith('EMOTE_RENTAL_') },
              { key: 'emote_perm',  label: 'Emote Permanents',      test: id => id.startsWith('EMOTE_') && !id.startsWith('EMOTE_RENTAL_') },
              { key: 'ward_shard',  label: 'Ward Skin Shards',      test: id => id.startsWith('WARD_SKIN_RENTAL_') },
              { key: 'ward_perm',   label: 'Ward Skin Permanents',  test: id => id.startsWith('WARD_SKIN_') && !id.startsWith('WARD_SKIN_RENTAL_') },
              { key: 'icon_shard',  label: 'Icon Shards',           test: id => id.startsWith('SUMMONER_ICON_RENTAL_') },
              { key: 'icon_perm',   label: 'Icon Permanents',       test: id => id.startsWith('SUMMONER_ICON_') && !id.startsWith('SUMMONER_ICON_RENTAL_') },
              { key: 'eternal',     label: 'Eternals',              test: id => id.startsWith('STATSTONE_') },
              { key: 'material',    label: 'Materials',             test: id => id.startsWith('MATERIAL_') },
              { key: 'chest',       label: 'Chests & Capsules',     test: id => id.startsWith('CHEST_') },
              { key: 'other',       label: 'Other',                 test: () => true },
            ]
            const q = search.toLowerCase()
            const buckets = {}
            for (const c of CATS) buckets[c.key] = []

            for (const [lootId, item] of Object.entries(loot.allItems || {})) {
              if (!item.count || LOOT_SKIP.has(lootId)) continue
              if (lootId.toLowerCase().includes('clash') || lootId.toLowerCase().includes('ticket')) continue
              if (lootId.toLowerCase().startsWith('chest_champion_mastery')) continue
              if (lootId === 'MATERIAL_key') continue
              if ((!item.localizedName || item.localizedName === '') && item.storeItemId == -1) continue

              let name = item.localizedName || null
              let imgSrc = null
              let accent = null

              if (lootId.startsWith('CHAMPION_RENTAL_')) {
                const ch = champMap[parseInt(lootId.slice('CHAMPION_RENTAL_'.length))]
                if (!name && ch?.name) name = ch.name + ' Shard'
                if (ch?.iconUrl) imgSrc = ch.iconUrl
              } else if (lootId.startsWith('CHAMPION_SKIN_') && !lootId.includes('RENTAL')) {
                const s = catalogs.skins?.[parseInt(lootId.slice('CHAMPION_SKIN_'.length))]
                if (!name && s?.name) name = s.name
                if (s?.tilePath) imgSrc = cdnUrl(s.tilePath)
                accent = '#e08c20'
              } else if (lootId.startsWith('SKIN_RENTAL_')) {
                const s = catalogs.skins?.[parseInt(lootId.slice('SKIN_RENTAL_'.length))]
                if (!name && s?.name) name = s.name + ' Shard'
                if (s?.tilePath) imgSrc = cdnUrl(s.tilePath)
                accent = '#4a90d9'
              } else if (lootId.startsWith('CHAMPION_SKIN_RENTAL_')) {
                const s = catalogs.skins?.[parseInt(lootId.slice('CHAMPION_SKIN_RENTAL_'.length))]
                if (!name && s?.name) name = s.name + ' Shard'
                if (s?.tilePath) imgSrc = cdnUrl(s.tilePath)
                accent = '#4a90d9'
              } else if (lootId.startsWith('EMOTE_RENTAL_')) {
                const parsedId = parseInt(lootId.slice('EMOTE_RENTAL_'.length))
                const lookupId = item.storeItemId > 0 ? item.storeItemId : parsedId
                const e = emoteMap[lookupId] || emoteMap[parsedId]
                if (!name && e?.name) name = e.name + ' Shard'
                if (e?.inventoryIcon || e?.iconPath) imgSrc = cdnUrl(e.inventoryIcon || e.iconPath)
                accent = '#4a90d9'
              } else if (lootId.startsWith('EMOTE_')) {
                const parsedId = parseInt(lootId.slice('EMOTE_'.length))
                const lookupId = item.storeItemId > 0 ? item.storeItemId : parsedId
                const e = emoteMap[lookupId] || emoteMap[parsedId]
                if (!name && e?.name) name = e.name
                if (e?.inventoryIcon || e?.iconPath) imgSrc = cdnUrl(e.inventoryIcon || e.iconPath)
              } else if (lootId.startsWith('WARD_SKIN_RENTAL_')) {
                const parsedId = parseInt(lootId.slice('WARD_SKIN_RENTAL_'.length))
                const lookupId = item.storeItemId > 0 ? item.storeItemId : parsedId
                const w = wardCatalogMap[lookupId] || wardCatalogMap[parsedId]
                if (!name && w?.name) name = w.name + ' Shard'
                if (w?.wardImagePath) imgSrc = cdnUrl(w.wardImagePath)
                accent = '#4a90d9'
              } else if (lootId.startsWith('WARD_SKIN_')) {
                const parsedId = parseInt(lootId.slice('WARD_SKIN_'.length))
                const lookupId = item.storeItemId > 0 ? item.storeItemId : parsedId
                const w = wardCatalogMap[lookupId] || wardCatalogMap[parsedId]
                if (!name && w?.name) name = w.name
                if (w?.wardImagePath) imgSrc = cdnUrl(w.wardImagePath)
              } else if (lootId.startsWith('SUMMONER_ICON_RENTAL_')) {
                const parsedId = parseInt(lootId.slice('SUMMONER_ICON_RENTAL_'.length))
                const lookupId = item.storeItemId > 0 ? item.storeItemId : parsedId
                const ic = iconCatalogMap[lookupId] || iconCatalogMap[parsedId]
                if (!name && (ic?.title || ic?.name)) name = (ic.title || ic.name) + ' Shard'
                if (ic?.imagePath) imgSrc = cdnUrl(ic.imagePath)
                accent = '#4a90d9'
              } else if (lootId.startsWith('SUMMONER_ICON_')) {
                const parsedId = parseInt(lootId.slice('SUMMONER_ICON_'.length))
                const lookupId = item.storeItemId > 0 ? item.storeItemId : parsedId
                const ic = iconCatalogMap[lookupId] || iconCatalogMap[parsedId]
                if (!name && (ic?.title || ic?.name)) name = ic.title || ic.name
                if (ic?.imagePath) imgSrc = cdnUrl(ic.imagePath)
              } else if (lootId.startsWith('STATSTONE_')) {
                if (name) {
                  const lowerName = name.toLowerCase()
                  const matchedChamp = Object.values(champMap).find(c => lowerName.includes(c.name.toLowerCase()))
                  if (matchedChamp) imgSrc = matchedChamp.iconUrl
                }
              } else if (lootId === 'MATERIAL_key_fragment') {
                name = 'Key Fragment'
              }

              name = name || lootId
              if (q && !name.toLowerCase().includes(q)) continue
              const cat = CATS.find(c => c.test(lootId))
              buckets[cat.key].push({ lootId, item, name, imgSrc, accent })
            }

            const filled = CATS.filter(c => buckets[c.key].length > 0)
            if (filled.length === 0) return <div style={{ padding: '22px 20px' }}><div className="rv-empty">No loot data</div></div>

            return (
              <div className="rv-loot-section">
                {filled.map(cat => (
                  <div key={cat.key}>
                    <div className="rv-loot-cat-header">
                      {cat.label}
                      <span style={{ color: '#0ac8b9', fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600 }}>
                        ({buckets[cat.key].reduce((s, x) => s + x.item.count, 0)})
                      </span>
                    </div>
                    <div className="rv-loot-cat-grid">
                      {buckets[cat.key].sort((a, b) => a.name.localeCompare(b.name)).map(({ lootId, item, name, imgSrc, accent }) => (
                        <LootCard key={lootId} imgSrc={imgSrc} name={name} count={item.count} accent={accent} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* ── TFT ── */}
          {tab === 'TFT' && (() => {
            const total = counts.tftCompanions + counts.tftMapSkins + counts.tftDamageSkins
            if (total === 0) return (
              <div style={{ padding: '22px 20px' }}><div className="rv-empty">No TFT cosmetics data</div></div>
            )
            const tftSearch = search.toLowerCase()
            return (
              <div style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

                {counts.tftCompanions > 0 && (
                  <div>
                    <div className="rv-overview-section" style={{ marginBottom: 12 }}>Little Legends ({counts.tftCompanions})</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 11 }}>
                      {(scan.tft_companion_ids || []).map(id => {
                        const item = companionMap[id]
                        const name = item?.name || `Little Legend #${id}`
                        if (tftSearch && !name.toLowerCase().includes(tftSearch)) return null
                        const img = item?.iconPath || item?.loadoutsIcon
                        return <ItemCard key={id} imgSrc={img ? resolveUrl(img) : null} name={name} />
                      })}
                    </div>
                  </div>
                )}
                {counts.tftMapSkins > 0 && (
                  <div>
                    <div className="rv-overview-section" style={{ marginBottom: 12 }}>Arenas ({counts.tftMapSkins})</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 11 }}>
                      {(scan.tft_map_skin_ids || []).map(id => {
                        const item = tftMapSkinMap[id]
                        const name = item?.name || `Arena #${id}`
                        if (tftSearch && !name.toLowerCase().includes(tftSearch)) return null
                        return <ItemCard key={id} imgSrc={item?.iconPath ? resolveUrl(item.iconPath) : null} name={name} />
                      })}
                    </div>
                  </div>
                )}
                {counts.tftDamageSkins > 0 && (
                  <div>
                    <div className="rv-overview-section" style={{ marginBottom: 12 }}>Booms ({counts.tftDamageSkins})</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 11 }}>
                      {(scan.tft_damage_skin_ids || []).map(id => {
                        const item = tftDamageSkinMap[id]
                        const name = item?.name || `Boom #${id}`
                        if (tftSearch && !name.toLowerCase().includes(tftSearch)) return null
                        return <ItemCard key={id} imgSrc={item?.iconPath ? resolveUrl(item.iconPath) : null} name={name} />
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

        </main>
      </div>

      {/* ── Skin Detail Modal ── */}
      {selected && (
        <div className="rv-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="rv-modal" onClick={e => e.stopPropagation()}
            style={{ boxShadow: `0 0 50px ${RARITY_GLOW[selected.skin.rarity] || 'transparent'}` }}>
            <button className="rv-modal-close" onClick={() => setSelected(null)}>✕</button>
            <img className="rv-modal-splash"
              src={cdnUrl(selected.skin.uncenteredSplashPath || selected.skin.splashPath)}
              alt={selected.skin.name}
              onError={e => { e.target.src = cdnUrl(selected.skin.tilePath) }} />
            <div className="rv-modal-info">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#7b8a9e', marginBottom: 3 }}>
                    {champMap[Math.floor(selected.skin.id / 1000)]?.name || ''}
                  </p>
                  <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 18, fontWeight: 700, color: '#e8e0d0', letterSpacing: '0.02em' }}>
                    {selected.skin.name}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <img src={GEM_SRC[selected.skin.rarity]} alt="" width={15} height={15} />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#c89b3c', letterSpacing: 2 }}>
                      {RARITY_LABEL[selected.skin.rarity]}
                    </span>
                    {selected.skin.isLegacy && (
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#c89b3c', border: '1px solid rgba(200,155,60,0.4)', padding: '1px 5px', letterSpacing: 1 }}>LEGACY</span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', color: '#5b5a56', fontSize: 18, cursor: 'pointer', padding: '2px 6px' }}>×</button>
              </div>
              {selected.ownedChromas.length > 0 && (
                <div style={{ marginTop: 13 }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#7b8a9e', letterSpacing: 2, marginBottom: 8 }}>
                    CHROMAS — {selected.ownedChromas.length} OF {selected.skin.chromas?.length} OWNED
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selected.skin.chromas.map(c => {
                      const owned = ownedChromaSet.has(c.id)
                      return (
                        <div key={c.id} style={{ opacity: owned ? 1 : 0.2, border: `2px solid ${owned ? '#c89b3c' : '#1e2a3a'}` }}>
                          <img src={cdnUrl(c.chromaPath)} alt="" width={38} height={38}
                            style={{ display: 'block', objectFit: 'cover' }}
                            onError={e => { e.target.style.background = c.colors?.[0] || '#333'; e.target.style.width = '38px'; e.target.style.height = '38px' }} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
