-- Komon v1 schema
-- Identity: every visitor (organizer or guest) gets a Supabase Anonymous Auth
-- user on first load. auth.uid() is stable per browser and used for RLS —
-- there is no visible login step, matching the "no login wall" product rule.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- gatherings
-- ---------------------------------------------------------------------------
create table gatherings (
  id                uuid primary key default gen_random_uuid(),
  organizer_id      uuid not null references auth.users(id) on delete cascade,

  title             text not null,
  category          text not null check (category in ('hike','brunch','game','dj','poetry','other')),
  gathering_date    date not null,
  gathering_time    text,               -- free-form "HH:MM", matches prototype (no timezone modeling in v1)
  location          text,
  capacity          integer not null default 8 check (capacity > 0),
  cover_image_url   text,

  visibility        text not null default 'private' check (visibility in ('public','private','invited')),

  cost_enabled      boolean not null default false,
  cost_mode         text not null default 'split_pay' check (cost_mode in ('split_pay','get_tix')), -- get_tix reserved; no v1 UI (needs Stripe)
  cost_total        numeric(10,2) not null default 0,
  split_method      text not null default 'equal' check (split_method in ('equal','custom','itemized')),
  pay_mode          text not null default 'direct' check (pay_mode in ('direct','stripe')),          -- v1 only builds 'direct'
  pay_method        text check (pay_method in ('venmo','paypal','cashapp','monzo','revolut')),
  pay_handle        text,
  stripe_account_id text,               -- unused in v1, reserved for Stripe Connect pass

  poll_enabled      boolean not null default false,
  poll_question     text,

  reminder_on       boolean not null default false,
  created_at        timestamptz not null default now()
);

create index gatherings_organizer_idx on gatherings(organizer_id);
create index gatherings_date_idx on gatherings(gathering_date);

-- ---------------------------------------------------------------------------
-- rsvps  (one row per guest per gathering)
-- ---------------------------------------------------------------------------
create table rsvps (
  id             uuid primary key default gen_random_uuid(),
  gathering_id   uuid not null references gatherings(id) on delete cascade,
  guest_user_id  uuid not null references auth.users(id) on delete cascade,

  name           text not null,
  phone          text,

  paid_sent      boolean not null default false,  -- direct-pay step 1: "I sent it via <provider>"
  paid           boolean not null default false,  -- direct-pay step 2 self-report / stripe verified (v2)

  created_at     timestamptz not null default now(),
  unique (gathering_id, guest_user_id)
);

create index rsvps_gathering_idx on rsvps(gathering_id);

-- ---------------------------------------------------------------------------
-- cost_items  (itemized split line items)
-- ---------------------------------------------------------------------------
create table cost_items (
  id             uuid primary key default gen_random_uuid(),
  gathering_id   uuid not null references gatherings(id) on delete cascade,
  name           text not null,
  amount         numeric(10,2) not null default 0,
  position       integer not null default 0
);

create index cost_items_gathering_idx on cost_items(gathering_id);

-- ---------------------------------------------------------------------------
-- poll_options
-- ---------------------------------------------------------------------------
create table poll_options (
  id             uuid primary key default gen_random_uuid(),
  gathering_id   uuid not null references gatherings(id) on delete cascade,
  label          text not null,
  position       integer not null default 0
);

create index poll_options_gathering_idx on poll_options(gathering_id);

