-- Stores the plaintext code alongside its hash so the AIO Tool's Codes view
-- can show/copy still-unredeemed codes later. Deliberate tradeoff (see CLAUDE.md):
-- a DB breach now exposes unused codes directly, not just their hashes.
-- Run this once in the Supabase SQL editor (after 002/003).
alter table csr2_codes add column if not exists plaintext_code text;
