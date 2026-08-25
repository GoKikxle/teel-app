-- Split Bill: a second, lightweight creation flow alongside the full
-- "New gathering" form. No RSVPs, no names, no guest list — just an
-- amount, a split rule, and a payment link. `kind` is what lets
-- Detail.tsx/FlyerCard.tsx tell the two apart; every other column below is
-- reused from the full-gathering shape rather than duplicated.
alter table gatherings add column kind text not null default 'event'
  check (kind in ('event', 'split_bill'));

-- "Dutch" split: each guest types their own amount rather than an equal
-- share computed by Komon. Postgres can't append a value to an existing
-- check constraint, so this drops and recreates it. gatherings_split_method_check
-- is the standard Postgres-assigned name for the original inline, unnamed
-- `check (split_method in (...))` in 0001_init.sql — if your project
-- somehow named it differently, adjust the constraint name below to match
-- (query `select conname from pg_constraint where conrelid = 'gatherings'::regclass;`
-- to confirm before running).
alter table gatherings drop constraint gatherings_split_method_check;
alter table gatherings add constraint gatherings_split_method_check
  check (split_method in ('equal', 'custom', 'itemized', 'dutch'));

-- Only ever populated when split_method = 'dutch': what a Split Bill guest
-- typed as what they owe. Equal-split amounts are deliberately never
-- stored here — same as the existing full-flow convention where
-- per-person share is always computed live from cost_total (see
-- SplitPayPanel's `perPerson`), never snapshotted onto the rsvp row.
alter table rsvps add column amount_owed numeric(10,2);
