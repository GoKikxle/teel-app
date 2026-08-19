import type { Category, PayMethod, Visibility } from './database.types';

export const CATS: Record<Category, { label: string; accent: string; dark: string }> = {
  hike: { label: 'Hike & trip', accent: 'var(--moss)', dark: 'var(--moss)' },
  brunch: { label: 'Brunch', accent: 'var(--marigold)', dark: 'var(--marigold)' },
  game: { label: 'Game night', accent: 'var(--violet)', dark: 'var(--violet)' },
  dj: { label: 'DJ session', accent: 'var(--clay)', dark: 'var(--clay)' },
  poetry: { label: 'Poetry night', accent: 'var(--berry)', dark: 'var(--berry)' },
  other: { label: 'Gathering', accent: 'var(--ink-faint)', dark: 'var(--ink-soft)' },
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

export const AVATAR_COLORS = ['var(--moss)', 'var(--marigold)', 'var(--violet)', 'var(--clay)', 'var(--berry)'];

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
