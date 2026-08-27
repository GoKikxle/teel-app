-- Grandfathers the two existing real accounts (both the operator's own
-- testing accounts, confirmed by reviewing `select distinct email from
-- auth.users` together) so sign-in gating below doesn't lock anyone with
-- an existing account out. Deliberately NOT a generic
-- "approve everyone currently in auth.users" statement — that would mean
-- re-running this migration (or a copy of it) after future signups exist
-- would retroactively approve people who were never reviewed. Exactly
-- these two emails, nothing derived from a live table scan.
insert into waitlist (email, approved)
values
  ('iyehkennedy@gmail.com', true),
  ('parisgad@gmail.com', true)
on conflict (email) do update set approved = true;

-- Approval-check function: the only way the client can read anything from
-- `waitlist`, since the table still has no select policy (see
-- 0007_waitlist.sql) and none is added here either. SECURITY DEFINER lets
-- this bypass RLS internally to read the table, but the function's own
-- signature is the entire exposed surface — one email in, one boolean out.
-- It cannot be used to enumerate rows, list other emails, or distinguish
-- "declined" from "never signed up" (both correctly read as false via the
-- coalesce), which is exactly the narrow yes/no this needs and nothing
-- more.
create or replace function is_waitlist_approved(check_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select approved from waitlist where email = check_email), false);
$$;

grant execute on function is_waitlist_approved(text) to anon, authenticated;
