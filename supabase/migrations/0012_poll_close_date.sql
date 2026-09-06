-- Alias Polls, round 5: every poll now has a close date/time. Existing
-- polls (created before this migration) get closes_at = null — treated as
-- "never expires" for backward compatibility; every poll created going
-- forward always sets one (the create form has no open-ended option), so
-- a null closes_at should only ever appear on rows that predate this.
alter table alias_polls add column closes_at timestamptz;

-- Vote inserts must check closes_at directly, not just status — the lazy
-- close-on-read pattern (src/data/polls.ts's fetchPoll) only flips status
-- to 'closed' once someone loads the poll after expiry, so there's a
-- window where status can still say 'open' after closes_at has passed.
-- Checking closes_at here directly closes that race regardless of what
-- status currently says.
drop policy "alias_poll_votes_insert_open" on alias_poll_votes;
create policy "alias_poll_votes_insert_open" on alias_poll_votes for insert to anon, authenticated with check (
  exists (
    select 1 from alias_polls p
    where p.id = alias_poll_votes.poll_id
      and p.status = 'open'
      and (p.closes_at is null or p.closes_at > now())
  )
);

-- Lets ANY caller (organizer or anonymous guest) perform the lazy
-- open->closed flip on an already-expired poll on read.
-- alias_polls_update_own (0010) only lets the organizer update their own
-- poll, which would block a guest's page load from self-healing an
-- expired poll's status. Narrowly scoped: using requires the row is
-- already expired and still marked open; with check requires the result
-- be 'closed' — this policy can never be used for anything else.
create policy "alias_polls_auto_close_on_expiry" on alias_polls for update
  to anon, authenticated
  using (status = 'open' and closes_at is not null and closes_at <= now())
  with check (status = 'closed');
