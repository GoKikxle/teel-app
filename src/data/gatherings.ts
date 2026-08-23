import { supabase } from '../lib/supabase';
import type {
  Category,
  CostItem,
  Gathering,
  GatheringKind,
  GatheringWithRelations,
  InvitedEmail,
  PayMethod,
  Rsvp,
  SplitMethod,
  Visibility,
} from '../lib/database.types';

const DETAIL_SELECT = `
  *,
  rsvps (*),
  cost_items (*),
  poll_options (*, poll_votes (id, voter_user_id)),
  invited_emails (*)
`;

export async function fetchBoardGatherings(): Promise<GatheringWithRelations[]> {
  const { data, error } = await supabase
    .from('gatherings')
    .select(DETAIL_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as GatheringWithRelations[];
}

export async function fetchGathering(id: string): Promise<GatheringWithRelations | null> {
  const { data, error } = await supabase.from('gatherings').select(DETAIL_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as unknown as GatheringWithRelations | null;
}

// Single-column lookup for Nav's contextual CTA (Split Bill vs New
// Gathering) when an anonymous visitor is looking at a gathering — avoids
// duplicating fetchGathering's full joined select just to read one field.
export async function fetchGatheringKind(id: string): Promise<GatheringKind | null> {
  const { data, error } = await supabase.from('gatherings').select('kind').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data?.kind as GatheringKind | undefined) ?? null;
}

export interface CreateGatheringInput {
  organizerId: string;
  title: string;
  category: Category;
  date: string;
  time: string;
  location: string;
  capacity: number;
  coverImageUrl: string | null;
  visibility: Visibility;
  invitedEmails: string[];
  costEnabled: boolean;
  splitMethod: SplitMethod;
  costTotal: number;
  items: { name: string; amount: number }[];
  payMethod: PayMethod;
  payHandle: string;
  pollEnabled: boolean;
  pollQuestion: string;
  pollOptions: string[];
}

export async function createGathering(input: CreateGatheringInput): Promise<string> {
  const { data: gathering, error } = await supabase
    .from('gatherings')
    .insert({
      organizer_id: input.organizerId,
      title: input.title,
      category: input.category,
      gathering_date: input.date,
      gathering_time: input.time || null,
      location: input.location || 'TBD',
      capacity: input.capacity,
      cover_image_url: input.coverImageUrl,
      visibility: input.visibility,
      cost_enabled: input.costEnabled,
      cost_mode: 'split_pay',
      cost_total: input.costTotal,
      split_method: input.splitMethod,
      pay_mode: 'direct',
      pay_method: input.payMethod,
      pay_handle: input.payHandle || null,
      poll_enabled: input.pollEnabled && input.pollOptions.length > 0,
      poll_question: input.pollQuestion || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  const gatheringId = gathering.id as string;

  if (input.costEnabled && input.splitMethod === 'itemized' && input.items.length) {
    const { error: itemsError } = await supabase.from('cost_items').insert(
      input.items.map((item, i) => ({
        gathering_id: gatheringId,
        name: item.name || 'Item',
        amount: item.amount,
        position: i,
      }))
    );
    if (itemsError) throw itemsError;
  }

  if (input.pollEnabled && input.pollOptions.length) {
    const { error: optsError } = await supabase.from('poll_options').insert(
      input.pollOptions.map((label, i) => ({ gathering_id: gatheringId, label, position: i }))
    );
    if (optsError) throw optsError;
  }

  if (input.visibility === 'invited' && input.invitedEmails.length) {
    const { error: emailsError } = await supabase.from('invited_emails').insert(
      input.invitedEmails.map((email) => ({ gathering_id: gatheringId, email }))
    );
    if (emailsError) throw emailsError;
  }

  return gatheringId;
}

// --- Split Bill -----------------------------------------------------------
// The lightweight quick-create flow: an amount, a split rule, a payment
// link — no RSVPs, no names, no guest list. Shares the gatherings table
// (kind = 'split_bill' is what Detail.tsx/FlyerCard.tsx key off of) rather
// than a separate table, so cancel/delete and the cost columns all work
// the same way they already do for a full gathering.

export interface CreateSplitBillInput {
  organizerId: string;
  // Both optional: omit title for the auto-generated one below, omit date
  // for today. Split Bill never asks for a time at all (unlike the full
  // flow) — gathering_time is always just whatever time it was created.
  title?: string;
  date?: string; // YYYY-MM-DD
  totalAmount: number;
  numberOfPeople: number;
  splitMethod: 'equal' | 'dutch';
  payMethod: PayMethod;
  payHandle: string;
}

function splitBillTitle(dateStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(`${dateStr}T00:00`);
  return `Split bill · ${d.getDate()} ${months[d.getMonth()]}`;
}

export async function createSplitBill(input: CreateSplitBillInput): Promise<string> {
  const now = new Date();
  const gatheringDate = input.date || now.toISOString().slice(0, 10);
  const { data: gathering, error } = await supabase
    .from('gatherings')
    .insert({
      organizer_id: input.organizerId,
      title: input.title?.trim() || splitBillTitle(gatheringDate),
      category: 'other',
      gathering_date: gatheringDate,
      gathering_time: now.toTimeString().slice(0, 5),
      location: null,
      capacity: input.numberOfPeople,
      cover_image_url: null,
      visibility: 'private',
      cost_enabled: true,
      cost_mode: 'split_pay',
      cost_total: input.totalAmount,
      split_method: input.splitMethod,
      pay_mode: 'direct',
      pay_method: input.payMethod,
      pay_handle: input.payHandle || null,
      poll_enabled: false,
      kind: 'split_bill',
    })
    .select('id')
    .single();

  if (error) throw error;
  return gathering.id as string;
}

// Silently creates (or updates) a guest's bare payment record — no name,
// no phone — the moment they interact with the pay flow, keyed on
// (gathering_id, guest_user_id) exactly like upsertRsvp. amountOwed is only
// ever meaningful for split_method = 'dutch'; omit it for 'equal', where
// the per-person share is always computed live from cost_total instead of
// stored per row. Returns the row's id so the caller can immediately follow
// up with markPaidSent/markPaid.
export async function upsertSplitBillPayment(
  gatheringId: string,
  guestUserId: string,
  amountOwed?: number
): Promise<string> {
  const { data, error } = await supabase
    .from('rsvps')
    .upsert(
      { gathering_id: gatheringId, guest_user_id: guestUserId, name: '', amount_owed: amountOwed ?? null, cancelled_at: null },
      { onConflict: 'gathering_id,guest_user_id' }
    )
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

// Equal-split share, computed live and never stored — used both for what a
// guest owes (SplitBillPayPanel) and for totaling up equal-split progress
// (splitBillProgress below).
export function splitBillPerPerson(gathering: Pick<Gathering, 'cost_total' | 'capacity'>): number {
  return gathering.cost_total / Math.max(gathering.capacity, 1);
}

export interface SplitBillProgress {
  paidCount: number;
  targetCount: number;
  collected: number;
  target: number;
}

// Deliberately *not* paidPct/activeRsvps-percentage math: that computes
// progress against however many guests have shown up so far, but a Split
// Bill's "X of Y paid" is against the organizer's target headcount
// (capacity) and target total (cost_total), which won't generally equal
// the number of payment records that exist yet.
export function splitBillProgress(
  gathering: Pick<GatheringWithRelations, 'rsvps' | 'capacity' | 'cost_total' | 'split_method'>
): SplitBillProgress {
  const paid = activeRsvps(gathering).filter((r) => r.paid);
  const collected =
    gathering.split_method === 'dutch'
      ? paid.reduce((sum, r) => sum + Number(r.amount_owed ?? 0), 0)
      : paid.length * splitBillPerPerson(gathering);

  return { paidCount: paid.length, targetCount: gathering.capacity, collected, target: gathering.cost_total };
}

export interface UpdateGatheringInput {
  title: string;
  category: Category;
  date: string;
  time: string;
  location: string;
  capacity: number;
  coverImageUrl: string | null;
  visibility: Visibility;
  costEnabled: boolean;
  splitMethod: SplitMethod;
  costTotal: number;
  payMethod: PayMethod;
  payHandle: string;
  pollEnabled: boolean;
  pollQuestion: string;
}

// Updates the gathering's own columns only. Cost items, poll options and
// invited emails are separate tables — see replaceCostItems/syncInvitedEmails
// below. Poll *options* are deliberately never touched here: they're
// immutable after creation because poll_votes cascade-deletes off them, and
// silently wiping votes on an unrelated edit (e.g. changing the location)
// would be a real data-loss bug, not a simplification.
export async function updateGathering(id: string, input: UpdateGatheringInput) {
  const { error } = await supabase
    .from('gatherings')
    .update({
      title: input.title,
      category: input.category,
      gathering_date: input.date,
      gathering_time: input.time || null,
      location: input.location || 'TBD',
      capacity: input.capacity,
      cover_image_url: input.coverImageUrl,
      visibility: input.visibility,
      cost_enabled: input.costEnabled,
      cost_total: input.costTotal,
      split_method: input.splitMethod,
      pay_method: input.payMethod,
      pay_handle: input.payHandle || null,
      poll_enabled: input.pollEnabled,
      poll_question: input.pollQuestion || null,
    })
    .eq('id', id);
  if (error) throw error;
}

// cost_items has no dependents, so a full replace on every save is safe —
// unlike poll_options, nothing downstream references a specific item's id.
export async function replaceCostItems(gatheringId: string, items: { name: string; amount: number }[]) {
  const { error: deleteError } = await supabase.from('cost_items').delete().eq('gathering_id', gatheringId);
  if (deleteError) throw deleteError;
  if (items.length) {
    const { error: insertError } = await supabase.from('cost_items').insert(
      items.map((item, i) => ({ gathering_id: gatheringId, name: item.name || 'Item', amount: item.amount, position: i }))
    );
    if (insertError) throw insertError;
  }
}

// Insert-only poll option creation, used when an edited gathering never had
// poll options in the first place (poll was off, or created without any).
// Never call this if gathering.poll_options.length > 0 already — that's the
// case update() must leave alone.
export async function createPollOptions(gatheringId: string, labels: string[]) {
  if (!labels.length) return;
  const { error } = await supabase.from('poll_options').insert(
    labels.map((label, i) => ({ gathering_id: gatheringId, label, position: i }))
  );
  if (error) throw error;
}

// Diffs against the existing invited_emails rows rather than a full replace,
// so an email that already has accessed=true keeps that status instead of
// being deleted and recreated as "pending".
export async function syncInvitedEmails(gatheringId: string, emails: string[], existing: InvitedEmail[]) {
  const targetLower = new Set(emails.map((e) => e.toLowerCase()));
  const existingLower = new Set(existing.map((e) => e.email.toLowerCase()));

  const toRemove = existing.filter((e) => !targetLower.has(e.email.toLowerCase()));
  const toAdd = emails.filter((e) => !existingLower.has(e.toLowerCase()));

  if (toRemove.length) {
    const { error } = await supabase.from('invited_emails').delete().in('id', toRemove.map((e) => e.id));
    if (error) throw error;
  }
  if (toAdd.length) {
    const { error } = await supabase.from('invited_emails').insert(toAdd.map((email) => ({ gathering_id: gatheringId, email })));
    if (error) throw error;
  }
}

// Hard delete is only safe when there's no history left to lose: any active
// RSVP means real guests are currently counting on this gathering existing,
// and a payment mark (paid_sent/paid) on *any* row — even one whose RSVP was
// itself cancelled — means a guest has a payment record that a cascade
// delete would destroy forever. Cancel is the reversible-in-spirit way to
// take a gathering down without doing that; this returns the reason so the
// UI can show it rather than just disabling the button silently.
export function getDeleteBlockReason(gathering: Pick<GatheringWithRelations, 'rsvps'>): string | null {
  const active = activeRsvps(gathering).length;
  if (active > 0) {
    return `${active} guest${active === 1 ? ' has' : 's have'} an active RSVP. Cancel the gathering instead — delete is only for gatherings with no guests.`;
  }
  if (gathering.rsvps.some((r) => r.paid_sent || r.paid)) {
    return 'A guest has payment history on this gathering (including a cancelled RSVP). Cancel instead of deleting so that history stays visible.';
  }
  return null;
}

// DB foreign keys (rsvps, cost_items, poll_options, poll_votes,
// invited_emails -> gatherings) all cascade, so the row delete alone cleans
// up every related table. Postgres cascade can't reach Supabase Storage
// though, so the cover image has to be removed explicitly first.
export async function deleteGathering(gathering: Pick<GatheringWithRelations, 'id' | 'cover_image_url' | 'rsvps'>) {
  const blockReason = getDeleteBlockReason(gathering);
  if (blockReason) throw new Error(blockReason);
  await deleteCoverImage(gathering.cover_image_url);
  const { error } = await supabase.from('gatherings').delete().eq('id', gathering.id);
  if (error) throw error;
}

// Cover photos come straight from a phone camera roll with zero processing —
// seen in production up to 26MB / 7728x5152, EXIF intact. That's not just a
// page-weight problem: link-preview crawlers (WhatsApp's especially) fetch
// og:image on their own budget and silently drop the thumbnail (while still
// showing title/description) if it's too large or slow, which is exactly
// what surfaced this. So every cover photo gets downscaled and re-encoded
// as JPEG before it ever reaches Storage — this runs for every upload, not
// just the ones destined for a link preview, since the same 26MB file was
// also being downloaded by every browser visiting the board or the
// gathering's own page.
const MAX_COVER_DIMENSION = 1600; // px, longest side — plenty for a flyer-sized display, nowhere near camera-original
const COVER_JPEG_QUALITY_STEPS = [0.82, 0.7, 0.55]; // retried smaller only if the previous pass is still oversized
const MAX_COVER_BYTES = 1_500_000; // ~1.5MB ceiling, comfortably under known link-preview fetch limits

async function resizeCoverImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_COVER_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);

    let lastBlob: Blob | null = null;
    for (const quality of COVER_JPEG_QUALITY_STEPS) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob) continue;
      lastBlob = blob;
      if (blob.size <= MAX_COVER_BYTES) return blob;
    }
    // Every quality step ran and it's still over budget (an unusually
    // busy/detailed photo) — ship the smallest one we got rather than
    // fail the upload outright.
    if (!lastBlob) throw new Error('Could not encode cover image');
    return lastBlob;
  } finally {
    bitmap.close();
  }
}

