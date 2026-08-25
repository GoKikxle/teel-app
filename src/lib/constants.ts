import type { Category, PayMethod, Visibility } from './database.types';

// Categories are text-only now — no per-category accent color. The one
// brand accent is reserved for primary actions/active states/hero numbers,
// never category coding (see src/index.css's :root token comments).
export const CATS: Record<Category, { label: string }> = {
  hike_sports: { label: 'Hike & sports' },
  travel_holiday: { label: 'Travel & Holiday' },
  food: { label: 'Food' },
  music_art: { label: 'Music & art' },
  other: { label: 'Other' },
};

export const VIS: Record<Visibility, { label: string; icon: string; desc: string }> = {
  public: { label: 'Public', icon: '○', desc: 'Anyone can find and access this gathering.' },
  private: { label: 'Private', icon: '●', desc: 'Only people you share the link with can view or RSVP.' },
  invited: { label: 'Invited only', icon: '✉', desc: 'Only the email addresses you add can access this gathering.' },
};

export const PAY_LABELS: Record<PayMethod, string> = {
  venmo: 'Venmo',
  paypal: 'PayPal',
  cashapp: 'Cash App',
  monzo: 'Monzo',
  revolut: 'Revolut',
};

// Rotating neutral shades so adjacent avatars in a stack stay visually
// distinct without reintroducing category-style multi-hue color coding.
export const AVATAR_COLORS = ['#1A1A1A', '#5B5B60', '#8B8B90', '#3D3D40', '#707075'];

export function payLabel(method: PayMethod | null): string {
  return method ? PAY_LABELS[method] : 'payment link';
}

export function buildPayUrl(method: PayMethod | null, handle: string | null, amount: string | number, note: string): string {
  const h = handle || 'organizer';
  switch (method) {
    case 'venmo':
      return `https://venmo.com/${h}?txn=pay&amount=${amount}&note=${encodeURIComponent(note)}`;
    case 'paypal':
      return `https://paypal.me/${h}/${amount}`;
    case 'cashapp':
      return `https://cash.app/$${h}/${amount}`;
    case 'monzo':
      return `https://monzo.me/${h}/${amount}`;
    case 'revolut':
      return `https://revolut.me/${h}`;
    default:
      return '#';
  }
}

export function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
