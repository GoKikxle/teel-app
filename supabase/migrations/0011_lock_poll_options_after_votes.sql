-- Alias Polls, round 4: "Edit poll" (src/pages/PollCreate.tsx in edit mode)
-- lets the organizer change the question at any time, but options only
-- while the poll has zero votes — once someone has voted, changing the
-- option set would make the existing tally meaningless. The client
-- enforces this via data/polls.ts's pollHasVotes() check before rendering
-- editable option fields / before deciding whether to send an options
-- write at all, but that's advisory only — this migration is the actual
-- enforcement, replacing alias_poll_options' single "for all" organizer
-- policy (0010_alias_polls.sql) with three narrower ones that add a
-- "no votes yet" condition to insert/update/delete. select stays public
-- and untouched (alias_poll_options_select_all, unchanged).

drop policy "alias_poll_options_write_organizer" on alias_poll_options;

create policy "alias_poll_options_insert_organizer" on alias_poll_options for insert with check (
  exists (select 1 from alias_polls p where p.id = alias_poll_options.poll_id and p.organizer_user_id = auth.uid())
  and not exists (select 1 from alias_poll_votes v where v.poll_id = alias_poll_options.poll_id)
);

-- update's `using` clause also carries the no-votes condition (it gates
-- which existing rows may be targeted at all), but `with check` only
-- re-verifies organizer ownership on the resulting row — a row that
-- passed `using` already proves no vote existed for this poll at the
-- start of the statement.
create policy "alias_poll_options_update_organizer" on alias_poll_options for update using (
  exists (select 1 from alias_polls p where p.id = alias_poll_options.poll_id and p.organizer_user_id = auth.uid())
  and not exists (select 1 from alias_poll_votes v where v.poll_id = alias_poll_options.poll_id)
) with check (
  exists (select 1 from alias_polls p where p.id = alias_poll_options.poll_id and p.organizer_user_id = auth.uid())
);

create policy "alias_poll_options_delete_organizer" on alias_poll_options for delete using (
  exists (select 1 from alias_polls p where p.id = alias_poll_options.poll_id and p.organizer_user_id = auth.uid())
  and not exists (select 1 from alias_poll_votes v where v.poll_id = alias_poll_options.poll_id)
);
