-- Waitlist: captures interest emails from the pre-launch "coming soon" page
-- (see src/pages/Landing.tsx, which fully replaces the old Get Started/Sign
-- In anonymous entry point with this waitlist form). Insert-only from the
-- client — no select policy is defined at all, so the list itself is never
-- exposed through the API even though anyone can add to it; reading it back
-- requires the Supabase dashboard or a service-role key.
--
-- `approved` is included from the start (not bolted on later) since sign-in
-- will eventually be gated on it — see the phase-2 discussion before this
-- gets wired into SignInModal.tsx. Defaults to false: nobody is let in
-- automatically just by joining the waitlist.
create table waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  created_at  timestamptz not null default now(),
  approved    boolean not null default false
);

alter table waitlist enable row level security;

-- Open to anon and authenticated roles: every visitor normally has the
-- app's usual anonymous Supabase Auth session by the time they submit
-- (role becomes 'authenticated' once that resolves, same as everywhere
-- else in this app), but this covers the edge case of a submit landing
-- before that bootstrap finishes too.
create policy "waitlist_insert_open" on waitlist for insert to anon, authenticated with check (true);
