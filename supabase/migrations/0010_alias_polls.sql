-- Alias Polls: a second, unrelated poll concept, top-level rather than
-- nested under a gathering (unlike poll_options/poll_votes in 0001_init.sql,
-- which stay exactly as they are — no ALTER here). Anyone with the link can
-- vote under a made-up alias with no account; the organizer is the only one
-- who ever sees a real name. Table names get an alias_poll_ prefix
-- specifically to avoid colliding with the existing poll_options/poll_votes
-- tables, which are a different feature with a different shape (one vote
-- per authenticated session, no alias/message/image concept at all).

create table alias_polls (
  id                 uuid primary key default gen_random_uuid(),
  organizer_user_id  uuid not null references auth.users(id) on delete cascade,

  title              text not null,
  chart_style        text not null default 'card' check (chart_style in ('card', 'columns')),

  suspense_mode      boolean not null default true,   -- hide results until organizer reveals
  comments_live      boolean not null default true,    -- message wall visible before close
  allow_messages     boolean not null default true,     -- voters may attach a message at all
  -- Not in the original field list — added because "Reveal to guests" has
  -- to persist across reloads/other guests' sessions, not just live in one
  -- browser tab's state the way the reference prototype's in-memory demo did.
  revealed           boolean not null default false,

  status             text not null default 'open' check (status in ('open', 'closed')),
  created_at         timestamptz not null default now(),
  closed_at          timestamptz
);

create index alias_polls_organizer_idx on alias_polls(organizer_user_id);

create table alias_poll_options (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references alias_polls(id) on delete cascade,

  label      text not null,
  position   integer not null default 0,

  -- An uploaded image/GIF wins over a link-derived thumbnail, which wins
  -- over an emoji — same priority order as the prototype's optBadgeInner.
  -- The emoji field is meant to auto-hide client-side once image_url or
  -- link_url is set, so in practice at most one of these three is
  -- meaningfully "active" per option, but all three are kept (not
  -- overwritten/cleared) so switching back and forth in the create form
  -- doesn't lose what was typed.
  emoji      text,
  image_url  text,
  link_url   text,
  link_meta  jsonb  -- {host, name} — from the server-side scrape endpoint, or the
                     -- client-side URL-shape parse fallback if that failed
);

create index alias_poll_options_poll_idx on alias_poll_options(poll_id);

create table alias_poll_votes (
  id            uuid primary key default gen_random_uuid(),
  poll_id       uuid not null references alias_polls(id) on delete cascade,
  option_id     uuid not null references alias_poll_options(id) on delete cascade,

  -- Deliberately no user_id / auth reference of any kind — guests vote
  -- fully unauthenticated, no account and no Komon anonymous session
  -- required. real_name is organizer-eyes-only (see the view + RPC below);
  -- everything else here is what every other guest with the link sees too.
  real_name     text not null,
  alias         text not null,
  alias_avatar  text not null,
  message       text,

  created_at    timestamptz not null default now()
);

create index alias_poll_votes_poll_idx on alias_poll_votes(poll_id);
create index alias_poll_votes_option_idx on alias_poll_votes(option_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table alias_polls         enable row level security;
alter table alias_poll_options  enable row level security;
alter table alias_poll_votes    enable row level security;

-- alias_polls / alias_poll_options: readable by anyone with the link;
-- writable only by the organizer who created the poll. Same shape as
-- gatherings_*/cost_items_* in 0001_init.sql.
create policy "alias_polls_select_all" on alias_polls for select using (true);
create policy "alias_polls_insert_own" on alias_polls for insert with check (organizer_user_id = auth.uid());
create policy "alias_polls_update_own" on alias_polls for update using (organizer_user_id = auth.uid());
create policy "alias_polls_delete_own" on alias_polls for delete using (organizer_user_id = auth.uid());

create policy "alias_poll_options_select_all" on alias_poll_options for select using (true);
create policy "alias_poll_options_write_organizer" on alias_poll_options for all using (
  exists (select 1 from alias_polls p where p.id = alias_poll_options.poll_id and p.organizer_user_id = auth.uid())
) with check (
  exists (select 1 from alias_polls p where p.id = alias_poll_options.poll_id and p.organizer_user_id = auth.uid())
);

-- alias_poll_votes: insert is wide open (no ownership check — there's no
-- user_id column to check against), matching waitlist_insert_open's shape.
-- No rate-limiting/one-vote-per-alias enforcement — explicitly a v1
-- non-goal. Deliberately NO select policy on the base table at all: RLS
-- can only grant or deny a whole row, it can't hide a single column, so
-- "everyone sees votes but only the organizer sees real_name" can't be a
-- plain policy on this table — see the view + RPC below instead. This
-- means the base table is unreachable via the client entirely; both real
-- data paths go through those two objects.
create policy "alias_poll_votes_insert_open" on alias_poll_votes for insert to anon, authenticated with check (true);

-- Guest-facing read: every column except real_name. A view (rather than a
-- second table) run with its owner's privileges by default, so it can
-- select from alias_poll_votes even though that table itself grants no
-- select policy to anon/authenticated — the view's own column list is the
-- entire exposed surface, so real_name is structurally absent rather than
-- just unrendered by client code.
create view alias_poll_votes_public as
  select id, poll_id, option_id, alias, alias_avatar, message, created_at
  from alias_poll_votes;

grant select on alias_poll_votes_public to anon, authenticated;

-- Organizer-facing read: same SECURITY DEFINER shape as
-- is_waitlist_approved (0008_waitlist_grandfather.sql) — bypasses RLS
-- internally, but the function signature is the entire exposed surface,
-- and it fails closed (empty set) for anyone who isn't the poll's own
-- organizer rather than erroring in a way that might get treated as "ok,
-- show it anyway" by a careless caller.
create or replace function get_alias_poll_votes(poll_id_arg uuid)
returns setof alias_poll_votes
language sql
security definer
set search_path = public
as $$
  select v.*
  from alias_poll_votes v
  where v.poll_id = poll_id_arg
    and exists (
      select 1 from alias_polls p
      where p.id = poll_id_arg and p.organizer_user_id = auth.uid()
    );
$$;

grant execute on function get_alias_poll_votes(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: poll option images/GIFs bucket (public read, uploader-folder-
-- scoped write) — same shape as the cover-images bucket block at the
-- bottom of 0001_init.sql, uncommented here since poll option images are
-- needed from day one rather than a later add-on. Run this after creating
-- the "poll-images" bucket in the Supabase dashboard, or via the
-- `supabase storage` CLI. Upload path from the app is
-- "<organizer's auth.uid()>/<uuid>.<ext>".
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('poll-images', 'poll-images', true)
on conflict (id) do nothing;

create policy "poll_images_owner_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'poll-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "poll_images_public_read" on storage.objects for select to public
  using (bucket_id = 'poll-images');

create policy "poll_images_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'poll-images' and (storage.foldername(name))[1] = auth.uid()::text);
