-- CSR2 Redemption Flow v2 — Phase A schema. Run this once in the Supabase SQL editor
-- (after 002-005). See the approved plan for the full feature list this backs.
--
-- Manual step this migration depends on (not SQL): create a Storage bucket named
-- 'csr2-screenshots', public read, write restricted to the service role — this is
-- where GameCenter/sign-in-approval/completion screenshots get uploaded.

-- ── csr2_codes: replace the boolean used_at gate with a real status, so a code can
-- sit "in progress" (locked, not yet consumed) and "partial" (some balance claimed,
-- some still redeemable later) instead of only unused/used. ───────────────────────
alter table csr2_codes add column if not exists status text not null default 'unused';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'csr2_codes_status_check'
  ) then
    alter table csr2_codes add constraint csr2_codes_status_check
      check (status in ('unused', 'in_progress', 'partial', 'used'));
  end if;
end $$;
-- Backfill: any code already used_at-set is 'used'; everything else starts 'unused'.
update csr2_codes set status = 'used' where used_at is not null and status = 'unused';

alter table csr2_codes add column if not exists platform_tag text;

-- ── csr2_jobs: new branches/steps from the spec (account mode, screenshot confirms,
-- safe-mode delivery, car selection, free-unban, feedback/review rewards). ─────────
alter table csr2_jobs add column if not exists account_mode text;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'csr2_jobs_account_mode_check'
  ) then
    alter table csr2_jobs add constraint csr2_jobs_account_mode_check
      check (account_mode is null or account_mode in ('existing', 'new'));
  end if;
end $$;

alter table csr2_jobs add column if not exists gamecenter_screenshot_url text;
alter table csr2_jobs add column if not exists signin_approval_screenshot_url text;
alter table csr2_jobs add column if not exists completion_screenshot_url text;
alter table csr2_jobs add column if not exists safe_mode boolean not null default false;
alter table csr2_jobs add column if not exists car_selection jsonb;
alter table csr2_jobs add column if not exists account_banned boolean;
alter table csr2_jobs add column if not exists feedback_text text;
alter table csr2_jobs add column if not exists feedback_rewarded boolean not null default false;
alter table csr2_jobs add column if not exists review_submitted boolean not null default false;

-- Extend the status check constraint (same drop-by-lookup pattern as 005) to add the
-- new mid-flow steps: screenshot confirms (iOS GameCenter / Android sign-in approval)
-- and the ban-risk delivery decision. 'needs_new_account' is a terminal dead-end for
-- buyers who don't have an existing account yet (see app/csr2-redeem/page.js §3).
do $$
declare
  conname text;
begin
  select con.conname into conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'csr2_jobs' and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%status%'
    and pg_get_constraintdef(con.oid) not like '%account_mode%';
  if conname is not null then
    execute format('alter table csr2_jobs drop constraint %I', conname);
  end if;
end $$;

alter table csr2_jobs add constraint csr2_jobs_status_check check (status in (
  'awaiting_credentials', 'logging_in', 'bad_password', 'awaiting_2fa', 'bad_code',
  'awaiting_gamecenter_confirm', 'awaiting_signin_approval',
  'launching_game', 'awaiting_save_load', 'awaiting_account_confirm',
  'awaiting_risk_decision', 'editing_save', 'awaiting_relaunch', 'saving',
  'needs_new_account', 'done', 'error'
));

-- ── Ledger backing "remaining balance, redeemable later, by whom/when" (safe-mode
-- half, free-unban hold-back, combo-pack refill tiers — spec §8/§11/§12). ─────────
create table if not exists csr2_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references csr2_codes(id),
  job_id uuid references csr2_jobs(id),
  platform text not null check (platform in ('ios', 'android')),
  account_last4 text,
  kind text not null check (kind in ('full', 'safe_half', 'unban_only', 'refill')),
  currencies_delivered jsonb,
  cars_delivered jsonb,
  remaining_currencies jsonb,
  redeemed_at timestamptz not null default now()
);
alter table csr2_code_redemptions disable row level security;
create index if not exists csr2_code_redemptions_code_idx on csr2_code_redemptions (code_id, redeemed_at);

-- ── Buyer-submitted error reports (spec §2 "Report an error"). Review workflow TBD —
-- this table only backs capture, not triage. ──────────────────────────────────────
create table if not exists csr2_error_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references csr2_jobs(id),
  code_id uuid references csr2_codes(id),
  message text not null,
  screenshot_url text,
  created_at timestamptz not null default now()
);
alter table csr2_error_reports disable row level security;

-- ── Post-mod feedback/review rewards (spec §7): a reward earned now, redeemable on
-- a later visit the same way a ledger remainder is — not a one-off boolean flag. ───
create table if not exists csr2_rewards (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references csr2_jobs(id),
  kind text not null check (kind in ('feedback', 'review')),
  granted_at timestamptz not null default now(),
  redeemed boolean not null default false,
  redeemed_at timestamptz
);
alter table csr2_rewards disable row level security;

-- Note: csr2_packs.data gains optional freeUnban / comboRefill keys — no schema
-- change needed there, it's jsonb (see app/api/csr2/packs/route.js).
