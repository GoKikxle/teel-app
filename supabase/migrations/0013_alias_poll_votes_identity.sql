-- Alias Polls, round 7: server-side one-vote-per-guest enforcement, vote
-- editing before close, and per-poll alias uniqueness. alias_poll_votes
-- previously had no identity column at all — 0010's own comment says so
-- outright: "no rate-limiting/one-vote-per-alias enforcement — explicitly
-- a v1 non-goal." Every visitor already gets an anonymous Supabase
-- auth.uid() with no account required (signInAnonymously() in
-- useAuth.tsx), so this borrows the exact shape the OTHER, unrelated poll
-- system already established for exactly this problem — poll_votes in
-- 0001_init.sql: voter_user_id + unique(gathering_id, voter_user_id) +
-- an RLS check on it — rather than inventing a new pattern.

alter table alias_poll_votes add column voter_user_id uuid references auth.users(id) on delete cascade;

-- Backfill is deliberately skipped: existing votes predate this column
-- and have no real identity to attribute, so they're left null rather
-- than guessed. A null voter_user_id can never collide with the unique
-- constraint below (NULL is never equal to NULL in a unique index), so
-- pre-existing votes are simply exempt from one-vote-per-guest
-- retroactively; every vote cast from here on always sets it.
alter table alias_poll_votes
  add constraint alias_poll_votes_poll_voter_unique unique (poll_id, voter_user_id);

-- Alias uniqueness per poll, exact match, per the request — two guests in
-- the same poll can't both be "Spongebob" at once. Composes cleanly with
-- vote-editing below: a guest re-saving their own unchanged (or changed
-- back) alias never conflicts with their own row, since a unique
-- constraint's check on UPDATE excludes the row being updated — only a
-- genuine collision with a DIFFERENT voter's row is rejected.
alter table alias_poll_votes
  add constraint alias_poll_votes_poll_alias_unique unique (poll_id, alias);

-- Replaces the wide-open insert policy (0010, tightened once already by
-- 0012 for the closes_at race) with one that also requires the caller's
-- own auth.uid() as voter_user_id — still anon/authenticated, since an
-- anonymous Komon session is how every unauthenticated guest already has
-- a uid. The open/not-expired condition is unchanged from 0012.
drop policy "alias_poll_votes_insert_open" on alias_poll_votes;
create policy "alias_poll_votes_insert_own" on alias_poll_votes for insert to anon, authenticated with check (
  voter_user_id = auth.uid()
  and exists (
    select 1 from alias_polls p
    where p.id = alias_poll_votes.poll_id
      and p.status = 'open'
      and (p.closes_at is null or p.closes_at > now())
  )
);

-- New: lets a guest change their own vote (option/alias/message) any time
-- before the poll closes — same ownership + open/not-expired shape as the
-- insert policy above, since a client-side upsert needs both to succeed
-- depending on whether this is the guest's first vote or a change to it.
create policy "alias_poll_votes_update_own" on alias_poll_votes for update to anon, authenticated using (
  voter_user_id = auth.uid()
) with check (
  voter_user_id = auth.uid()
  and exists (
    select 1 from alias_polls p
    where p.id = alias_poll_votes.poll_id
      and p.status = 'open'
      and (p.closes_at is null or p.closes_at > now())
  )
);

-- New: guests need to know their OWN vote on load (e.g. after a refresh)
-- so the ballot can show what they already picked instead of a blank
-- form. The existing public view (alias_poll_votes_public, 0010) has no
-- ownership filter at all — it's meant for "every guest sees every vote's
-- tally," the opposite of what's needed here — and 0010's own reasoning
-- for using a view instead of a table policy in the first place (RLS
-- can't hide a single column, only a whole row) doesn't apply to this
-- narrower case: restricted to the caller's own row, this can never
-- return anyone else's real_name, because it can never return anyone
-- else's row at all.
create policy "alias_poll_votes_select_own" on alias_poll_votes for select to anon, authenticated using (
  voter_user_id = auth.uid()
);
