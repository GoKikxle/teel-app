export type Category = 'hike' | 'brunch' | 'game' | 'dj' | 'poetry' | 'other';
export type Visibility = 'public' | 'private' | 'invited';
export type CostMode = 'split_pay' | 'get_tix';
export type SplitMethod = 'equal' | 'custom' | 'itemized';
export type PayMode = 'direct' | 'stripe';
export type PayMethod = 'venmo' | 'paypal' | 'cashapp' | 'monzo' | 'revolut';

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
