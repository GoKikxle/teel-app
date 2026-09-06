import { supabase } from '../lib/supabase';
import { BOARD_AVATAR_COLORS } from '../lib/constants';
import type { AliasPoll, AliasPollOption, AliasPollVote, AliasPollVotePublic, ChartStyle, LinkMeta } from '../lib/database.types';

// --- Alias nudge ----------------------------------------------------------
// Round 5 removed the generated-alias UI (makeAlias/Alias/word lists) — the
// alias field is now a plain typed input (see PollVote.tsx) with no
// auto-generated default, so there's nothing left to generate here. The
// real-name nudge below is unaffected — it never depended on how the alias
// was produced, only on comparing it against the typed real name.

// Soft nudge only — never blocks voting. Catches the accidental case
// (typing your real name out of habit), not offensive content, which a
// fuzzy text match can't reliably judge anyway. Ported verbatim from the
// prototype's checkAliasNudge.
function normalizeForMatch(str: string): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function aliasLooksLikeRealName(realName: string, alias: string): boolean {
  const name = normalizeForMatch(realName);
  const aliasNorm = normalizeForMatch(alias);
  if (!name || !aliasNorm) return false;
  const nameWords = name.split(' ').filter((w) => w.length >= 2);
  return aliasNorm === name || nameWords.some((w) => new RegExp(`(^| )${w}( |$)`).test(aliasNorm));
}

// --- Link parsing ----------------------------------------------------------
// Client-side host/name parse from the URL's own shape — ported verbatim
// from the prototype's parseLinkMeta, including the Google Maps place-name
// extraction. Used for an instant preview before fetchLinkPreview's
// server-side scrape resolves, and as the fallback if that scrape fails.
export function parseLinkMeta(url: string): LinkMeta | null {
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (!parsed.hostname || parsed.hostname.indexOf('.') === -1) return null;
  const host = parsed.hostname.replace(/^www\./, '');
  let name: string | null = null;
  const mapsMatch = parsed.pathname.match(/\/maps\/place\/([^/]+)/);
  if (mapsMatch) {
    name = decodeURIComponent(mapsMatch[1].replace(/\+/g, ' '));
  } else {
    const segs = parsed.pathname.split('/').filter(Boolean);
    name = segs.length ? decodeURIComponent(segs[segs.length - 1]).replace(/[-_+]/g, ' ') : host.split('.')[0];
  }
  name = (name || host).replace(/\s+/g, ' ').trim();
  if (name.length > 28) name = `${name.slice(0, 28)}…`;
  return { host, name: name || host, imageUrl: null };
}

function strHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}

export interface InitialsBadge {
  initials: string;
  bg: string;
  fg: string;
}

// A deterministic colored-initials placeholder — same basis as the
// prototype's autoThumbHtml, returned as data for the caller to render
// (rather than an injected HTML string) so it fits a React component.
export function initialsBadge(meta: LinkMeta): InitialsBadge {
  const basis = meta.host || meta.name || '?';
  const words = (meta.name || meta.host || '?').trim().split(/\s+/).slice(0, 2);
  const initials = words.map((w) => w.charAt(0) || '').join('').toUpperCase() || '?';
  const hue = strHash(basis) % 360;
  return { initials, bg: `hsl(${hue}, 60%, 90%)`, fg: `hsl(${hue}, 55%, 32%)` };
}

