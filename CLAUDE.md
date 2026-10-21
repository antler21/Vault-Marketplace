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
- `EXPECTED_SCANNER_VERSION = '0.7.34'` — blocks scan if tool version doesn't match
- `handleScan`: version check, retry loop (5s gaps, 60s max, cancel after 20s)
- `handleOpenAdd(prefillFields, prefillSoldFor, prefillSoldForCurrency)`: closes checker modal, opens account form
- `pendingScanDataRef`: ref that snapshots scanData before checker modal closes, used in handleSave
- `handleSave`: saves account, then creates lol_skin_scans record using pendingScanDataRef, stores `_scanId` + `_scanOwnerToken` in account fields
- Step 5: success state showing Preview Link (Open/Copy) + Owner Link (Open/Copy with warning modal)
- Account cards: Copy Link button (top-right of image) when `account.fields._scanId` exists
- Account detail view (eye button): Preview Link row appears at TOP of scrollable section (before custom fields), highlighted in amber
- Download link: `/aio-tool-v0.7.34.exe`

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
- VERSION = `'0.7.34'`
- Serves HTTP on port 35199
- `/scan` endpoint: scans LoL account via LCU API
- `/local/accounts` GET/POST: local account CRUD (stored in %APPDATA%/aio-tool/accounts.json)
- `/local/accounts/:id` PATCH/DELETE
- `/local/config` GET/POST: webapp URL config
- `/` GET: serves full HTML UI
- On startup: launches `msedge --app="http://localhost:35199"` for native-looking window (falls back to default browser)

### `tools/vault-scanner/package.json`
- Build output: `aio-tool-v0.7.34.exe`

### `public/aio-tool-v0.7.34.exe`
- Latest compiled tool. Always copy here after building.

### `app/csr2-redeem/page.js`
- Customer-facing redeem flow (separate from the older order-ID-based `app/csr2/page.js`): code → pack preview → platform (iOS only; Android shows a disabled "WIP" badge) → email/password → polls job status.
- Status→text mapping lives in `STATUS_TEXT`; `bad_password`/`awaiting_2fa`/`bad_code`/`done`/`error` get dedicated UI instead of a generic loading line.
- Polls `GET /api/csr2/jobs/[id]` every 2.5s while `step === 'status'`; stops on `done`/`error`.
- "Resend Code" currently only clears the input client-side — there's no backend resend trigger yet (the real 2FA resend happens on the device/account side, driven by the worker).