-- ---------------------------------------------------------------------------
-- poll_votes  (one vote per guest per gathering, matches prototype's rule)
-- ---------------------------------------------------------------------------
create table poll_votes (
  id              uuid primary key default gen_random_uuid(),
  poll_option_id  uuid not null references poll_options(id) on delete cascade,
  gathering_id    uuid not null references gatherings(id) on delete cascade,
  voter_user_id   uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (gathering_id, voter_user_id)
);

create index poll_votes_option_idx on poll_votes(poll_option_id);

-- ---------------------------------------------------------------------------
-- invited_emails  (visibility = 'invited' allow-list; UX-gate only, per PRD §5 —
-- not real identity verification)
-- ---------------------------------------------------------------------------
create table invited_emails (
  id             uuid primary key default gen_random_uuid(),
  gathering_id   uuid not null references gatherings(id) on delete cascade,
  email          text not null,
  accessed       boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (gathering_id, email)
);

create index invited_emails_gathering_idx on invited_emails(gathering_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table gatherings      enable row level security;
alter table rsvps           enable row level security;
alter table cost_items      enable row level security;
alter table poll_options    enable row level security;
alter table poll_votes      enable row level security;
alter table invited_emails  enable row level security;

-- gatherings: readable by anyone with the link (no login wall to view);
-- writable only by the organizer who created it.
create policy "gatherings_select_all" on gatherings for select using (true);
create policy "gatherings_insert_own" on gatherings for insert with check (organizer_id = auth.uid());
create policy "gatherings_update_own" on gatherings for update using (organizer_id = auth.uid());
create policy "gatherings_delete_own" on gatherings for delete using (organizer_id = auth.uid());

-- rsvps: guest list is visible to anyone viewing the gathering; a guest can
-- only create/edit/cancel their own RSVP row.
create policy "rsvps_select_all" on rsvps for select using (true);
create policy "rsvps_insert_own" on rsvps for insert with check (guest_user_id = auth.uid());
create policy "rsvps_update_own" on rsvps for update using (guest_user_id = auth.uid());
create policy "rsvps_delete_own" on rsvps for delete using (guest_user_id = auth.uid());

-- cost_items / poll_options: visible to anyone, editable only by the
-- gathering's organizer.
create policy "cost_items_select_all" on cost_items for select using (true);
create policy "cost_items_write_organizer" on cost_items for all using (
  exists (select 1 from gatherings g where g.id = cost_items.gathering_id and g.organizer_id = auth.uid())
) with check (
  exists (select 1 from gatherings g where g.id = cost_items.gathering_id and g.organizer_id = auth.uid())
);

create policy "poll_options_select_all" on poll_options for select using (true);
create policy "poll_options_write_organizer" on poll_options for all using (
  exists (select 1 from gatherings g where g.id = poll_options.gathering_id and g.organizer_id = auth.uid())
) with check (
  exists (select 1 from gatherings g where g.id = poll_options.gathering_id and g.organizer_id = auth.uid())
);

-- poll_votes: counts visible to anyone; a guest can only cast their own vote,
-- once (unique constraint above), and can't change or delete it — matches
-- the prototype's "you already voted" rule.
create policy "poll_votes_select_all" on poll_votes for select using (true);
create policy "poll_votes_insert_own" on poll_votes for insert with check (voter_user_id = auth.uid());

-- invited_emails: management restricted to the organizer. Select is open —
-- the invite gate is a UX check, not real access control (PRD §5), so this
-- matches the prototype's behavior rather than adding security the product
-- doesn't claim to have yet.
create policy "invited_emails_select_all" on invited_emails for select using (true);
create policy "invited_emails_write_organizer" on invited_emails for all using (
  exists (select 1 from gatherings g where g.id = invited_emails.gathering_id and g.organizer_id = auth.uid())
) with check (
  exists (select 1 from gatherings g where g.id = invited_emails.gathering_id and g.organizer_id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- Storage: cover images bucket (public read, uploader-folder-scoped write)
-- Run this after creating the "cover-images" bucket in the Supabase dashboard,
-- or via `supabase storage` CLI. Upload path from the app is
-- "<organizer's auth.uid()>/<uuid>.<ext>" — the write policy checks the
-- first path segment matches the uploader's own uid, so anonymous-auth users
-- can't write into each other's folders.
-- ---------------------------------------------------------------------------
-- insert into storage.buckets (id, name, public) values ('cover-images', 'cover-images', true);
--
-- create policy "cover_images_owner_write" on storage.objects for insert to authenticated
--   with check (bucket_id = 'cover-images' and (storage.foldername(name))[1] = auth.uid()::text);
--
-- create policy "cover_images_public_read" on storage.objects for select to public
--   using (bucket_id = 'cover-images');
--
-- -- Needed so deleteGathering() can remove the cover image when an organizer
-- -- deletes their gathering (DB cascade can't reach Storage objects).
-- create policy "cover_images_owner_delete" on storage.objects for delete to authenticated
--   using (bucket_id = 'cover-images' and (storage.foldername(name))[1] = auth.uid()::text);
