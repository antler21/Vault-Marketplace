-- CSR2 redeem-code + job-queue feature. Run this once in the Supabase SQL editor.
-- RLS is left disabled to match every other table in this project — access control
-- happens in the Next.js API routes (session check, worker bearer token), not in Postgres.

create table if not exists csr2_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  pack_name text not null references csr2_packs(name),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by_job_id uuid
);
alter table csr2_codes disable row level security;

create table if not exists csr2_jobs (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references csr2_codes(id),
  platform text not null check (platform in ('ios', 'android')),
  status text not null default 'awaiting_credentials' check (status in (
    'awaiting_credentials', 'logging_in', 'bad_password', 'awaiting_2fa', 'bad_code',
    'launching_game', 'awaiting_save_load', 'editing_save', 'awaiting_relaunch',
    'saving', 'done', 'error'
  )),
  email text,
  password_enc text,
  twofa_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table csr2_jobs disable row level security;

alter table csr2_codes add constraint csr2_codes_used_by_job_id_fkey
  foreign key (used_by_job_id) references csr2_jobs(id);

-- Backs the redeem rate limiter (5/min/IP) — needs to be a real table, not
-- in-memory, since Vercel serverless instances don't share memory.
create table if not exists csr2_redeem_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  attempted_at timestamptz not null default now()
);
alter table csr2_redeem_attempts disable row level security;
create index if not exists csr2_redeem_attempts_ip_time_idx on csr2_redeem_attempts (ip, attempted_at);