export async function uploadCoverImage(file: File, organizerId: string): Promise<string> {
  const blob = await resizeCoverImage(file);
  const path = `${organizerId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('cover-images').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  const { data } = supabase.storage.from('cover-images').getPublicUrl(path);
  return data.publicUrl;
}

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length));
}

async function deleteCoverImage(coverImageUrl: string | null) {
  if (!coverImageUrl) return;
  const path = extractStoragePath(coverImageUrl, 'cover-images');
  if (!path) return;
  const { error } = await supabase.storage.from('cover-images').remove([path]);
  if (error) {
    // Non-fatal: an orphaned storage object shouldn't block the gathering
    // (or its row) from being deleted.
    console.error('Failed to remove cover image from storage', error);
  }
}

// --- RSVP -------------------------------------------------------------

// A gathering's "who's in" list, guest count, per-person split, and paid
// ring all mean "active (non-cancelled) RSVPs" — this is the one place that
// decides what counts as active, so every consumer stays in sync with
// cancelRsvp/upsertRsvp below rather than re-deriving the rule per-component.
export function activeRsvps(gathering: Pick<GatheringWithRelations, 'rsvps'>): Rsvp[] {
  return gathering.rsvps.filter((r) => !r.cancelled_at);
}

// Upsert on (gathering_id, guest_user_id) — the same row is reused whether
// this is a first RSVP or a guest un-cancelling. cancelled_at is explicitly
// cleared here; paid_sent/paid are deliberately NOT included in this payload
// so a re-RSVP never disturbs whatever payment history the row already has.
export async function upsertRsvp(gatheringId: string, guestUserId: string, name: string, phone: string) {
  const { error } = await supabase.from('rsvps').upsert(
    { gathering_id: gatheringId, guest_user_id: guestUserId, name, phone: phone || null, cancelled_at: null },
    { onConflict: 'gathering_id,guest_user_id' }
  );
  if (error) throw error;
}

// Soft-cancel, not a delete: paid_sent/paid live on this same row, so
// deleting it would erase payment history along with the RSVP. Scoped by
// the rsvps_update_own RLS policy (USING guest_user_id = auth.uid()), which
// Postgres also applies as the implicit WITH CHECK when none is given — so
// this can only ever match/update the caller's own row, never anyone else's,
// regardless of what gatheringId/guestUserId a client sends.
export async function cancelRsvp(gatheringId: string, guestUserId: string) {
  const { error } = await supabase
    .from('rsvps')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('gathering_id', gatheringId)
    .eq('guest_user_id', guestUserId);
  if (error) throw error;
}

// --- Gathering cancel ---------------------------------------------------

// Organizer-only soft-cancel of the whole gathering, same shape as
// cancelRsvp above: set cancelled_at, leave every other column (and every
// child row) untouched. Scoped by the gatherings_update_own RLS policy
// (USING organizer_id = auth.uid()), so this can only ever match the
// caller's own gathering. There's deliberately no un-cancel counterpart —
// unlike an RSVP cancel, this isn't reversible from the UI in v1.
export async function cancelGathering(gatheringId: string) {
  const { error } = await supabase
    .from('gatherings')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('id', gatheringId);
  if (error) throw error;
}

export async function markPaidSent(rsvpId: string, value: boolean) {
  const { error } = await supabase.from('rsvps').update({ paid_sent: value }).eq('id', rsvpId);
  if (error) throw error;
}

export async function markPaid(rsvpId: string, value: boolean) {
  const { error } = await supabase.from('rsvps').update({ paid: value }).eq('id', rsvpId);
  if (error) throw error;
}

// --- Poll ---------------------------------------------------------------

export async function castVote(gatheringId: string, pollOptionId: string, voterUserId: string) {
  const { error } = await supabase
    .from('poll_votes')
    .insert({ gathering_id: gatheringId, poll_option_id: pollOptionId, voter_user_id: voterUserId });
  if (error) throw error;
}

// --- Invited emails -------------------------------------------------------

export async function addInvitedEmail(gatheringId: string, email: string) {
  const { error } = await supabase.from('invited_emails').insert({ gathering_id: gatheringId, email });
  if (error) throw error;
}

export async function removeInvitedEmail(id: string) {
  const { error } = await supabase.from('invited_emails').delete().eq('id', id);
  if (error) throw error;
}

export async function markEmailAccessed(gatheringId: string, email: string) {
  const { error } = await supabase
    .from('invited_emails')
    .update({ accessed: true })
    .eq('gathering_id', gatheringId)
    .ilike('email', email);
  if (error) throw error;
}

// --- Misc -------------------------------------------------------------

export async function toggleReminder(gatheringId: string, value: boolean) {
  const { error } = await supabase.from('gatherings').update({ reminder_on: value }).eq('id', gatheringId);
  if (error) throw error;
}

export function itemizedTotal(items: CostItem[]): number {
  return items.reduce((sum, item) => sum + Number(item.amount), 0);
}

export function paidPct(g: Gathering, rsvpCount: number, paidCount: number): number {
  if (!g.cost_enabled) return 0;
  const base = Math.max(rsvpCount, 1);
  return Math.min(100, Math.round((paidCount / base) * 100));
}
