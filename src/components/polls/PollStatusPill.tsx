import type { CSSProperties } from 'react';

// Small filled-dot + pill, replacing the plain-text "Live · N votes"
// header. Structure borrows .hero-vis-badge/.hero-vis-dot (dot+pill) and
// .hero-cancelled-badge (accent-tinted pill). Figma's LIVE/CLOSED pills
// (confirmed in the Closed Poll and View Created Poll frames) render as
// plain Plus Jakarta Regular 12px with the literal uppercase text in the
// JSX itself — no CSS text-transform/letter-spacing/DM Mono doing that
// work — so the strings here are typed uppercase rather than relying on
// CSS to transform them. 'closed' is only ever reachable from PollWrapUp's
// header — PollOrganize's live view always passes 'open'.
export function PollStatusPill({ status, style }: { status: 'open' | 'closed'; style?: CSSProperties }) {
  const live = status === 'open';
  return (
    <span className={`poll-status-pill${live ? ' live' : ' closed'}`} style={style}>
      <span className="poll-status-dot" />
      {live ? 'LIVE' : 'CLOSED'}
    </span>
  );
}
