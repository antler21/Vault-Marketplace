-- Small follow-up to 006, found necessary while wiring the actual routes/UI.
-- Run this once in the Supabase SQL editor (after 006).

-- Mirrors account_confirmed's existing boolean-answer pattern (migration 005) for the
-- iOS GameCenter confirm step (spec §4) — the ONLY new screenshot step with a buyer
-- action attached. Android's sign-in approval (spec §5) is a pure wait-and-display
-- state: the buyer approves on their own device, not on this site, so it needs no
-- matching column here — the worker advances the job's status on its own.
alter table csr2_jobs add column if not exists gamecenter_confirmed boolean;

-- Buyer's choice at the awaiting_risk_decision step (spec §10). The risk plan itself
-- is computed on the fly from account_confirm_data's level + the pack + ledger
-- history — only the buyer's decision needs to be persisted.
alter table csr2_jobs add column if not exists risk_decision text;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'csr2_jobs_risk_decision_check'
  ) then
    alter table csr2_jobs add constraint csr2_jobs_risk_decision_check
      check (risk_decision is null or risk_decision in ('accept', 'override'));
  end if;
end $$;
