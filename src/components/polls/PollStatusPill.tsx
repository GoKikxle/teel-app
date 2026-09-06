import type { CSSProperties } from 'react';

// Small filled-dot + uppercase/letterspaced pill, replacing the plain-text
// "Live · N votes" header. Structure borrows .hero-vis-badge/.hero-vis-dot
// (dot+pill) and .hero-cancelled-badge (accent-tinted pill); typography
// borrows .poll-hidden-tag (uppercase, letterspaced, DM Mono). 'closed' is
// only ever reachable from PollWrapUp's header — PollOrganize's live view
// always passes 'open'.
export function PollStatusPill({ status, style }: { status: 'open' | 'closed'; style?: CSSProperties }) {
  const live = status === 'open';
  return (
    <span className={`poll-status-pill${live ? ' live' : ' closed'}`} style={style}>
      <span className="poll-status-dot" />
      {live ? 'Live' : 'Closed'}
    </span>
  );
}
