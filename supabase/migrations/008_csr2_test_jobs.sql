-- Marks codes/jobs created by the test harness (app/csr2-test, the fake-worker
-- script) so the REAL worker's claim() never picks them up, and a test-only
-- claim route can find them instead. Run this once in the Supabase SQL editor
-- (after 006/007).
alter table csr2_codes add column if not exists is_test boolean not null default false;
alter table csr2_jobs add column if not exists is_test boolean not null default false;
