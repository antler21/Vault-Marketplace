'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

const CDN = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default'

function cdnUrl(p) {
  if (!p) return ''
  return CDN + p.toLowerCase().replace('/lol-game-data/assets', '')
}

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
const RANK_COLORS = { CHALLENGER: '#f4c874', GRANDMASTER: '#f4c874', MASTER: '#c87db4', DIAMOND: '#6ec6e8', EMERALD: '#50c878', PLATINUM: '#4fc0a0', GOLD: '#d4a520', SILVER: '#b0b8c0', BRONZE: '#c07840', IRON: '#8a7a70' }

const TABS = [
  { id: 'OVERVIEW',  label: 'Overview',   icon: '⬡' },
  { id: 'DETAILS',   label: 'Details',    icon: '📋' },
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

.ov-titlebar {
  position: fixed; top: 0; left: 0; right: 0; height: 76px;
  display: flex; align-items: center;
  background: rgba(6,10,18,0.55);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(200,155,60,0.2);
  z-index: 1000; padding: 0 14px 0 16px; gap: 0;
}
.ov-owner-banner {
  position: absolute; top: 0; left: 50%; transform: translateX(-50%);
  background: rgba(126,101,81,0.25); border-bottom: 1px solid rgba(126,101,81,0.4);
  border-left: 1px solid rgba(126,101,81,0.4); border-right: 1px solid rgba(126,101,81,0.4);
  padding: 2px 14px; font-family: 'Inter', sans-serif; font-size: 9px; font-weight: 700;
  color: #7E6551; letter-spacing: 0.15em; text-transform: uppercase; border-radius: 0 0 6px 6px;
}
.ov-summoner-profile { display: flex; align-items: center; gap: 12px; flex: 1; }
.ov-avatar-wrapper {
  position: relative; width: 54px; height: 54px; border-radius: 50%;
  border: 2px solid #7E6551; padding: 2px; background: #010a13;
  box-shadow: 0 0 8px rgba(126,101,81,0.4);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.ov-avatar { width: 100%; height: 100%; border-radius: 50%; border: 1px solid #c89b3c; object-fit: cover; }
.ov-level-outer {
  position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%);
  width: 42px; height: 19px; background: #c89b3c;
  clip-path: polygon(20% 0, 80% 0, 100% 50%, 80% 100%, 20% 100%, 0 50%);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 3px 5px rgba(0,0,0,0.8);
}
.ov-level-inner {
  width: 38px; height: 15px; background: #1e282d;
  clip-path: polygon(20% 0, 80% 0, 100% 50%, 80% 100%, 20% 100%, 0 50%);
  color: #a09b8c; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; letter-spacing: 0.05em;
}
.ov-summoner-details { display: flex; flex-direction: column; justify-content: center; }
.ov-summoner-name { font-family: 'Cinzel', serif; font-size: 18px; font-weight: 700; color: #c89b3c; letter-spacing: 0.06em; line-height: 1.1; }
.ov-summoner-tag { color: #7b8a9e; font-weight: 400; font-size: 13px; font-family: 'Inter', sans-serif; margin-left: 3px; }
.ov-summoner-sub { font-family: 'Inter', sans-serif; font-size: 11px; color: #3c4a5c; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 2px; }
.ov-rank-row { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 3px; }
.ov-rank-pill { display: inline-flex; align-items: center; gap: 3px; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 600; color: #7b8a9e; letter-spacing: 0.03em; }
.ov-titlebar-right { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.ov-currency { display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.3); border: 1px solid rgba(200,155,60,0.15); padding: 4px 8px; }
.ov-currency-val { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 700; color: #c89b3c; }
.ov-currency-be { color: #5b9bd5; }
.ov-currency-label { font-family: 'Inter', sans-serif; font-size: 10px; color: #7b8a9e; }
.ov-badge { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; white-space: nowrap; border-radius: 2px; }
.ov-badge-oge { background: rgba(232,160,32,0.15); border: 1px solid rgba(232,160,32,0.35); color: #e8a020; }
.ov-badge-ogi { background: rgba(76,175,80,0.15); border: 1px solid rgba(76,175,80,0.35); color: #4caf50; }
.ov-badge-price { background: rgba(200,155,60,0.15); border: 1px solid rgba(200,155,60,0.35); color: #c89b3c; }
.ov-generated { font-family: 'Inter', sans-serif; font-size: 10px; color: #3c4a5c; white-space: nowrap; }

.ov-tab-bar {
  position: fixed; top: 76px; left: 0; right: 0; height: 30px;
  display: flex; align-items: stretch;
  background: rgba(6,10,18,0.85);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(200,155,60,0.12);
  z-index: 999; padding: 0 6px; gap: 2px; overflow-x: auto; overflow-y: hidden;
}
.ov-tab-bar::-webkit-scrollbar { display: none; }
.ov-tab-item {
  display: flex; align-items: center; gap: 5px; padding: 0 11px; height: 100%;
  background: transparent; border: none; border-bottom: 2px solid transparent;
  color: #7b8a9e; font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 500;
  cursor: pointer; white-space: nowrap; transition: all 0.15s; flex-shrink: 0;
}
.ov-tab-item:hover { color: #e8e0d0; background: rgba(200,155,60,0.06); }
.ov-tab-item.active { color: #c89b3c; border-bottom-color: #c89b3c; background: rgba(200,155,60,0.08); }
.ov-tab-icon { font-size: 12px; line-height: 1; }
.ov-tab-count { font-size: 10px; color: #0ac8b9; font-weight: 600; margin-left: 2px; }

.ov-content { position: fixed; top: 106px; left: 0; right: 0; bottom: 0; display: flex; }
.ov-panel {
  width: 280px; flex-shrink: 0; background: transparent;
  display: flex; flex-direction: column;
  padding: 18px 24px 16px; overflow-y: auto; position: relative;
  scrollbar-gutter: stable;
}
.ov-control-pane { position: relative; width: 100%; }
.ov-cp-bg { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; pointer-events: none; z-index: 0; }
.ov-cp-top { width: 100%; height: 178px; background: url('/control-pane/control-pane-frame-top.png') top center / 100% auto no-repeat; flex-shrink: 0; }
.ov-cp-mid { width: 100%; flex-grow: 1; background: url('/control-pane/control-pane-frame-mid.png') top center / 100% auto repeat-y; }
.ov-cp-bot { width: 100%; height: 16px; background: url('/control-pane/control-pane-frame-bot.png') top center / 100% auto no-repeat; flex-shrink: 0; }
.ov-cp-content { position: relative; z-index: 1; display: flex; flex-direction: column; padding: 18px 12px 18px; }
.ov-stats-ring-wrap { display: flex; justify-content: center; padding: 12px 0 10px; }
.ov-stats-ring { width: 112px; height: 112px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ov-stats-ring-num { font-family: 'Times New Roman', Times, serif; font-size: 51px; font-weight: 700; color: #ceae78; line-height: 1; letter-spacing: 0.01em; white-space: nowrap; }
.ov-stats-ring-num.sm { font-size: 38px; }
.ov-stats-ring-num.xs { font-size: 29px; }
.ov-stats-ring-label { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600; color: #b8b6b3; text-transform: uppercase; letter-spacing: 0.1em; text-align: center; line-height: 1.3; margin-top: 3px; }
.ov-rarity-gems { display: flex; justify-content: center; gap: 10px; padding: 58px 0 13px; border-bottom: 2px solid rgba(200,155,60,0.25); flex-wrap: wrap; }
.ov-gem-item { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.ov-gem { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; }
.ov-gem img { width: 100%; height: 100%; object-fit: contain; }
.ov-gem-count { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500; color: #a09070; }
.ov-mini-stats { display: flex; justify-content: center; gap: 22px; padding: 16px 0 10px; }
.ov-mini-stat { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.ov-mini-stat-icon { width: 26px; height: 26px; object-fit: contain; }
.ov-mini-stat-val { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500; color: #a09070; }
.ov-mini-stat-sub { font-family: 'Inter', sans-serif; font-size: 10px; color: #7b8a9e; margin-top: -3px; }
.ov-panel-divider { border: none; border-top: 1px solid rgba(200,155,60,0.08); margin: 3px 0; }
.ov-panel-controls { margin-top: 18px; display: flex; flex-direction: column; flex: 1; }
.ov-search-wrap { position: relative; margin-bottom: 14px; }
.ov-search-icon { width: 14px; height: 14px; position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #f0e6d0; pointer-events: none; }
.ov-search { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid #7a5c29; color: #c99c3e; font-family: 'Inter', sans-serif; font-size: 13px; padding: 9px 11px 9px 32px; outline: none; transition: border-color 0.2s; }
.ov-search:focus { border-color: #b98a25; }
.ov-search::placeholder { color: #6a6a6a; }
.ov-currency-panel { margin-top: 12px; display: flex; flex-direction: column; gap: 5px; padding: 10px 4px; border-top: 1px solid rgba(200,155,60,0.08); }
.ov-currency-row { display: flex; align-items: center; gap: 6px; }
.ov-currency-row-val { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; color: #e8e0d0; }
.ov-currency-row-label { font-family: 'Inter', sans-serif; font-size: 11px; color: #7b8a9e; margin-left: auto; }

.ov-main { flex: 1; overflow-y: auto; min-width: 0; }

.ov-overview { padding: 20px; display: flex; flex-direction: column; gap: 14px; max-width: 680px; }
.ov-overview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.ov-stat-card { background: #111b2a; border: 1px solid rgba(200,155,60,0.12); padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
.ov-stat-card-label { font-family: 'Inter', sans-serif; font-size: 10px; color: #5b6a7e; text-transform: uppercase; letter-spacing: 1px; }
.ov-stat-card-value { font-family: 'Cinzel', serif; font-size: 22px; font-weight: 700; color: #c89b3c; line-height: 1; }
.ov-stat-card-value.small { font-size: 14px; font-family: 'Inter', sans-serif; color: #e8e0d0; font-weight: 600; }
.ov-stat-card-note { font-family: 'Inter', sans-serif; font-size: 10px; color: #3c4a5c; margin-top: 2px; }
.ov-overview-section { font-family: 'Cinzel', serif; font-size: 11px; color: #7b8a9e; letter-spacing: 2px; text-transform: uppercase; border-bottom: 1px solid rgba(200,155,60,0.12); padding-bottom: 6px; margin-top: 4px; }
.ov-details-note { font-family: 'Inter', sans-serif; font-size: 11px; color: #3c4a5c; line-height: 1.5; padding: 10px 14px; background: rgba(0,0,0,0.2); border: 1px solid rgba(200,155,60,0.08); border-radius: 4px; }

.ov-skin-grid {
  padding: 22px 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(144px, 173px));
  gap: 19px 32px;
  align-content: start;
  justify-content: center;
}
.ov-group-header { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; padding: 8px 0 3px; }
.ov-group-header-name { font-family: 'Cinzel', serif; font-size: 16px; font-weight: 700; color: #e8e0d0; letter-spacing: 0.04em; }
.ov-group-header-count { font-family: 'Inter', sans-serif; font-size: 13px; color: #0ac8b9; font-weight: 500; }
.ov-group-header-line { flex: 1; height: 1px; background: linear-gradient(to right, rgba(200,155,60,0.12), transparent); }
.ov-group-complete .ov-group-header-name { color: #f0c860; }
.ov-group-complete .ov-group-header-count { color: #c89b3c; }
.ov-group-complete .ov-group-header-count::after { content: ' ✓'; color: #f0c860; font-size: 11px; }
.ov-group-complete .ov-group-header-line { background: linear-gradient(to right, #c89b3c, transparent); }

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
  overflow: hidden;
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
.ov-mastery-list { padding: 22px 20px; display: flex; flex-direction: column; gap: 6px; }
.ov-mastery-row { display: flex; align-items: center; gap: 12px; padding: 9px 12px; background: #111b2a; border: 1px solid rgba(200,155,60,0.1); transition: border-color 0.15s; }
.ov-mastery-row:hover { border-color: rgba(200,155,60,0.3); }
.ov-mastery-icon { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid rgba(200,155,60,0.25); }
.ov-mastery-name { flex: 1; font-family: 'Cinzel', serif; font-size: 12px; font-weight: 600; color: #e8e0d0; }
.ov-mastery-level-badge { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 800; flex-shrink: 0; }
.ov-mastery-pts { font-family: 'Inter', sans-serif; font-size: 11px; color: #5b6a7e; width: 80px; text-align: right; flex-shrink: 0; }

.ov-item-grid { padding: 22px 20px; display: flex; flex-wrap: wrap; gap: 11px; align-content: start; }
.ov-item-card { width: 80px; background: #111b2a; border: 1px solid rgba(200,155,60,0.12); cursor: default; transition: border-color 0.15s, box-shadow 0.15s; }
.ov-item-card:hover { border-color: #c89b3c; box-shadow: 0 0 10px rgba(200,155,60,0.2); }
.ov-item-img-wrap { width: 80px; height: 80px; background: #0a1628; overflow: hidden; }
.ov-item-img { width: 100%; height: 100%; object-fit: cover; display: block; filter: brightness(0.88); transition: filter 0.15s; }
.ov-item-card:hover .ov-item-img { filter: brightness(1.1); }
.ov-item-name { padding: 4px 5px; font-family: 'Inter', sans-serif; font-size: 8px; color: #7b8a9e; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-top: 1px solid rgba(200,155,60,0.12); }

.ov-chroma-card { width: 80px; background: #111b2a; border: 1px solid rgba(200,155,60,0.12); cursor: default; transition: border-color 0.15s, box-shadow 0.15s; }
.ov-chroma-card:hover { border-color: #c89b3c; box-shadow: 0 0 8px rgba(200,155,60,0.2); }
.ov-chroma-img-wrap { width: 80px; height: 80px; overflow: hidden; background: #0a1628; }
.ov-chroma-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ov-chroma-name { padding: 3px 4px; font-family: 'Inter', sans-serif; font-size: 8px; color: #7b8a9e; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-top: 1px solid rgba(200,155,60,0.12); }

.ov-empty { grid-column: 1/-1; padding: 64px 0; text-align: center; font-family: 'Inter', sans-serif; font-size: 11px; color: #5b5a56; letter-spacing: 2px; text-transform: uppercase; width: 100%; }
.ov-loot-section { padding: 22px 20px; display: flex; flex-direction: column; gap: 18px; }
.ov-loot-cat-header { font-family: 'Cinzel', serif; font-size: 10px; color: #7b8a9e; letter-spacing: 2px; text-transform: uppercase; padding: 0 0 6px; border-bottom: 1px solid rgba(200,155,60,0.12); display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.ov-loot-cat-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.ov-loot-card { width: 80px; background: #111b2a; border: 1px solid rgba(200,155,60,0.12); cursor: default; transition: border-color 0.15s, box-shadow 0.15s; position: relative; }
.ov-loot-card:hover { border-color: #c89b3c; box-shadow: 0 0 10px rgba(200,155,60,0.2); }
.ov-loot-card-img-wrap { width: 80px; height: 80px; background: #0a1628; overflow: hidden; position: relative; }
.ov-loot-card-img { width: 100%; height: 100%; object-fit: cover; display: block; filter: brightness(0.88); transition: filter 0.15s; }
.ov-loot-card:hover .ov-loot-card-img { filter: brightness(1.1); }
.ov-loot-count-badge { position: absolute; bottom: 3px; right: 3px; background: rgba(0,0,0,0.8); color: #e8e0d0; font-family: 'Inter', sans-serif; font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 2px; line-height: 1.4; }

.ov-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.92); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 20px; }
.ov-modal { background: #0a1628; border: 1px solid #785a28; max-width: 600px; width: 100%; position: relative; max-height: 90vh; overflow-y: auto; }
.ov-modal-close { position: absolute; top: 10px; right: 10px; z-index: 10; background: transparent; border: none; color: #5b5a56; font-size: 18px; cursor: pointer; padding: 2px 6px; }
.ov-modal-close:hover { color: #e8e0d0; }
.ov-modal-splash { width: 100%; max-height: 280px; object-fit: cover; object-position: top center; display: block; }
.ov-modal-info { padding: 13px 16px 18px; }

.ov-mob-toggle {
  display: none; align-items: center; margin-left: auto; flex-shrink: 0;
  background: transparent; border: 1px solid rgba(200,155,60,0.3);
  color: #c89b3c; font-family: 'Inter', sans-serif; font-size: 10px;
  font-weight: 600; padding: 0 10px; cursor: pointer; letter-spacing: 0.05em;
  white-space: nowrap; height: 22px;
}

.ov-mob-search-bar {
  display: none; position: fixed; top: 86px; left: 0; right: 0; z-index: 998;
  padding: 6px 12px; background: rgba(6,10,18,0.92);
  border-bottom: 1px solid rgba(200,155,60,0.1);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.ov-mob-search-bar input {
  width: 100%; background: rgba(0,0,0,0.4); border: 1px solid #7a5c29;
  color: #c99c3e; font-family: 'Inter', sans-serif; font-size: 13px;
  padding: 8px 12px; outline: none;
}
.ov-mob-search-bar input::placeholder { color: #6a6a6a; }

@media (max-width: 640px) {
  .ov-titlebar { height: 56px; padding: 0 10px; }
  .ov-avatar-wrapper { width: 40px; height: 40px; }
  .ov-level-outer { width: 34px; height: 16px; }
  .ov-level-inner { width: 30px; height: 12px; font-size: 8px; }
  .ov-summoner-name { font-size: 14px; }
  .ov-summoner-sub, .ov-rank-row { display: none; }
  .ov-currency, .ov-badge, .ov-generated { display: none; }
  .ov-tab-bar { top: 56px; }
  .ov-mob-search-bar { display: flex; }
  .ov-content { top: 124px; flex-direction: column; }
  .ov-panel { width: 100%; padding: 0 16px; max-height: 0; overflow: hidden; transition: max-height 0.3s ease; }
  .ov-panel.mob-open { max-height: 50vh; overflow-y: auto; padding: 12px 16px 8px; }
  .ov-cp-bg { display: none; }
  .ov-cp-content { padding: 0; }
  .ov-stats-ring-wrap { padding: 4px 0; }
  .ov-rarity-gems { padding: 4px 0 8px; }
  .ov-mini-stats { padding: 8px 0 4px; }
  .ov-main { flex: 1; overflow-y: auto; min-height: 0; }
  .ov-skin-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px 14px; padding: 14px 12px; justify-content: start; }
  .ov-item-grid { padding: 14px 12px; }
  .ov-mastery-list, .ov-loot-section { padding: 14px 12px; }
  .ov-overview { padding: 14px 12px; max-width: 100%; }
  .ov-modal-backdrop { padding: 0; align-items: flex-end; }
  .ov-modal { max-width: 100%; width: 100%; max-height: 90vh; border-radius: 12px 12px 0 0; }
  .ov-modal-splash { max-height: 180px; }
  .ov-mob-toggle { display: flex; }
}
`

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
      <div className={`skin-card-gem ${rarityClass}`}><img src={GEM_SRC[rarity]} alt="" /></div>
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

function ItemCard({ imgSrc, name }) {
  return (
    <div className="ov-item-card">
      <div className="ov-item-img-wrap">
        {imgSrc
          ? <img className="ov-item-img" src={imgSrc} alt={name || ''} loading="lazy" onError={e => { e.target.style.opacity = 0 }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3c4a5c', fontSize: 18 }}>◈</div>
        }
      </div>
      <div className="ov-item-name">{name || ''}</div>
    </div>
  )
}

function LootCard({ imgSrc, name, count, accent }) {
  return (
    <div className="ov-loot-card" style={accent ? { borderColor: accent, boxShadow: `0 0 6px ${accent}44` } : {}}>
      <div className="ov-loot-card-img-wrap">
        {imgSrc
          ? <img className="ov-loot-card-img" src={imgSrc} alt={name || ''} loading="lazy" onError={e => { e.target.style.opacity = 0 }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3c4a5c', fontSize: 18 }}>◈</div>
        }
        {count > 1 && <div className="ov-loot-count-badge">×{count}</div>}
      </div>
      <div className="ov-item-name">{name || ''}</div>
    </div>
  )
}

function GroupHeader({ name, count, total, complete, iconUrl }) {
  return (
    <div className={`ov-group-header${complete ? ' ov-group-complete' : ''}`}>
      {iconUrl && (
        <img src={iconUrl} alt="" width={18} height={18}
          style={{ borderRadius: '50%', border: '1px solid rgba(200,155,60,0.3)', flexShrink: 0 }}
          onError={e => { e.target.style.display = 'none' }} />
      )}
      <span className="ov-group-header-name">{name}</span>
      <span className="ov-group-header-count">{total != null ? `${count} / ${total}` : count}</span>
      <div className="ov-group-header-line" />
    </div>
  )
}

function OverviewPageInner() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [scan, setScan]     = useState(null)
  const [catalogs, setCatalogs] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [tab, setTab]       = useState('OVERVIEW')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [groupBy, setGroupBy] = useState('tier')
  const [manualBorderIds, setManualBorderIds]   = useState([])
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
        ]).then(([tac, are]) => ({
          tacticians: Object.values(tac?.data || {}).map(t => ({ id: parseInt(t.id), name: t.name, iconPath: `${DDRAGON}/cdn/${ver}/img/${t.image?.group}/${t.image?.full}` })),
          arenas:     Object.values(are?.data || {}).map(a => ({ id: parseInt(a.id), name: a.name, iconPath: `${DDRAGON}/cdn/${ver}/img/${a.image?.group}/${a.image?.full}` })),
        }))
      }).catch(() => ({ tacticians: [], arenas: [] }))

    Promise.all([
      fetch(`/api/lol-skins/${id}`).then(r => r.json()),
      fetch(`${CDN}/v1/skins.json`).then(r => r.json()),
      fetch(`${CDN}/v1/summoner-icons.json`).then(r => r.json()).catch(() => []),
      fetch(`${CDN}/v1/summoner-emotes.json`).then(r => r.json()).catch(() => []),
      fetch(`${CDN}/v1/ward-skins.json`).then(r => r.json()).catch(() => []),
      fetch(`${CDN}/v1/champion-summary.json`).then(r => r.json()).catch(() => []),
      ddragonFetch,
      fetch(`${CDN}/v1/tftdamageskins.json`).then(r => r.json()).catch(() => []),
      fetch(`${CDN}/v1/nexusfinishers.json`).then(r => r.json()).catch(() => []),
      fetch('/api/border-skins').then(r => r.json()).catch(() => ({})),
    ]).then(([scanData, skinsJson, iconsJson, emotesJson, wardsJson, champsJson, ddragonData, boomJson, finishersJson, borderData]) => {
      if (scanData.error) { setError(scanData.error); setLoading(false); return }
      if (scanData.owner_token && scanData.owner_token !== token) {
        window.location.replace(`/preview/${id}`)
        return
      }
      setScan(scanData)
      if (Array.isArray(borderData?.skin_ids)) setManualBorderIds(borderData.skin_ids)
      setDisclaimerEnabled(borderData?.disclaimer_enabled ?? true)
      if (borderData?.disclaimer_msg) setDisclaimerMsg(borderData.disclaimer_msg)
      const toArr = x => Array.isArray(x) ? x : Object.values(x || {})
      setCatalogs({
        skins: { ...MISSING_SKINS_MAP, ...skinsJson }, icons: iconsJson, emotes: emotesJson, wards: wardsJson, champions: champsJson,
        companions: ddragonData.tacticians, tftMapSkins: ddragonData.arenas,
        tftDamageSkins: toArr(boomJson).filter(d => d.itemId != null).map(d => ({ id: d.itemId, itemId: d.itemId, name: d.name, iconPath: d.loadoutsIcon })),
        finishers: toArr(finishersJson).map(f => ({ id: f.itemId ?? f.id, itemId: f.itemId ?? f.id, name: f.translatedName || f.name || f.localizedName || '', iconPath: f.iconPath || f.loadoutsIcon || f.inventoryIcon || null })).filter(f => f.id != null),
      })
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [id])

  const champMap = useMemo(() => {
    if (!Array.isArray(catalogs.champions)) return {}
    const map = {}
    for (const c of catalogs.champions) { if (c.id > 0) map[c.id] = { name: c.name, iconUrl: cdnUrl(c.squarePortraitPath) } }
    return map
  }, [catalogs.champions])

  const toArr = x => Array.isArray(x) ? x : Object.values(x || {})
  const emoteMap  = useMemo(() => { const m = {}; toArr(catalogs.emotes).forEach(e => { if (e.id != null) m[e.id] = e }); return m }, [catalogs.emotes])
  const iconMap   = useMemo(() => { const m = {}; toArr(catalogs.icons).forEach(i => { if (i.id != null) m[i.id] = i }); return m }, [catalogs.icons])
  const wardMap   = useMemo(() => { const m = {}; toArr(catalogs.wards).forEach(w => { if (w.id != null) m[w.id] = w }); return m }, [catalogs.wards])
  const finMap    = useMemo(() => { const m = {}; (catalogs.finishers || []).forEach(f => { m[f.id] = f; m[f.itemId] = f }); return m }, [catalogs.finishers])
  const compMap   = useMemo(() => { const m = {}; (catalogs.companions || []).forEach(c => { m[c.id] = c }); return m }, [catalogs.companions])
  const arenaMap  = useMemo(() => { const m = {}; (catalogs.tftMapSkins || []).forEach(a => { m[a.id] = a }); return m }, [catalogs.tftMapSkins])
  const boomMap   = useMemo(() => { const m = {}; (catalogs.tftDamageSkins || []).forEach(d => { m[d.id] = d; m[d.itemId] = d }); return m }, [catalogs.tftDamageSkins])

  const ownedChromaSet  = useMemo(() => new Set(scan?.owned_chroma_ids  || []), [scan])
  const vintageSkinSet  = useMemo(() => new Set([...(scan?.vintage_skin_ids || []), ...manualBorderIds]), [scan, manualBorderIds])
  const ownedSkins = useMemo(() => {
    if (!catalogs.skins || !scan) return []
    const chromaIds = new Set(scan.owned_chroma_ids || [])
    return [...new Set(scan.owned_skin_ids || [])].map(sid => catalogs.skins[sid]).filter(s => s && s.id % 1000 !== 0 && !chromaIds.has(s.id))
  }, [catalogs.skins, scan])

  const totalSkinsByChamp = useMemo(() => {
    if (!catalogs.skins) return {}
    const t = {}
    Object.values(catalogs.skins).forEach(s => { if (s && s.id % 1000 !== 0) { const cid = Math.floor(s.id / 1000); t[cid] = (t[cid] || 0) + 1 } })
    return t
  }, [catalogs.skins])

  const counts = useMemo(() => {
    const byRarity = {}
    for (const r of RARITY_ORDER) byRarity[r] = ownedSkins.filter(s => s.rarity === r).length
    return { ...byRarity, legacy: ownedSkins.filter(s => s.isLegacy).length, chromas: (scan?.owned_chroma_ids || []).length, emotes: (scan?.owned_emote_ids || []).length, icons: (scan?.owned_icon_ids || []).length, wards: (scan?.owned_ward_ids || []).length, finishers: (scan?.owned_finisher_ids || []).length, tftCompanions: (scan?.tft_companion_ids || []).length, tftMapSkins: (scan?.tft_map_skin_ids || []).length, tftDamageSkins: (scan?.tft_damage_skin_ids || []).length }
  }, [ownedSkins, ownedChromaSet, scan])

  const chromaSkins = useMemo(() => ownedSkins.filter(s => (s.chromas || []).some(c => ownedChromaSet.has(c.id))), [ownedSkins, ownedChromaSet])
  const ownedIcons  = useMemo(() => toArr(catalogs.icons).filter(i => new Set(scan?.owned_icon_ids || []).has(i.id)), [catalogs.icons, scan])
  const ownedEmotes = useMemo(() => toArr(catalogs.emotes).filter(e => new Set(scan?.owned_emote_ids || []).has(e.id)), [catalogs.emotes, scan])
  const ownedWards  = useMemo(() => toArr(catalogs.wards).filter(w => new Set(scan?.owned_ward_ids || []).has(w.id)), [catalogs.wards, scan])

  const championGroups = useMemo(() => {
    const byChamp = {}
    for (const skin of ownedSkins) {
      if (search && !skin.name.toLowerCase().includes(search.toLowerCase())) continue
      const cid = Math.floor(skin.id / 1000)
      if (!byChamp[cid]) byChamp[cid] = []
      byChamp[cid].push(skin)
    }
    return Object.entries(byChamp).map(([cid, skins]) => {
      const numId = parseInt(cid); const champ = champMap[numId]
      return { champId: numId, champName: champ?.name || `Champion ${cid}`, champIconUrl: champ?.iconUrl || '', owned: skins.length, total: totalSkinsByChamp[numId] || skins.length, skins: skins.slice().sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)) }
    }).sort((a, b) => a.champName.localeCompare(b.champName))
  }, [ownedSkins, champMap, totalSkinsByChamp, search])

  const tierGroups = useMemo(() => {
    const list = ownedSkins.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase())).slice().sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity))
    const groups = {}
    for (const s of list) { const r = s.rarity || 'kNoRarity'; if (!groups[r]) groups[r] = []; groups[r].push(s) }
    return RARITY_ORDER.filter(r => groups[r]?.length).map(r => ({ rarity: r, skins: groups[r] }))
  }, [ownedSkins, search])

  const loot = scan?.loot_summary || {}
  const rp = scan?.rp ?? null
  const be = scan?.be ?? null
  const oe = loot.oe ?? null
  const me = loot.me ?? null

  const fmtTier = t => t ? (t.charAt(0) + t.slice(1).toLowerCase()) : null
  const soloRank = fmtTier(scan?.solo_rank)
  const flexRank = fmtTier(scan?.flex_rank)
  const tftRank  = fmtTier(scan?.tft_rank)
  const ranks = [soloRank && { label: 'SOLO', tier: scan?.solo_rank, display: soloRank }, flexRank && { label: 'FLEX', tier: scan?.flex_rank, display: flexRank }, tftRank && { label: 'TFT', tier: scan?.tft_rank, display: tftRank }].filter(Boolean)

  const ogeFlag = !!scan?.oge
  const ogiFlag = !!scan?.ogi
  const ogiVerified = !!scan?.ogi_verified
  const ogiPartial  = !!scan?.ogi_partial
  const priceAmount   = scan?.price_amount ?? null
  const priceCurrency = scan?.price_currency || null

  const generatedDate = scan?.created_at
    ? new Date(scan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const tabCount = {
    OVERVIEW: null, DETAILS: null,
    MASTERY: Array.isArray(scan?.champion_mastery) ? scan.champion_mastery.length : 0,
    SKINS: ownedSkins.length, EMOTES: counts.emotes, ICONS: counts.icons,
    WARDS: counts.wards, CHROMAS: counts.chromas, FINISHERS: counts.finishers,
    LOOT: Object.keys(loot.allItems || {}).length,
    TFT: counts.tftCompanions + counts.tftMapSkins + counts.tftDamageSkins,
  }

  const ringNum = tabCount[tab] ?? 0
  const ringClass = ringNum >= 1000 ? 'ov-stats-ring-num xs' : ringNum >= 100 ? 'ov-stats-ring-num sm' : 'ov-stats-ring-num'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080c14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <style>{CSS}</style>
      <svg width={48} height={48} viewBox="0 0 60 60">
        <polygon points="30,3 55,17 55,43 30,57 5,43 5,17" fill="none" stroke="#7E6551" strokeWidth="1.5" strokeDasharray="200" strokeDashoffset="200">
          <animate attributeName="stroke-dashoffset" from="200" to="0" dur="1.5s" repeatCount="indefinite" />
        </polygon>
      </svg>
      <div style={{ fontFamily: 'Cinzel, serif', color: '#7E6551', fontSize: 12, letterSpacing: 3 }}>LOADING OVERVIEW...</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#080c14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontFamily: 'serif', fontSize: 14 }}>
      <style>{CSS}</style>
      {error}
    </div>
  )

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <style>{CSS}</style>

      {/* ── Titlebar ── */}
      <header className="ov-titlebar">
        <div className="ov-owner-banner">Owner View</div>
        <div className="ov-summoner-profile">
          {scan.profile_icon_id != null && (
            <div className="ov-avatar-wrapper">
              <img src={profileIconUrl(scan.profile_icon_id)} alt="" className="ov-avatar" onError={e => { e.target.style.opacity = 0 }} />
              <div className="ov-level-outer"><div className="ov-level-inner">{scan.summoner_level}</div></div>
            </div>
          )}
          <div className="ov-summoner-details">
            <div className="ov-summoner-name">
              {scan.summoner_name || <span style={{ color: '#3c4a5c' }}>Hidden Account</span>}
              {scan.tag_line && <span className="ov-summoner-tag">#{scan.tag_line}</span>}
            </div>
            <div className="ov-summoner-sub">{scan.region || 'Unknown Server'}</div>
            {ranks.length > 0 && (
              <div className="ov-rank-row">
                {ranks.map(r => (
                  <span key={r.label} className="ov-rank-pill">
                    <span style={{ color: '#4a5568', fontSize: 9 }}>{r.label}</span>
                    <span style={{ color: RANK_COLORS[r.tier] || '#7b8a9e', fontWeight: 700 }}>{r.display}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ov-titlebar-right">
          {ogeFlag && <span className="ov-badge ov-badge-oge">OGE</span>}
          {ogiFlag && <span className="ov-badge ov-badge-ogi">OGI{ogiVerified ? ' ✓' : ogiPartial ? ' ~' : ''}</span>}
          {priceAmount != null && priceCurrency && (
            <span className="ov-badge ov-badge-price">{priceCurrency} {Number(priceAmount).toLocaleString()}</span>
          )}
          {rp !== null && (
            <div className="ov-currency">
              <img src="/icon-rp.png" alt="" width={14} height={14} onError={e => { e.target.style.display = 'none' }} />
              <span className="ov-currency-val">{rp.toLocaleString()}</span>
              <span className="ov-currency-label">RP</span>
            </div>
          )}
          {be !== null && (
            <div className="ov-currency">
              <img src="/icon-be.png" alt="" width={14} height={14} onError={e => { e.target.style.display = 'none' }} />
              <span className="ov-currency-val ov-currency-be">{be.toLocaleString()}</span>
              <span className="ov-currency-label">BE</span>
            </div>
          )}
        </div>
      </header>
      {generatedDate && <div style={{ position: 'fixed', bottom: 12, left: 18, zIndex: 999, fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#3c4a5c', letterSpacing: '0.05em', pointerEvents: 'none' }}>Generated {generatedDate}</div>}

      {/* ── Tab Bar ── */}
      <div className="ov-tab-bar">
        {TABS.map(t => (
          <button key={t.id} className={`ov-tab-item${tab === t.id ? ' active' : ''}`}
            onClick={() => { setTab(t.id); setSearch(''); setPanelOpen(false) }}>
            <span className="ov-tab-icon">{t.icon}</span>
            <span>{t.label}</span>
            {tabCount[t.id] > 0 && <span className="ov-tab-count">{tabCount[t.id]}</span>}
          </button>
        ))}
        {tab !== 'OVERVIEW' && tab !== 'DETAILS' && (
          <button className="ov-mob-toggle" onClick={() => setPanelOpen(o => !o)}>
            {panelOpen ? 'Hide ▲' : 'Stats ▼'}
          </button>
        )}
      </div>

      {/* ── Mobile Search Bar ── */}
      <div className="ov-mob-search-bar">
        <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* ── Content ── */}
      <div className="ov-content">

        {/* Left Panel */}
        {tab !== 'OVERVIEW' && tab !== 'DETAILS' && (
          <aside className={`ov-panel${panelOpen ? ' mob-open' : ''}`}>
            <div className="ov-control-pane">
              <div className="ov-cp-bg">
                <div className="ov-cp-top" /><div className="ov-cp-mid" /><div className="ov-cp-bot" />
              </div>
              <div className="ov-cp-content">
                <div className="ov-stats-ring-wrap">
                  <div className="ov-stats-ring">
                    <span className={ringClass}>{ringNum}</span>
                    <span className="ov-stats-ring-label">{tab === 'SKINS' ? <>TOTAL SKINS<br/>OWNED</> : <>{`TOTAL ${tab}`}<br/>OWNED</>}</span>
                  </div>
                </div>
                {tab === 'SKINS' && (
                  <>
                    <div className="ov-rarity-gems">
                      {[
                        { key: 'kTranscendent', src: '/tier-icons/transcendent.png', count: counts.kTranscendent },
                        { key: 'kExalted',      src: '/tier-icons/exalted.png',      count: counts.kExalted      },
                        { key: 'kUltimate',     src: '/tier-icons/ultimate.png',     count: counts.kUltimate     },
                        { key: 'kMythic',       src: '/tier-icons/mythic.png',       count: counts.kMythic       },
                        { key: 'kLegendary',    src: '/tier-icons/legendary.png',    count: counts.kLegendary    },
                        { key: 'kEpic',         src: '/tier-icons/epic.png',         count: counts.kEpic         },
                      ].filter(g => g.count > 0).map(g => (
                        <div key={g.key} className="ov-gem-item">
                          <div className="ov-gem"><img src={g.src} alt="" draggable="false" /></div>
                          <span className="ov-gem-count">{g.count}</span>
                        </div>
                      ))}
                    </div>
                    <div className="ov-mini-stats">
                      <div className="ov-mini-stat"><img className="ov-mini-stat-icon" src="/tier-icons/legacy.png" alt="Legacy" /><span className="ov-mini-stat-val">{counts.legacy}</span></div>
                      <div className="ov-mini-stat"><img className="ov-mini-stat-icon" src="/tier-icons/chroma.png" alt="Chromas" /><span className="ov-mini-stat-val">{counts.chromas}</span></div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <hr className="ov-panel-divider" />
            <div className="ov-panel-controls">
              <div className="ov-search-wrap">
                <svg className="ov-search-icon" viewBox="0 0 20 20" fill="none">
                  <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M13.5 13.5 L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input type="text" className="ov-search" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" />
              </div>
              {tab === 'SKINS' && (
                <div style={{ marginBottom: 10, display: 'flex', gap: 6 }}>
                  {['champion', 'tier'].map(g => (
                    <button key={g} onClick={() => setGroupBy(g)}
                      style={{ flex: 1, padding: '6px', background: groupBy === g ? '#7E655122' : 'transparent', border: `1px solid ${groupBy === g ? '#7E655166' : '#2a3a4a'}`, borderRadius: 6, color: groupBy === g ? '#c89b3c' : '#5b6a7e', fontSize: 11, cursor: 'pointer', fontWeight: groupBy === g ? 600 : 400 }}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              )}
              {(be !== null || oe > 0 || me > 0 || loot.hexChests > 0 || loot.hexKeys > 0) && (
                <div className="ov-currency-panel">
                  {be !== null && <div className="ov-currency-row"><img src="/icon-be.png" alt="" width={16} height={16} onError={e => { e.target.style.display = 'none' }} /><span className="ov-currency-row-val">{be.toLocaleString()}</span><span className="ov-currency-row-label">Blue Essence</span></div>}
                  {oe > 0 && <div className="ov-currency-row"><span style={{ fontSize: 16, color: '#c89b3c', lineHeight: 1 }}>◈</span><span className="ov-currency-row-val">{oe.toLocaleString()}</span><span className="ov-currency-row-label">Orange Essence</span></div>}
                  {me > 0 && <div className="ov-currency-row"><img src="/tier-icons/mythic.png" alt="" width={16} height={16} /><span className="ov-currency-row-val">{me.toLocaleString()}</span><span className="ov-currency-row-label">Mythic Essence</span></div>}
                  {loot.hexChests > 0 && <div className="ov-currency-row"><span style={{ fontSize: 16, color: '#c89b3c', lineHeight: 1 }}>⬡</span><span className="ov-currency-row-val">{loot.hexChests}</span><span className="ov-currency-row-label">Chests</span></div>}
                  {loot.hexKeys > 0 && <div className="ov-currency-row"><span style={{ fontSize: 16, color: '#a09070', lineHeight: 1 }}>⚿</span><span className="ov-currency-row-val">{loot.hexKeys}</span><span className="ov-currency-row-label">Keys / Fragments</span></div>}
                </div>
              )}
            </div>
          </aside>
        )}

        <main className="ov-main">

          {/* OVERVIEW */}
          {tab === 'OVERVIEW' && (
            <div className="ov-overview">
              <div className="ov-overview-section">Account</div>
              <div className="ov-overview-grid">
                <div className="ov-stat-card"><div className="ov-stat-card-label">Name</div><div className="ov-stat-card-value small">{scan.summoner_name || '—'}{scan.tag_line && <span style={{ color: '#5b6a7e', fontSize: 12 }}> #{scan.tag_line}</span>}</div></div>
                <div className="ov-stat-card"><div className="ov-stat-card-label">Server</div><div className="ov-stat-card-value small">{scan.region || '—'}</div></div>
                <div className="ov-stat-card"><div className="ov-stat-card-label">Level</div><div className="ov-stat-card-value">{scan.summoner_level ?? '—'}</div></div>
                {soloRank && <div className="ov-stat-card"><div className="ov-stat-card-label">Solo Rank</div><div className="ov-stat-card-value small" style={{ color: RANK_COLORS[scan.solo_rank] || '#e8e0d0' }}>{soloRank}</div></div>}
                {flexRank && <div className="ov-stat-card"><div className="ov-stat-card-label">Flex Rank</div><div className="ov-stat-card-value small" style={{ color: RANK_COLORS[scan.flex_rank] || '#e8e0d0' }}>{flexRank}</div></div>}
                {tftRank && <div className="ov-stat-card"><div className="ov-stat-card-label">TFT Rank</div><div className="ov-stat-card-value small" style={{ color: RANK_COLORS[scan.tft_rank] || '#e8e0d0' }}>{tftRank}</div></div>}
              </div>

              <div className="ov-overview-section">Collection</div>
              <div className="ov-overview-grid">
                {[
                  { label: 'Skins',     value: ownedSkins.length },
                  { label: 'Icons',     value: counts.icons },
                  { label: 'Chromas',   value: counts.chromas },
                  { label: 'Wards',     value: counts.wards },
                  { label: 'Emotes',    value: counts.emotes },
                  { label: 'Finishers', value: counts.finishers },
                ].map(({ label, value }) => (
                  <div key={label} className="ov-stat-card">
                    <div className="ov-stat-card-label">{label}</div>
                    <div className="ov-stat-card-value">{value}</div>
                  </div>
                ))}
              </div>

              <div className="ov-overview-section">Currency</div>
              <div className="ov-overview-grid">
                {[
                  { label: 'RP',             value: rp,             color: '#e8a020' },
                  { label: 'Blue Essence',   value: be,             color: '#5b9bd5' },
                  { label: 'Orange Essence', value: oe,             color: '#c89b3c' },
                  { label: 'Mythic Essence', value: me,             color: '#c45cc4' },
                  { label: 'Hex Chests',     value: loot.hexChests, color: '#e8e0d0' },
                  { label: 'Keys',           value: loot.hexKeys,   color: '#e8e0d0' },
                ].filter(c => c.value != null).map(({ label, value, color }) => (
                  <div key={label} className="ov-stat-card">
                    <div className="ov-stat-card-label">{label}</div>
                    <div className="ov-stat-card-value" style={{ color }}>{value?.toLocaleString() ?? '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DETAILS — owner-only info */}
          {tab === 'DETAILS' && (
            <div className="ov-overview">
              <div className="ov-overview-section">Verification Details</div>
              <p className="ov-details-note">
                These fields require additional data from the AIO Tool (timestamps &amp; sourceType on inventory items).
                They will show <strong>—</strong> until the scanner is updated to collect them.
              </p>
              <div className="ov-overview-grid">
                <div className="ov-stat-card">
                  <div className="ov-stat-card-label">Account Created</div>
                  <div className="ov-stat-card-value small" style={{ color: scan.account_created_estimate ? '#e8e0d0' : '#3c4a5c' }}>{scan.account_created_estimate ?? '—'}</div>
                  <div className="ov-stat-card-note">Oldest purchase date across all owned items</div>
                </div>
                <div className="ov-stat-card">
                  <div className="ov-stat-card-label">First RP Purchase (non-skin)</div>
                  <div className="ov-stat-card-value small" style={{ color: scan.first_rp_purchase_date ? '#e8e0d0' : '#3c4a5c' }}>{scan.first_rp_purchase_date ?? '—'}</div>
                  {(() => {
                    const id = scan.first_rp_purchase_item_id
                    const type = scan.first_rp_purchase_item_type
                    if (!id || !type) return null
                    const name = type === 'SUMMONER_ICON'
                      ? (iconMap[id]?.title || iconMap[id]?.name || null)
                      : type === 'WARD_SKIN'
                      ? (wardMap[id]?.name || null)
                      : null
                    if (!name) return null
                    return (
                      <div style={{ fontSize: 11, color: '#7b8a9e', marginTop: 2, fontFamily: 'Inter, sans-serif' }}>
                        {name} · {type === 'SUMMONER_ICON' ? 'Icon' : 'Ward'}
                      </div>
                    )
                  })()}
                </div>
              </div>

              <div className="ov-overview-section">Link Settings</div>
              <div className="ov-overview-grid">
                <div className="ov-stat-card"><div className="ov-stat-card-label">OGE</div><div className="ov-stat-card-value small" style={{ color: ogeFlag ? '#e8a020' : '#3c4a5c' }}>{ogeFlag ? 'Yes' : 'No'}</div></div>
                <div className="ov-stat-card"><div className="ov-stat-card-label">OGI</div><div className="ov-stat-card-value small" style={{ color: ogiFlag ? '#4caf50' : '#3c4a5c' }}>{ogiFlag ? (ogiVerified ? 'Verified' : ogiPartial ? 'Partial' : 'Yes') : 'No'}</div></div>
                <div className="ov-stat-card"><div className="ov-stat-card-label">Price</div><div className="ov-stat-card-value small">{priceAmount != null && priceCurrency ? `${priceCurrency} ${Number(priceAmount).toLocaleString()}` : '—'}</div></div>
                <div className="ov-stat-card"><div className="ov-stat-card-label">IGN Hidden</div><div className="ov-stat-card-value small" style={{ color: scan.hide_name ? '#e8a020' : '#5b6a7e' }}>{scan.hide_name ? 'Yes' : 'No'}</div></div>
                <div className="ov-stat-card"><div className="ov-stat-card-label">Expires</div><div className="ov-stat-card-value small">{scan.expires_at ? new Date(scan.expires_at).toLocaleDateString() : 'Never'}</div></div>
                <div className="ov-stat-card"><div className="ov-stat-card-label">Generated</div><div className="ov-stat-card-value small">{generatedDate || '—'}</div></div>
              </div>

              <div className="ov-overview-section">Links</div>
              {[
                { label: 'Owner Link (this page)', path: `/overview/${id}` },
                { label: 'Preview Link (buyer view)', path: `/preview/${id}` },
              ].map(({ label, path }) => {
                const full = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
                return (
                  <div key={path} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', background: '#111b2a', border: '1px solid rgba(200,155,60,0.12)', marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#3c4a5c', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#5b6a7e', wordBreak: 'break-all' }}>{full}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => navigator.clipboard.writeText(full)}
                        style={{ padding: '5px 10px', background: 'transparent', border: '1px solid #2a3a4a', color: '#5b6a7e', fontFamily: 'Inter, sans-serif', fontSize: 10, cursor: 'pointer', borderRadius: 3 }}>
                        Copy
                      </button>
                      <a href={path} target="_blank" rel="noreferrer"
                        style={{ padding: '5px 10px', background: '#7E655122', border: '1px solid #7E655155', color: '#c89b3c', fontFamily: 'Cinzel, serif', fontSize: 10, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', letterSpacing: 1, borderRadius: 3 }}>
                        OPEN ↗
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* MASTERY */}
          {tab === 'MASTERY' && (() => {
            const masteryData = Array.isArray(scan?.champion_mastery) ? scan.champion_mastery : []
            if (masteryData.length === 0) return <div style={{ padding: '22px 20px' }}><div className="ov-empty">No mastery data</div></div>
            const masteryColor = lvl => lvl >= 8 ? '#60a5fa' : lvl === 7 ? '#f59e0b' : lvl === 6 ? '#a855f7' : lvl === 5 ? '#0ac8b9' : '#5b6a7e'
            const sorted = [...masteryData].sort((a, b) => (b.championPoints || 0) - (a.championPoints || 0))
            const q = search.toLowerCase()
            const filtered = q ? sorted.filter(m => champMap[m.championId]?.name?.toLowerCase().includes(q)) : sorted
            if (filtered.length === 0) return <div style={{ padding: '22px 20px' }}><div className="ov-empty">No champions match search</div></div>
            return (
              <div className="ov-mastery-list">
                {filtered.map((m, i) => {
                  const champ = champMap[m.championId]
                  const lvl = m.championLevel ?? 0
                  const color = masteryColor(lvl)
                  return (
                    <div key={m.championId} className="ov-mastery-row">
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#3c4a5c', width: 22, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                      {champ?.iconUrl
                        ? <img className="ov-mastery-icon" src={champ.iconUrl} alt={champ.name} onError={e => { e.target.style.opacity = 0 }} />
                        : <div className="ov-mastery-icon" style={{ background: '#1e2a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3c4a5c', fontSize: 14 }}>?</div>
                      }
                      <span className="ov-mastery-name">{champ?.name || `Champion #${m.championId}`}</span>
                      <img src={`https://raw.communitydragon.org/latest/game/assets/ux/mastery/legendarychampionmastery/masterycrest_level${lvl}.png`} alt={`M${lvl}`} width={24} height={24} style={{ flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
                      <div className="ov-mastery-level-badge" style={{ background: color + '22', border: `1px solid ${color}55`, color }}>{lvl}</div>
                      <div className="ov-mastery-pts">{(m.championPoints || 0).toLocaleString()} pts</div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* SKINS: Border disclaimer */}
          {tab === 'SKINS' && disclaimerEnabled && (
            <div style={{ padding: '8px 20px 0', fontSize: 11, color: 'rgba(200,155,60,0.55)', fontFamily: 'Inter, sans-serif', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>⚠</span><span>{disclaimerMsg}</span>
            </div>
          )}

          {/* SKINS: champion */}
          {tab === 'SKINS' && groupBy === 'champion' && (
            championGroups.length === 0
              ? <div style={{ padding: '22px 20px' }}><div className="ov-empty">No skins found</div></div>
              : <div className="ov-skin-grid">
                  {championGroups.map(({ champId, champName, champIconUrl, owned, total, skins }) => (
                    <div key={champId} style={{ display: 'contents' }}>
                      <GroupHeader name={champName} count={owned} total={total} complete={owned >= total} iconUrl={champIconUrl} />
                      {skins.map(skin => {
                        const ownedChromas = (skin.chromas || []).filter(c => ownedChromaSet.has(c.id))
                        return <SkinCard key={skin.id} skin={skin} champName={champName} chromaCount={ownedChromas.length} isVintage={vintageSkinSet.has(skin.id)} onClick={() => setSelected({ skin, ownedChromas })} />
                      })}
                    </div>
                  ))}
                </div>
          )}

          {/* SKINS: tier */}
          {tab === 'SKINS' && groupBy === 'tier' && (
            tierGroups.length === 0
              ? <div style={{ padding: '22px 20px' }}><div className="ov-empty">No skins found</div></div>
              : <div className="ov-skin-grid">
                  {tierGroups.map(({ rarity, skins }) => (
                    <div key={rarity} style={{ display: 'contents' }}>
                      <GroupHeader name={RARITY_LABEL[rarity]} count={skins.length} />
                      {skins.map(skin => {
                        const cid = Math.floor(skin.id / 1000)
                        const ownedChromas = (skin.chromas || []).filter(c => ownedChromaSet.has(c.id))
                        return <SkinCard key={skin.id} skin={skin} champName={champMap[cid]?.name || ''} chromaCount={ownedChromas.length} isVintage={vintageSkinSet.has(skin.id)} onClick={() => setSelected({ skin, ownedChromas })} />
                      })}
                    </div>
                  ))}
                </div>
          )}

          {/* EMOTES */}
          {tab === 'EMOTES' && (
            ownedEmotes.length === 0
              ? <div style={{ padding: '22px 20px' }}><div className="ov-empty">No emotes</div></div>
              : <div className="ov-item-grid">
                  {ownedEmotes.filter(e => !search || e.name?.toLowerCase().includes(search.toLowerCase())).map(e => (
                    <ItemCard key={e.id} imgSrc={cdnUrl(e.inventoryIcon || e.iconPath)} name={e.name} />
                  ))}
                </div>
          )}

          {/* ICONS */}
          {tab === 'ICONS' && (
            ownedIcons.length === 0
              ? <div style={{ padding: '22px 20px' }}><div className="ov-empty">No icons</div></div>
              : <div className="ov-item-grid">
                  {ownedIcons.filter(i => !search || i.title?.toLowerCase().includes(search.toLowerCase())).map(i => (
                    <ItemCard key={i.id} imgSrc={cdnUrl(i.imagePath)} name={i.title} />
                  ))}
                </div>
          )}

          {/* WARDS */}
          {tab === 'WARDS' && (
            ownedWards.length === 0
              ? <div style={{ padding: '22px 20px' }}><div className="ov-empty">No wards</div></div>
              : <div className="ov-item-grid">
                  {ownedWards.filter(w => !search || w.name?.toLowerCase().includes(search.toLowerCase())).map(w => (
                    <ItemCard key={w.id} imgSrc={cdnUrl(w.wardImagePath)} name={w.name} />
                  ))}
                </div>
          )}

          {/* CHROMAS */}
          {tab === 'CHROMAS' && (
            chromaSkins.length === 0
              ? <div style={{ padding: '22px 20px' }}><div className="ov-empty">No chromas owned</div></div>
              : <div style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 26 }}>
                  {chromaSkins.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase())).map(skin => {
                    const ownedChromas = (skin.chromas || []).filter(c => ownedChromaSet.has(c.id))
                    return (
                      <div key={skin.id}>
                        <div className="ov-loot-cat-header" style={{ marginBottom: 10 }}>
                          <img src={cdnUrl(skin.tilePath)} alt="" width={16} height={16} style={{ objectFit: 'cover', borderRadius: 1 }} onError={e => { e.target.style.display = 'none' }} />
                          {skin.name}
                          <span style={{ color: '#0ac8b9', fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600 }}>({ownedChromas.length}/{skin.chromas?.length})</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {skin.chromas.map(c => {
                            const owned = ownedChromaSet.has(c.id)
                            return (
                              <div key={c.id} className="ov-chroma-card" style={{ opacity: owned ? 1 : 0.25, borderColor: owned ? 'rgba(200,155,60,0.3)' : 'rgba(30,42,58,0.8)' }}>
                                <div className="ov-chroma-img-wrap">
                                  <img className="ov-chroma-img" src={cdnUrl(c.chromaPath)} alt="" loading="lazy" onError={e => { e.target.style.background = c.colors?.[0] || '#1e2a3a'; e.target.style.opacity = 0 }} />
                                </div>
                                <div className="ov-chroma-name">{skin.name}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
          )}

          {/* FINISHERS */}
          {tab === 'FINISHERS' && (
            (scan?.owned_finisher_ids || []).length === 0
              ? <div style={{ padding: '22px 20px' }}><div className="ov-empty">No finishers</div></div>
              : <div className="ov-item-grid">
                  {(scan?.owned_finisher_ids || []).filter(fid => !search || finMap[fid]?.name?.toLowerCase().includes(search.toLowerCase())).map(fid => {
                    const item = finMap[fid]
                    return <ItemCard key={fid} imgSrc={item?.iconPath ? cdnUrl(item.iconPath) : null} name={item?.name || `Finisher #${fid}`} />
                  })}
                </div>
          )}

          {/* LOOT */}
          {tab === 'LOOT' && (() => {
            const LOOT_SKIP = new Set(['CURRENCY_cosmetic', 'CURRENCY_mythic'])
            const CATS = [
              { key: 'champion',   label: 'Champion Shards',      test: id => id.startsWith('CHAMPION_RENTAL_') },
              { key: 'skin_perm',  label: 'Skin Permanents',      test: id => id.startsWith('CHAMPION_SKIN_') && !id.includes('RENTAL') },
              { key: 'skin_shard', label: 'Skin Shards',          test: id => id.startsWith('SKIN_RENTAL_') || id.startsWith('CHAMPION_SKIN_RENTAL_') },
              { key: 'emote',      label: 'Emotes / Shards',      test: id => id.startsWith('EMOTE_') },
              { key: 'ward',       label: 'Ward Skins / Shards',  test: id => id.startsWith('WARD_SKIN_') },
              { key: 'icon',       label: 'Icons / Shards',       test: id => id.startsWith('SUMMONER_ICON_') },
              { key: 'eternal',    label: 'Eternals',             test: id => id.startsWith('STATSTONE_') },
              { key: 'material',   label: 'Materials',            test: id => id.startsWith('MATERIAL_') },
              { key: 'chest',      label: 'Chests & Capsules',    test: id => id.startsWith('CHEST_') },
              { key: 'other',      label: 'Other',                test: () => true },
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
              let name = item.localizedName || null, imgSrc = null, accent = null
              if (lootId.startsWith('CHAMPION_RENTAL_')) { const ch = champMap[parseInt(lootId.slice('CHAMPION_RENTAL_'.length))]; if (!name && ch?.name) name = ch.name + ' Shard'; if (ch?.iconUrl) imgSrc = ch.iconUrl }
              else if (lootId.startsWith('CHAMPION_SKIN_') && !lootId.includes('RENTAL')) { const s = catalogs.skins?.[parseInt(lootId.slice('CHAMPION_SKIN_'.length))]; if (!name && s?.name) name = s.name; if (s?.tilePath) imgSrc = cdnUrl(s.tilePath); accent = '#e08c20' }
              else if (lootId.startsWith('SKIN_RENTAL_') || lootId.startsWith('CHAMPION_SKIN_RENTAL_')) { const sid = lootId.startsWith('SKIN_RENTAL_') ? lootId.slice('SKIN_RENTAL_'.length) : lootId.slice('CHAMPION_SKIN_RENTAL_'.length); const s = catalogs.skins?.[parseInt(sid)]; if (!name && s?.name) name = s.name + ' Shard'; if (s?.tilePath) imgSrc = cdnUrl(s.tilePath); accent = '#4a90d9' }
              else if (lootId.startsWith('EMOTE_RENTAL_')) { const parsedId = parseInt(lootId.slice('EMOTE_RENTAL_'.length)); const lookupId = item.storeItemId > 0 ? item.storeItemId : parsedId; const e = emoteMap[lookupId] || emoteMap[parsedId]; if (!name && e?.name) name = e.name + ' Shard'; if (e?.inventoryIcon || e?.iconPath) imgSrc = cdnUrl(e.inventoryIcon || e.iconPath); accent = '#4a90d9' }
              else if (lootId.startsWith('EMOTE_')) { const parsedId = parseInt(lootId.slice('EMOTE_'.length)); const lookupId = item.storeItemId > 0 ? item.storeItemId : parsedId; const e = emoteMap[lookupId] || emoteMap[parsedId]; if (!name && e?.name) name = e.name; if (e?.inventoryIcon || e?.iconPath) imgSrc = cdnUrl(e.inventoryIcon || e.iconPath) }
              else if (lootId.startsWith('WARD_SKIN_RENTAL_')) { const parsedId = parseInt(lootId.slice('WARD_SKIN_RENTAL_'.length)); const w = wardMap[item.storeItemId > 0 ? item.storeItemId : parsedId] || wardMap[parsedId]; if (!name && w?.name) name = w.name + ' Shard'; if (w?.wardImagePath) imgSrc = cdnUrl(w.wardImagePath); accent = '#4a90d9' }
              else if (lootId.startsWith('WARD_SKIN_')) { const parsedId = parseInt(lootId.slice('WARD_SKIN_'.length)); const w = wardMap[item.storeItemId > 0 ? item.storeItemId : parsedId] || wardMap[parsedId]; if (!name && w?.name) name = w.name; if (w?.wardImagePath) imgSrc = cdnUrl(w.wardImagePath) }
              else if (lootId.startsWith('SUMMONER_ICON_RENTAL_')) { const parsedId = parseInt(lootId.slice('SUMMONER_ICON_RENTAL_'.length)); const ic = iconMap[item.storeItemId > 0 ? item.storeItemId : parsedId] || iconMap[parsedId]; if (!name && (ic?.title || ic?.name)) name = (ic.title || ic.name) + ' Shard'; if (ic?.imagePath) imgSrc = cdnUrl(ic.imagePath); accent = '#4a90d9' }
              else if (lootId.startsWith('SUMMONER_ICON_')) { const parsedId = parseInt(lootId.slice('SUMMONER_ICON_'.length)); const ic = iconMap[item.storeItemId > 0 ? item.storeItemId : parsedId] || iconMap[parsedId]; if (!name && (ic?.title || ic?.name)) name = ic.title || ic.name; if (ic?.imagePath) imgSrc = cdnUrl(ic.imagePath) }
              else if (lootId === 'MATERIAL_key_fragment') { name = 'Key Fragment' }
              name = name || lootId
              if (q && !name.toLowerCase().includes(q)) continue
              const cat = CATS.find(c => c.test(lootId))
              buckets[cat.key].push({ lootId, item, name, imgSrc, accent })
            }
            const filled = CATS.filter(c => buckets[c.key].length > 0)
            if (filled.length === 0) return <div style={{ padding: '22px 20px' }}><div className="ov-empty">No loot data</div></div>
            return (
              <div className="ov-loot-section">
                {filled.map(cat => (
                  <div key={cat.key}>
                    <div className="ov-loot-cat-header">
                      {cat.label}
                      <span style={{ color: '#0ac8b9', fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600 }}>({buckets[cat.key].reduce((s, x) => s + x.item.count, 0)})</span>
                    </div>
                    <div className="ov-loot-cat-grid">
                      {buckets[cat.key].sort((a, b) => a.name.localeCompare(b.name)).map(({ lootId, item, name, imgSrc, accent }) => (
                        <LootCard key={lootId} imgSrc={imgSrc} name={name} count={item.count} accent={accent} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* TFT */}
          {tab === 'TFT' && (() => {
            const total = counts.tftCompanions + counts.tftMapSkins + counts.tftDamageSkins
            if (total === 0) return <div style={{ padding: '22px 20px' }}><div className="ov-empty">No TFT cosmetics data</div></div>
            const tftSearch = search.toLowerCase()
            return (
              <div style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                {counts.tftCompanions > 0 && (
                  <div>
                    <div className="ov-overview-section" style={{ marginBottom: 12 }}>Little Legends ({counts.tftCompanions})</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 11 }}>
                      {(scan.tft_companion_ids || []).map(cid => { const item = compMap[cid]; const name = item?.name || `Little Legend #${cid}`; if (tftSearch && !name.toLowerCase().includes(tftSearch)) return null; return <ItemCard key={cid} imgSrc={item?.iconPath ? resolveUrl(item.iconPath) : null} name={name} /> })}
                    </div>
                  </div>
                )}
                {counts.tftMapSkins > 0 && (
                  <div>
                    <div className="ov-overview-section" style={{ marginBottom: 12 }}>Arenas ({counts.tftMapSkins})</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 11 }}>
                      {(scan.tft_map_skin_ids || []).map(amid => { const item = arenaMap[amid]; const name = item?.name || `Arena #${amid}`; if (tftSearch && !name.toLowerCase().includes(tftSearch)) return null; return <ItemCard key={amid} imgSrc={item?.iconPath ? resolveUrl(item.iconPath) : null} name={name} /> })}
                    </div>
                  </div>
                )}
                {counts.tftDamageSkins > 0 && (
                  <div>
                    <div className="ov-overview-section" style={{ marginBottom: 12 }}>Booms ({counts.tftDamageSkins})</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 11 }}>
                      {(scan.tft_damage_skin_ids || []).map(did => { const item = boomMap[did]; const name = item?.name || `Boom #${did}`; if (tftSearch && !name.toLowerCase().includes(tftSearch)) return null; return <ItemCard key={did} imgSrc={item?.iconPath ? resolveUrl(item.iconPath) : null} name={name} /> })}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

        </main>
      </div>

      {/* Skin Detail Modal */}
      {selected && (
        <div className="ov-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="ov-modal" onClick={e => e.stopPropagation()}
            style={{ boxShadow: `0 0 50px ${RARITY_GLOW[selected.skin.rarity] || 'transparent'}` }}>
            <button className="ov-modal-close" onClick={() => setSelected(null)}>✕</button>
            <img className="ov-modal-splash" src={cdnUrl(selected.skin.uncenteredSplashPath || selected.skin.splashPath)} alt={selected.skin.name} onError={e => { e.target.src = cdnUrl(selected.skin.tilePath) }} />
            <div className="ov-modal-info">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#7b8a9e', marginBottom: 3 }}>{champMap[Math.floor(selected.skin.id / 1000)]?.name || ''}</p>
                  <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 18, fontWeight: 700, color: '#e8e0d0', letterSpacing: '0.02em' }}>{selected.skin.name}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <img src={GEM_SRC[selected.skin.rarity]} alt="" width={15} height={15} />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#c89b3c', letterSpacing: 2 }}>{RARITY_LABEL[selected.skin.rarity]}</span>
                    {selected.skin.isLegacy && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#c89b3c', border: '1px solid rgba(200,155,60,0.4)', padding: '1px 5px', letterSpacing: 1 }}>LEGACY</span>}
                  </div>
                </div>
              </div>
              {selected.ownedChromas.length > 0 && (
                <div style={{ marginTop: 13 }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#7b8a9e', letterSpacing: 2, marginBottom: 8 }}>CHROMAS — {selected.ownedChromas.length} OF {selected.skin.chromas?.length} OWNED</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selected.skin.chromas.map(c => {
                      const owned = ownedChromaSet.has(c.id)
                      return (
                        <div key={c.id} style={{ opacity: owned ? 1 : 0.2, border: `2px solid ${owned ? '#c89b3c' : '#1e2a3a'}` }}>
                          <img src={cdnUrl(c.chromaPath)} alt="" width={38} height={38} style={{ display: 'block', objectFit: 'cover' }} onError={e => { e.target.style.background = c.colors?.[0] || '#333'; e.target.style.width = '38px'; e.target.style.height = '38px' }} />
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

export default function OverviewPage() {
  return (
    <Suspense>
      <OverviewPageInner />
    </Suspense>
  )
}
