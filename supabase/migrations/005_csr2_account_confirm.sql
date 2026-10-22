-- Moves the "is this your account?" check from an admin console prompt to the
-- buyer, on the redeem page itself. Run this once in the Supabase SQL editor.

alter table csr2_jobs add column if not exists account_confirm_data jsonb;
alter table csr2_jobs add column if not exists account_confirmed boolean;

-- Drop whatever the status CHECK constraint is actually named (inline column
-- checks get an auto-generated name - looked up here instead of assumed) and
-- replace it with one that also allows the new status.
do $$
declare
  conname text;
begin
  select con.conname into conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'csr2_jobs' and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%status%';
  if conname is not null then
    execute format('alter table csr2_jobs drop constraint %I', conname);
  end if;
end $$;

alter table csr2_jobs add constraint csr2_jobs_status_check check (status in (
  'awaiting_credentials', 'logging_in', 'bad_password', 'awaiting_2fa', 'bad_code',
  'launching_game', 'awaiting_save_load', 'awaiting_account_confirm', 'editing_save',
  'awaiting_relaunch', 'saving', 'done', 'error'
));
