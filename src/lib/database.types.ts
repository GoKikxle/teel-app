export type Category = 'hike' | 'brunch' | 'game' | 'dj' | 'poetry' | 'other';
export type Visibility = 'public' | 'private' | 'invited';
export type CostMode = 'split_pay' | 'get_tix';
// 'dutch': each guest types their own amount (Split Bill only) rather than
// Teel computing an equal share or the organizer setting one per person.
export type SplitMethod = 'equal' | 'custom' | 'itemized' | 'dutch';
export type PayMode = 'direct' | 'stripe';
export type PayMethod = 'venmo' | 'paypal' | 'cashapp' | 'monzo' | 'revolut';
// 'event': the full "New gathering" flow (RSVPs, guest list, poll, invites).
// 'split_bill': the lightweight quick-create flow — no RSVPs/names/guest
// list, just an amount and a payment link. Drives which panels Detail.tsx
// and FlyerCard.tsx render.
export type GatheringKind = 'event' | 'split_bill';

export interface Gathering {
  id: string;
  organizer_id: string;
  title: string;
  category: Category;
  gathering_date: string;
  gathering_time: string | null;
  location: string | null;
  capacity: number;
  cover_image_url: string | null;
  visibility: Visibility;
  cost_enabled: boolean;
  cost_mode: CostMode;
  cost_total: number;
  split_method: SplitMethod;
  pay_mode: PayMode;
  pay_method: PayMethod | null;
  pay_handle: string | null;
  stripe_account_id: string | null;
  poll_enabled: boolean;
  poll_question: string | null;
  reminder_on: boolean;
  created_at: string;
  /** Soft-cancel marker, organizer-only. Set when the organizer cancels the
   *  whole gathering; unlike an RSVP cancel, there's no un-cancel flow for
   *  this in v1. Every RSVP/cost_item/poll row underneath stays untouched —
   *  see the cancelled-state UI in Detail.tsx and getDeleteBlockReason() in
   *  src/data/gatherings.ts, which uses this to keep hard delete from
   *  destroying payment history. */
  cancelled_at: string | null;
  kind: GatheringKind;
}

export interface Rsvp {
  id: string;
  gathering_id: string;
  guest_user_id: string;
  name: string;
  phone: string | null;
  paid_sent: boolean;
  paid: boolean;
  created_at: string;
  /** Soft-cancel marker. Set when a guest cancels their own RSVP; cleared
   *  back to null if they RSVP again. paid_sent/paid are untouched by
   *  either transition — see activeRsvps() for where cancelled rows get
   *  filtered out of "who's in" / counts / the paid-progress ring. */
  cancelled_at: string | null;
  /** Split Bill ("dutch" split_method) only: what this guest typed as what
   *  they owe. Null for every other split_method — an equal-split guest's
   *  amount is always computed live from cost_total, never stored here. */
  amount_owed: number | null;
}

export interface CostItem {
  id: string;
  gathering_id: string;
  name: string;
  amount: number;
  position: number;
}

export interface PollOption {
  id: string;
  gathering_id: string;
  label: string;
  position: number;
}

export interface PollVote {
  id: string;
  poll_option_id: string;
  gathering_id: string;
  voter_user_id: string;
  created_at: string;
}

export interface InvitedEmail {
  id: string;
  gathering_id: string;
  email: string;
  accessed: boolean;
  created_at: string;
}

export interface GatheringWithRelations extends Gathering {
  rsvps: Rsvp[];
  cost_items: CostItem[];
  poll_options: (PollOption & { poll_votes: { id: string; voter_user_id: string }[] })[];
  invited_emails: InvitedEmail[];
}
