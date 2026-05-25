# Vault Admin — Claude Instructions

## CRITICAL: Before touching any file, read its current state first. Never overwrite from memory.

---

## Project Overview

Next.js webapp for managing League of Legends accounts for resale. Deployed on Vercel. Uses Supabase for data storage. Preview links served at `lolprev.site`.

---

## Key Files & What They Do

### `app/components/Accounts.js`
The main and most complex component. Contains:
- **Checker flow** (steps 0–5): ping → game select → scan → results → save → success
- `EXPECTED_SCANNER_VERSION = '0.6.0'` — blocks scan if tool version doesn't match
- `handleScan`: version check, retry loop (5s gaps, 60s max, cancel after 20s)
- `handleOpenAdd(prefillFields, prefillSoldFor, prefillSoldForCurrency)`: closes checker modal, opens account form
- `pendingScanDataRef`: ref that snapshots scanData before checker modal closes, used in handleSave
- `handleSave`: saves account, then creates lol_skin_scans record using pendingScanDataRef, stores `_scanId` + `_scanOwnerToken` in account fields
- Step 5: success state showing Preview Link (Open/Copy) + Owner Link (Open/Copy with warning modal)
- Account cards: Copy Link button (top-right of image) when `account.fields._scanId` exists
- Account detail view (eye button): Preview Link row appears at TOP of scrollable section (before custom fields), highlighted in amber
- Download link: `/aio-tool-v0.6.0.exe`

### `app/api/accounts/[id]/route.js`
PUT + DELETE for individual accounts. Standard Supabase update/delete.

### `app/api/lol-skins/route.js`
- POST: creates lol_skin_scans record. Accepts `thumbnailUrl` and `accountTitle` fields. Returns `{ id, owner_token }`.
- GET: fetches scan by id (checks expiry)
- PATCH: updates scan settings (hideName, oge, ogi, priceAmount, etc.)

### `app/api/og/lol/[id]/route.js`
- Imports from `next/og` (NOT `@vercel/og`) — runs in Node.js runtime, NOT edge
- Fetches scan including `thumbnail_url` and `account_title`
- Renders styled dark image: profile icon, rank, skin count, top 6 skin tiles
- Overlays `thumbnail_url` image (right side, 18% opacity) if present

### `app/preview/lol/[id]/layout.js`
- Server component (no 'use client') — generates OG metadata for Discord/Twitter embeds
- Imports supabase from `../../../lib/supabase` (3 levels up)
- Builds title from `account_title` → summoner name fallback
- Builds description from skin count, rank, region

### `app/page.js`
- `addAccount` returns the saved account object (needed for post-save scan linking)

### `tools/vault-scanner/index.js`
- VERSION = `'0.6.0'`
- Serves HTTP on port 35199
- `/scan` endpoint: scans LoL account via LCU API
- `/local/accounts` GET/POST: local account CRUD (stored in %APPDATA%/aio-tool/accounts.json)
- `/local/accounts/:id` PATCH/DELETE
- `/local/config` GET/POST: webapp URL config
- `/` GET: serves full HTML UI
- On startup: launches `msedge --app="http://localhost:35199"` for native-looking window (falls back to default browser)

### `tools/vault-scanner/package.json`
- Build output: `aio-tool-v0.6.0.exe`

### `public/aio-tool-v0.6.0.exe`
- Latest compiled tool. Always copy here after building.

---

## Tool UI (served at localhost:35199)

Dark-themed single-page app with:
- Left sidebar: Games panel (currently just League of Legends)
- Main area: grid of locally stored account cards
- Add Account modal: Scan Only / Login & Scan modes, scan flow, Save Account
- Import to Webapp: POSTs scan data to `{webappUrl}/api/lol-skins`, opens webapp
- Settings modal: configure webapp URL
- Accounts persist locally in `%APPDATA%\aio-tool\accounts.json`

---

## DB Tables (Supabase)

- `accounts` — main account records
- `lol_skin_scans` — scan data. Has columns: `id, owner_token, summoner_name, tag_line, region, profile_icon_id, summoner_level, solo_rank, flex_rank, solo_peak_rank, solo_prev_rank, rp, be, owned_skin_ids, loot_summary, rank_history, champ_count, owned_chroma_ids, owned_emote_ids, owned_icon_ids, champion_mastery, expires_at, hide_name, oge, ogi, ogi_partial, ogi_verified, price_amount, price_currency, last_match, thumbnail_url, account_title`
- `game_section_configs` — per-game config (custom fields, title templates, etc.)
- `platforms` — platform definitions
- `games` — game definitions

**Required migration (user must run if not done):**
```sql
ALTER TABLE lol_skin_scans ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE lol_skin_scans ADD COLUMN IF NOT EXISTS account_title TEXT;
```

---

## Preview URLs

All preview links use `https://lolprev.site/preview/lol/{id}` — never `window.location.origin` or relative paths.

---

## Version Bump Checklist (when updating scanner tool)

**CRITICAL: All 6 steps are required. Do NOT skip steps 5–6 or the webapp will show the wrong version.**

1. Bump `VERSION` in `tools/vault-scanner/index.js`
2. Update `--output` name in `tools/vault-scanner/package.json` to match new version
3. `npm run build` inside `tools/vault-scanner/`
4. Copy exe to `public/aio-tool-vX.X.XX.exe` (versioned filename, not a generic name)
5. **Update `EXPECTED_SCANNER_VERSION` in `Accounts.js` (line ~27)**
6. **Update hardcoded `href` + `download` attr + label in `Accounts.js` (search `aio-tool-v`)**

---

## Sidebar

Orders, Offers, Services, Tools are temporarily disabled in `app/components/Sidebar.js`.

---

## What NOT to do

- Do NOT use `@vercel/og` in the OG image route — use `next/og` (edge runtime breaks Supabase client)
- Do NOT use `window.location.origin` for preview links — always hardcode `lolprev.site`
- Do NOT remove `pendingScanDataRef` logic — it's how scan data survives the checker modal closing
- Do NOT use `mapCheckerToFields()` or `CHECKER_KEY_MAP` — they are dead code, never called
- Do NOT read from `game_configs` table — it doesn't exist, use `game_section_configs`
