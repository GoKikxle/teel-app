import { Wordmark } from './Wordmark';

// The icon+lettermark pair, exactly as Figma's "Full Logo" component (icon
// 24x24, lettermark 16px tall, 4px gap) — used in the waitlist page header
// and the signup modal, both of which show the full lockup rather than the
// lettermark alone (see Wordmark.tsx, used solo in Nav.tsx elsewhere).
export function Logo() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <img src="/icon.svg" alt="" width={24} height={24} />
      <Wordmark height={16} />
    </span>
  );
}
