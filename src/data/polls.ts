import { supabase } from '../lib/supabase';
import type { AliasPoll, AliasPollOption, AliasPollVote, AliasPollVotePublic, ChartStyle, LinkMeta } from '../lib/database.types';

// --- Alias generation ----------------------------------------------------
// Word lists and makeAlias() ported verbatim from the reviewed prototype.

const AVATARS = ['🦩', '🦊', '🐙', '🐝', '🦥', '🦔', '🦉', '🐿️', '🦖', '🐢', '🦜', '🐬', '🦄', '🐨', '🦦', '🐧'];
const ADJ = [
  'Excited', 'Sneaky', 'Cosmic', 'Velvet', 'Bashful', 'Turbo', 'Lucky', 'Feral',
  'Cheerful', 'Rogue', 'Dazzling', 'Sleepy', 'Bold', 'Curious', 'Glorious', 'Nimble',
];
const NOUN = [
  'Flamingo', 'Fox', 'Octopus', 'Bee', 'Sloth', 'Hedgehog', 'Owl', 'Squirrel',
  'Raptor', 'Turtle', 'Parrot', 'Dolphin', 'Unicorn', 'Koala', 'Otter', 'Penguin',
];

function randOf<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface Alias {
  avatar: string;
  name: string;
}

export function makeAlias(): Alias {
  return { avatar: randOf(AVATARS), name: `${randOf(ADJ)} ${randOf(NOUN)}` };
}

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
  emoji: string | null;
  image_url: string | null;
  link_url: string | null;
  link_meta: LinkMeta | null;
}

export interface CreatePollInput {
  organizerId: string;
  title: string;
  chartStyle: ChartStyle;
  suspenseMode: boolean;
  commentsLive: boolean;
  allowMessages: boolean;
  options: CreatePollOptionInput[];
}

export async function createPoll(input: CreatePollInput): Promise<string> {
  const { data: poll, error: pollError } = await supabase
    .from('alias_polls')
    .insert({
      organizer_user_id: input.organizerId,
      title: input.title,
      chart_style: input.chartStyle,
      suspense_mode: input.suspenseMode,
      comments_live: input.commentsLive,
      allow_messages: input.allowMessages,
    })
    .select('id')
    .single();
  if (pollError) throw pollError;

  const pollId = poll.id as string;
  const rows = input.options.map((opt, position) => ({
    poll_id: pollId,
    label: opt.label,
    position,
    emoji: opt.emoji,
    image_url: opt.image_url,
    link_url: opt.link_url,
    link_meta: opt.link_meta,
  }));
  const { error: optionsError } = await supabase.from('alias_poll_options').insert(rows);
  if (optionsError) throw optionsError;

  return pollId;
}

export async function fetchPoll(id: string): Promise<AliasPoll | null> {
  const { data, error } = await supabase.from('alias_polls').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as AliasPoll | null;
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

export function optionHasBadge(option: Pick<AliasPollOption, 'image_url' | 'link_url' | 'emoji'>): boolean {
  return Boolean(option.image_url || option.link_url || option.emoji);
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

export function formatDuration(startIso: string, endIso: string): string {
  const ms = Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime());
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}
