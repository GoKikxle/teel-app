-- Recategorize: replaces the original 6-key category taxonomy (hike, brunch,
-- game, dj, poetry, other) with a 5-key one (hike_sports, travel_holiday,
-- food, music_art, other). `other` is unchanged and stays the internal
-- fallback/default used by Split Bill (see createSplitBill in
-- src/data/gatherings.ts) — it's excluded from the selectable category chips
-- in Create.tsx/Edit.tsx, same as before.
--
-- Run each numbered step as its own separate statement/submission in the
-- SQL Editor, not all pasted and run together — that's what let the first
-- attempt's ALTER failure silently roll back every UPDATE before it.

-- Step 1 — baseline check. Confirm this matches what you expect (old keys
-- only) before changing anything.
select category, count(*) from gatherings group by category order by category;

-- Step 2 — migrate existing rows. Each of these four commits independently.
update gatherings set category = 'hike_sports' where category = 'hike';

update gatherings set category = 'food' where category = 'brunch';

update gatherings set category = 'other' where category = 'game';

update gatherings set category = 'music_art' where category in ('dj', 'poetry');

-- Step 3 — verify every row now holds a value the new constraint will
-- accept. This MUST return zero rows before you proceed to step 4/5. If it
-- returns anything, stop and inspect those rows (e.g. wrap category in
-- length(...) and encode(category::bytea, 'hex') to check for hidden
-- characters) rather than continuing.
select id, title, category from gatherings
where category not in ('hike_sports', 'travel_holiday', 'food', 'music_art', 'other');

-- Step 4 — drop the old constraint.
-- gatherings_category_check is the standard Postgres-assigned name for the
-- original inline, unnamed `check (category in (...))` in 0001_init.sql —
-- if your project somehow named it differently, adjust below (query
-- `select conname from pg_constraint where conrelid = 'gatherings'::regclass;`
-- to confirm first).
alter table gatherings drop constraint gatherings_category_check;

-- Step 5 — add the new constraint as NOT VALID. This only applies to future
-- writes and does NOT scan/validate existing rows, so it cannot fail here
-- regardless of what's already in the table.
alter table gatherings add constraint gatherings_category_check
  check (category in ('hike_sports', 'travel_holiday', 'food', 'music_art', 'other')) not valid;

-- Step 6 — validate the constraint against existing rows, as its own
-- separate step. If this fails, the constraint remains in place as
-- NOT VALID and the table is otherwise untouched — nothing rolls back, and
-- the error tells you a real, currently-existing violation to go find with
-- step 3's query again, rather than an artifact of statement ordering.
alter table gatherings validate constraint gatherings_category_check;
