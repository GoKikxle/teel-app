-- Recategorize: replaces the original 6-key category taxonomy (hike, brunch,
-- game, dj, poetry, other) with a 5-key one (hike_sports, travel_holiday,
-- food, music_art, other). `other` is unchanged and stays the internal
-- fallback/default used by Split Bill (see createSplitBill in
-- src/data/gatherings.ts) — it's excluded from the selectable category chips
-- in Create.tsx/Edit.tsx, same as before.
--
-- Existing rows must be migrated to a valid new key BEFORE the check
-- constraint is swapped, or the constraint add below will fail against
-- any row still holding an old key.
update gatherings set category = 'hike_sports' where category = 'hike';
update gatherings set category = 'food' where category = 'brunch';
update gatherings set category = 'other' where category = 'game';
update gatherings set category = 'music_art' where category in ('dj', 'poetry');

-- gatherings_category_check is the standard Postgres-assigned name for the
-- original inline, unnamed `check (category in (...))` in 0001_init.sql —
-- if your project somehow named it differently, adjust the constraint name
-- below to match (query
-- `select conname from pg_constraint where conrelid = 'gatherings'::regclass;`
-- to confirm before running).
alter table gatherings drop constraint gatherings_category_check;
alter table gatherings add constraint gatherings_category_check
  check (category in ('hike_sports', 'travel_holiday', 'food', 'music_art', 'other'));