### `app/api/csr2/redeem/route.js`
- POST: hashes the submitted code, looks up `csr2_codes`, 404 if not found, 409 if `used_at` already set.
- Claims the code via a single `UPDATE ... WHERE used_at IS NULL` (atomic — no separate transaction needed), then resolves and returns the pack from `csr2_packs` server-side. Client never picks the pack.
- Rate-limited 5/min/IP via `csr2RateLimit.js` (backed by `csr2_redeem_attempts`, not in-memory, since Vercel instances don't share memory).

### `app/api/csr2/jobs/route.js` + `app/api/csr2/jobs/[id]/route.js`
- POST `/jobs`: creates a `csr2_jobs` row (`status: 'awaiting_credentials'`) from an already-redeemed `codeId`. One job per code — retrying returns the existing job id instead of creating a duplicate. Rejects any platform other than `'ios'` (Android is WIP).
- GET `/jobs/[id]`: polled by the frontend. Only ever selects `id, platform, status, error_message, created_at, updated_at` — **never** `password_enc`/`twofa_code`, even encrypted.
- PATCH `/jobs/[id]`: frontend submits `{ email, password }` (only while `status === 'awaiting_credentials'`) or `{ twofaCode }` (only while `status === 'awaiting_2fa'`). Encrypts via `csr2Crypto.js` before writing. Does **not** change `status` — status transitions belong exclusively to the worker.

### `app/api/csr2/worker/claim/route.js` + `app/api/csr2/worker/jobs/[id]/route.js`
- Bearer-token auth only (`CSR2_WORKER_TOKEN`), checked inside the route — deliberately not a Supabase session, so the customer's browser can never call these even though `/api/csr2` is a public middleware prefix.
- GET `/claim`: returns the oldest job that's either `awaiting_credentials` with `password_enc` set, or `awaiting_2fa` with `twofa_code` set. Claiming the credentials case atomically flips `status → logging_in` and nulls `password_enc` in the same update (the row returned in the response still has the original encrypted value for the worker to decrypt). Claiming the 2FA case nulls `twofa_code` but leaves `status` alone — the worker reports the outcome itself.
- PATCH `/jobs/[id]`: worker-driven status updates. Auto-nulls `password_enc` on entering `logging_in`, auto-nulls `twofa_code` on leaving `awaiting_2fa`, sets/clears `error_message`.

### `app/api/csr2/codes/route.js`
- **Admin-only** via `app/lib/requireAdmin.js`'s `isAdminAuthed()` — either a logged-in Supabase session OR the AIO Tool's `CSR2_ADMIN_TOKEN` bearer token (since `/api/csr2` is a public middleware prefix for the customer flow, this route can't rely on middleware).
- POST: body `{ packName, count }`, generates `count` codes (5 chars, Crockford base32 — see `app/lib/csr2Codes.js`), stores both the SHA-256 hash AND the plaintext (`plaintext_code` column) and returns the plaintext codes. Retries per-code on a hash collision (`error.code === '23505'`) instead of failing the whole batch — the 5-char keyspace is small enough (~33M) that collisions aren't negligible over the product's lifetime.
- GET: `?packName=X` (optional) lists codes with `plaintext_code`, `pack_name`, `created_at`, `used_at` — used by the AIO Tool's Codes modal for the available/used history view.
- Admin UI lives in the **AIO Tool** (`tools/vault-scanner/index.js`), not the webapp — see below.

### `tools/vault-scanner/index.js` — CSR2 Codes UI
- "🎫 Codes" button in the CSR2 Services panel header (opens unfiltered) and a per-pack-card corner button (`ck-codes`, opens pre-filtered to that pack) both call `openCodes(packName)`.
- The Codes modal's generate/list actions hit the TOOL's own local `GET`/`POST /csr2/codes` — these are server-side proxy routes (`fetchWebappApi()` helper) that forward to the webapp's `/api/csr2/codes` with the admin token attached server-side. The browser-side JS in the tool never sees the token.
- `csr2AdminToken` is a CSR2 Settings field, persisted via `/local/config` like the other CSR2 folder settings. Must match the webapp's `CSR2_ADMIN_TOKEN` env var.
- `fetchWebappApi()` picks `http`/`https` based on the configured `webappUrl`'s protocol — don't hardcode `https` here, `webappUrl` can be `http://localhost:3000` during local testing.

### `app/lib/csr2Crypto.js`
- **Encrypt-only.** The webapp only ever holds `CSR2_CRED_PUBLIC_KEY` (an RSA public key) — it can lock credentials away but can never read them back. Only the local Python worker holds the matching private key and can decrypt.
- Hybrid RSA-OAEP(SHA-256) + AES-256-GCM envelope: one-time AES key encrypts the plaintext, the AES key itself is sealed with RSA. Blob stored as JSON text: `{ v, ek, iv, tag, ct }`.
- Keypair generated once via `scripts/csr2-gen-worker-keypair.js` — private key goes ONLY in the local worker's config, public key goes in Vercel's `CSR2_CRED_PUBLIC_KEY`.

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
- `csr2_codes` — redeemable codes. `id, code_hash (sha256, unique), plaintext_code, pack_name (FK csr2_packs.name), created_at, used_at, used_by_job_id`. Codes are short (5 chars) by design — `plaintext_code` is stored (not just the hash) so the AIO Tool's Codes view can show/copy still-unredeemed codes; see migration 004 for the tradeoff this accepts.
- `csr2_jobs` — one per redeemed code. `id, code_id (FK), platform ('ios'|'android'), status (enum, see `app/api/csr2/worker/jobs/[id]/route.js` for the full list), email, password_enc, twofa_code, error_message, created_at, updated_at`. `password_enc`/`twofa_code` are encrypted blobs (see `app/lib/csr2Crypto.js`), nulled out once consumed.
- `csr2_redeem_attempts` — rate-limit log for `/api/csr2/redeem`. `id, ip, attempted_at`.

**Required migration (user must run if not done):**
```sql
ALTER TABLE lol_skin_scans ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE lol_skin_scans ADD COLUMN IF NOT EXISTS account_title TEXT;
```
See `supabase/migrations/002_csr2_redeem.sql` for the `csr2_codes` / `csr2_jobs` / `csr2_redeem_attempts` migration, `003_csr2_redeem_rate_limit.sql` for the global rate-limit `success` column, and `004_csr2_codes_plaintext.sql` for the `plaintext_code` column — run each in the Supabase SQL editor.

---

## Preview URLs

All preview links use `https://lolprev.site/preview/lol/{id}` — never `window.location.origin` or relative paths.

---

## CSR2 Redeem — Env Vars

- `CSR2_CRED_PUBLIC_KEY` (Vercel env var) — RSA public key, PEM format. Generate the pair with `node scripts/csr2-gen-worker-keypair.js`; only the public half goes here.
- `CSR2_WORKER_TOKEN` (Vercel env var) — static bearer token the local Python worker sends as `Authorization: Bearer <token>` to `/api/csr2/worker/*`. Not a Supabase session — just a shared secret.
- `CSR2_ADMIN_TOKEN` (Vercel env var) — static bearer token the AIO Tool sends to `/api/csr2/codes` for codegen/listing. Deliberately a separate secret from `CSR2_WORKER_TOKEN` (different capability, least-privilege). Must match the AIO Tool's `csr2AdminToken` setting (CSR2 Settings modal).
- The RSA **private** key (other half of `CSR2_CRED_PUBLIC_KEY`) is NOT a webapp env var at all — it lives only in the local worker's own config, on the PC that runs it.

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
- Do NOT add a decrypt function anywhere in the webapp for CSR2 job credentials — `app/lib/csr2Crypto.js` is encrypt-only by design; only the local Python worker (holding the RSA private key) decrypts
- Do NOT select `password_enc` or `twofa_code` in any route the browser can poll (`GET /api/csr2/jobs/[id]`) — even the ciphertext should never reach the browser
- Do NOT put `CSR2_CRED_PUBLIC_KEY`'s private half anywhere in this repo or in Vercel env vars — it lives only in the local worker's config
- Do NOT name a new public CSR2 page/route starting with `/csr2` casually without checking `middleware.js` — `PUBLIC_PREFIXES` does prefix matching, so e.g. `/csr2-admin` is NOT covered by `/csr2` (good, stays behind login) but anything under `/csr2/...` or `/api/csr2/...` IS public by default