// Shared by the poll wall (PollWall.tsx) and the organizer's voter-avatar
// row (PollOrganize.tsx) so the same person always gets the same initials
// and color in both places. Deliberately separate from initialsBadge above
// (link previews): that one hashes by host/name into an hsl() wheel, this
// one hashes into the colorful BOARD_AVATAR_COLORS palette — an exact match
// to the Figma Dev Mode file's avatar colors for the wrap-up voter row and
// message-wall bubbles (originally scoped to BoardGatheringCard's RSVP
// avatars, see lib/constants.ts), not the app-wide greyscale AVATAR_COLORS.
export function aliasInitials(name: string): string {
  const trimmed = (name || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

export function aliasColor(name: string): string {
  return BOARD_AVATAR_COLORS[strHash(name || '') % BOARD_AVATAR_COLORS.length];
}

export interface LinkPreview {
  imageUrl: string | null;
  title: string | null;
  host: string;
}

// Real server-side fetch — unlike the prototype, which faked this entirely
// client-side. Never throws: a network failure or non-OK response resolves
// to null so the caller falls back to parseLinkMeta's host/name +
// initialsBadge, exactly like a poll with no og:image would.
export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  try {
    const res = await fetch(`/api/poll-link-preview?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    return (await res.json()) as LinkPreview;
  } catch {
    return null;
  }
}

// --- Option image upload ---------------------------------------------------
// Same createImageBitmap + canvas + JPEG-encode shape as resizeCoverImage
// in data/gatherings.ts, capped at 120px per side per the reviewed
// prototype's readImageAsThumb. GIFs pass through unresized — redrawing to
// canvas would flatten them to one frame and kill the animation, same
// reasoning as the prototype.
const MAX_OPTION_DIMENSION = 120;
const OPTION_JPEG_QUALITY = 0.85;
const MAX_OPTION_UPLOAD_BYTES = 5 * 1024 * 1024;

function isGifFile(file: File): boolean {
  return file.type === 'image/gif' || /\.gif$/i.test(file.name || '');
}

async function resizePollOptionImage(file: File): Promise<{ blob: Blob; contentType: string; ext: string }> {
  if (isGifFile(file)) {
    return { blob: file, contentType: 'image/gif', ext: 'gif' };
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_OPTION_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', OPTION_JPEG_QUALITY));
    if (!blob) throw new Error('Could not encode option image');
    return { blob, contentType: 'image/jpeg', ext: 'jpg' };
  } finally {
    bitmap.close();
  }
}

export class OptionImageTooLargeError extends Error {}

export async function uploadPollOptionImage(file: File, organizerId: string): Promise<string> {
  if (file.size > MAX_OPTION_UPLOAD_BYTES) {
    throw new OptionImageTooLargeError('That file is a bit large (over 5MB) — try a smaller one.');
  }
  const { blob, contentType, ext } = await resizePollOptionImage(file);
  const path = `${organizerId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('poll-images').upload(path, blob, { contentType });
  if (error) throw error;
  const { data } = supabase.storage.from('poll-images').getPublicUrl(path);
  return data.publicUrl;
}

// --- Poll CRUD ---------------------------------------------------------

export interface CreatePollOptionInput {
  label: string;
  image_url: string | null;
  link_url: string | null;
  link_meta: LinkMeta | null;
}

// A badge always renders now (image > link-preview > monogram, no more
// emoji fallback — see PollOptionBadge.tsx), so every option needs a
// monogram value regardless of what else it has: first letter of the
// label, uppercased. '?' only for the pathological case of an empty label.
export function optionMonogram(label: string): string {
  const trimmed = (label || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

export interface CreatePollInput {
  organizerId: string;
  title: string;
  suspenseMode: boolean;
  commentsLive: boolean;
  allowMessages: boolean;
  // ISO timestamp. Required — the create form has no open-ended option, so
  // every poll made from here on always sets one (see 0012_poll_close_date.sql).
  closesAt: string;
  options: CreatePollOptionInput[];
}

export async function createPoll(input: CreatePollInput): Promise<string> {
  const { data: poll, error: pollError } = await supabase
    .from('alias_polls')
    .insert({
      organizer_user_id: input.organizerId,
      title: input.title,
      // The chart-style picker was removed from the create form (round 4
      // simplification) — PollTally now only ever renders the row-card
      // layout, but the column stays in the schema (no migration for this
      // — see 0011's own comment), so every new poll still needs a valid
      // value written on insert.
      chart_style: 'card' satisfies ChartStyle,
      suspense_mode: input.suspenseMode,
      comments_live: input.commentsLive,
      allow_messages: input.allowMessages,
      closes_at: input.closesAt,
    })
    .select('id')
    .single();
  if (pollError) throw pollError;

  const pollId = poll.id as string;
  const rows = input.options.map((opt, position) => ({
    poll_id: pollId,
    label: opt.label,
    position,
    image_url: opt.image_url,
    link_url: opt.link_url,
    link_meta: opt.link_meta,
  }));
  const { error: optionsError } = await supabase.from('alias_poll_options').insert(rows);
  if (optionsError) throw optionsError;

  return pollId;
}

// Cheap existence check (head request, no rows fetched) — used by
// PollCreate.tsx's edit mode to decide whether options are still
// editable. This is a client-side convenience only; the real enforcement
// is the RLS policies in 0011_lock_poll_options_after_votes.sql, which
// reject any insert/update/delete on alias_poll_options once a vote
// exists regardless of what this check returns.
export async function pollHasVotes(pollId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('alias_poll_votes_public')
    .select('id', { count: 'exact', head: true })
    .eq('poll_id', pollId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export interface UpdatePollInput {
  title: string;
  // Omitted entirely (not an empty array) when options are locked — the
  // caller decides via pollHasVotes, and this function never sends a
  // no-op options write in that case.
  options?: CreatePollOptionInput[];
  // ISO timestamp. Present only when the organizer actively picked a new
  // duration in edit mode — omitted (not sent at all) when they left the
  // close date unchanged, so this never forces a no-op closes_at write.
  closesAt?: string;
}

// Question is always updatable; options are wholesale replaced (delete +
// reinsert) only when input.options is provided, matching createPoll's
// own insert-rows-with-position shape. Safe even if the client-side
// pollHasVotes check were somehow stale, since RLS itself rejects both the
// delete and the insert on alias_poll_options once any vote exists — see
// 0011_lock_poll_options_after_votes.sql.
export async function updatePoll(pollId: string, input: UpdatePollInput): Promise<void> {
  const pollPatch: { title: string; closes_at?: string } = { title: input.title };
  if (input.closesAt) pollPatch.closes_at = input.closesAt;
  const { error: pollError } = await supabase.from('alias_polls').update(pollPatch).eq('id', pollId);
  if (pollError) throw pollError;
  if (!input.options) return;

  const { error: deleteError } = await supabase.from('alias_poll_options').delete().eq('poll_id', pollId);
  if (deleteError) throw deleteError;
  const rows = input.options.map((opt, position) => ({ poll_id: pollId, position, ...opt }));
  const { error: insertError } = await supabase.from('alias_poll_options').insert(rows);
  if (insertError) throw insertError;
}

// Appends a short, concrete reason to the generic "Something went wrong"
// toast whenever the thrown error carries one -- Postgres/PostgREST errors
// (RLS violations, check-constraint failures) and Supabase Storage errors
// (bucket/policy issues -- the common suspect whenever an option image is
// attached) both expose a `message` string, and so does a plain JS Error
// (e.g. createImageBitmap failing on an unsupported file). Falls back to
// the bare generic phrasing when there's nothing useful to add, rather
// than ever showing "undefined" or a raw stack trace to the organizer.
// The full error always still goes to console.error at the call site --
// this is only the short, human-facing supplement.
export function pollErrorToast(verb: 'creating' | 'saving', err: unknown): string {
  const generic = `Something went wrong ${verb} the poll`;
  const message = err && typeof err === 'object' && 'message' in err ? (err as { message?: unknown }).message : null;
  if (typeof message !== 'string' || !message.trim()) return generic;
  const trimmed = message.trim();
  const reason = trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
  return `${generic} (${reason})`;
}

// True once a poll's closes_at has passed, regardless of what its stored
// `status` currently says — the source of truth for whether the lazy
// close-on-read below should run.
function isExpired(poll: Pick<AliasPoll, 'status' | 'closes_at'>): boolean {
  return poll.status === 'open' && Boolean(poll.closes_at) && new Date(poll.closes_at!).getTime() <= Date.now();
}

// Lazy close-on-read: every caller of fetchPoll (PollOrganize.tsx,
// PollVote.tsx) gets this for free. If the poll's closes_at has passed but
// status still says 'open' (nobody's visited since expiry), flip it to
// 'closed' here via the narrowly-scoped alias_polls_auto_close_on_expiry
// RLS policy (0012_poll_close_date.sql), which permits exactly this
// transition for any caller, organizer or anonymous guest. If the write
// fails for some reason, fall back to overriding status/closed_at
// in-memory so this render is at least internally consistent.
export async function fetchPoll(id: string): Promise<AliasPoll | null> {
  const { data, error } = await supabase.from('alias_polls').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  const poll = data as AliasPoll | null;
  if (!poll || !isExpired(poll)) return poll;

  const closedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from('alias_polls')
    .update({ status: 'closed', closed_at: closedAt })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (updateError || !updated) {
    console.error(updateError);
    return { ...poll, status: 'closed', closed_at: closedAt };
  }
  return updated as AliasPoll;
}

export async function fetchPollOptions(pollId: string): Promise<AliasPollOption[]> {
  const { data, error } = await supabase.from('alias_poll_options').select('*').eq('poll_id', pollId).order('position');
  if (error) throw error;
  return (data ?? []) as AliasPollOption[];
}

export async function fetchPollVotesPublic(pollId: string): Promise<AliasPollVotePublic[]> {
  const { data, error } = await supabase
    .from('alias_poll_votes_public')
    .select('*')
    .eq('poll_id', pollId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as AliasPollVotePublic[];
}

// Organizer-only, including real_name — goes through the SECURITY DEFINER
// RPC (get_alias_poll_votes) rather than selecting alias_poll_votes
// directly, since that table has no select policy of its own at all.
export async function fetchPollVotesForOrganizer(pollId: string): Promise<AliasPollVote[]> {
  const { data, error } = await supabase.rpc('get_alias_poll_votes', { poll_id_arg: pollId });
  if (error) throw error;
  return ((data ?? []) as AliasPollVote[]).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export interface CastVoteInput {
  pollId: string;
  optionId: string;
  realName: string;
  alias: string;
  aliasAvatar: string;
  message: string | null;
}

export async function castVote(input: CastVoteInput): Promise<void> {
  const { error } = await supabase.from('alias_poll_votes').insert({
    poll_id: input.pollId,
    option_id: input.optionId,
    real_name: input.realName,
    alias: input.alias,
    alias_avatar: input.aliasAvatar,
    message: input.message,
  });
  if (error) throw error;
}

export async function revealPoll(pollId: string): Promise<void> {
  const { error } = await supabase.from('alias_polls').update({ revealed: true }).eq('id', pollId);
  if (error) throw error;
}

export async function closePoll(pollId: string): Promise<void> {
  const { error } = await supabase
    .from('alias_polls')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', pollId);
  if (error) throw error;
}

// --- Shared render helpers --------------------------------------------

export function guestCanSeeResults(poll: Pick<AliasPoll, 'suspense_mode' | 'revealed'>): boolean {
  return !poll.suspense_mode || poll.revealed;
}

export function wallUnlocked(poll: Pick<AliasPoll, 'comments_live' | 'status'>): boolean {
  return poll.comments_live || poll.status === 'closed';
}

export interface OptionCount {
  option: AliasPollOption;
  count: number;
  pct: number;
}

export function tallyOptions(options: AliasPollOption[], votes: { option_id: string }[]): OptionCount[] {
  const total = votes.length;
  return options.map((option) => {
    const count = votes.filter((v) => v.option_id === option.id).length;
    return { option, count, pct: total ? Math.round((count / total) * 100) : 0 };
  });
}

// Ties included, matching the prototype's winners.filter(count === max).
export function pickWinners(counts: OptionCount[]): OptionCount[] {
  const max = Math.max(0, ...counts.map((c) => c.count));
  if (max === 0) return [];
  return counts.filter((c) => c.count === max);
}

// Longest messages first — same heuristic as the prototype's
// pickBestMessages (no real engagement/like signal exists to sort by).
export function pickBestMessages<T extends { message: string | null }>(votes: T[], n: number): T[] {
  return votes
    .filter((v): v is T & { message: string } => Boolean(v.message && v.message.trim().length))
    .slice()
    .sort((a, b) => b.message.length - a.message.length)
    .slice(0, n);
}

// --- Board integration --------------------------------------------------
// Alias Polls have no entry point or find-again path elsewhere in the app;
// these two organizer-scoped queries feed the Board's "Polls" tab and the
// /closed reference list, mirroring fetchBoardGatherings/fetchClosedGatherings
// in data/gatherings.ts exactly (same structure, same error-throwing pattern).

export interface BoardPoll extends AliasPoll {
  voteCount: number;
}

export async function fetchBoardPolls(organizerId: string): Promise<BoardPoll[]> {
  const { data: polls, error } = await supabase
    .from('alias_polls')
    .select('*')
    .eq('organizer_user_id', organizerId)
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw error;
  let list = (polls ?? []) as AliasPoll[];

  // Bulk query, not per-poll fetchPoll() — an expired-but-not-yet-visited
  // poll would otherwise still show as open on the Board until someone
  // loads its organize/vote page. The organizer's own existing
  // alias_polls_update_own policy already permits this (no new RLS
  // needed), so this can go through a normal update rather than the
  // narrower auto-close-on-expiry policy fetchPoll uses for anonymous
  // guests. Expired polls are closed here AND filtered out of the
  // returned list so the Board reflects reality immediately.
  const expiredIds = list.filter((p) => isExpired(p)).map((p) => p.id);
  if (expiredIds.length) {
    const closedAt = new Date().toISOString();
    const { error: closeError } = await supabase
      .from('alias_polls')
      .update({ status: 'closed', closed_at: closedAt })
      .in('id', expiredIds);
    if (closeError) console.error(closeError);
    const expiredSet = new Set(expiredIds);
    list = list.filter((p) => !expiredSet.has(p.id));
  }

  if (!list.length) return [];
  // Single batched count query, not N+1 — alias_poll_votes_public is the
  // same guest-safe view PollWall/PollVote already read from.
  const { data: votes, error: votesError } = await supabase
    .from('alias_poll_votes_public')
    .select('poll_id')
    .in('poll_id', list.map((p) => p.id));
  if (votesError) throw votesError;
  const counts = new Map<string, number>();
  for (const v of votes ?? []) counts.set(v.poll_id, (counts.get(v.poll_id) ?? 0) + 1);
  return list.map((p) => ({ ...p, voteCount: counts.get(p.id) ?? 0 }));
}

export interface ClosedPollSummary {
  id: string;
  title: string;
  closed_at: string | null;
}

export async function fetchClosedPolls(organizerId: string): Promise<ClosedPollSummary[]> {
  const { data, error } = await supabase
    .from('alias_polls')
    .select('id, title, closed_at')
    .eq('organizer_user_id', organizerId)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClosedPollSummary[];
}

export function formatDuration(startIso: string, endIso: string): string {
  const ms = Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime());
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  // Compact form ("12hr"), matching Figma's wrap-up "12hr duration" — the
  // day/minute branches stay full words since Figma only confirmed hours.
  if (hours < 24) return `${hours}hr`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

// Core countdown value shared by every "closes in X" display (share card,
// organizer live view, Board row, guest post-vote copy) — each call site
// wraps this in its own exact sentence rather than duplicating the date
// math. Deliberately plain body-font content everywhere it's rendered
// (never DM Mono) — a dynamic numeric string like this is exactly the kind
// of content that's tripped the DM-Mono-slashed-zero bug in prior rounds.
// Null closes_at (pre-migration polls only — every poll created after
// 0012_poll_close_date.sql always sets one) reads as "never expires".
export function formatCloseCountdown(closesAt: string | null): string {
  if (!closesAt) return 'never expires';
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return 'closed';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return 'closes soon';
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `closes in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `closes in ${days} day${days === 1 ? '' : 's'}`;
}
