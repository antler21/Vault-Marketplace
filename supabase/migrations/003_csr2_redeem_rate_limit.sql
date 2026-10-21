-- Adds the success flag needed for the global failed-attempt circuit breaker.
-- Run this once in the Supabase SQL editor (after 002_csr2_redeem.sql).
alter table csr2_redeem_attempts add column if not exists success boolean not null default false;
create index if not exists csr2_redeem_attempts_success_time_idx on csr2_redeem_attempts (success, attempted_at);
