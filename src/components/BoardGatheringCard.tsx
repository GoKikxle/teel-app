import { activeRsvps } from '../data/gatherings';
import { fmtDate } from '../lib/constants';
import type { GatheringWithRelations } from '../lib/database.types';

// Rotation for the small overlapping avatar circles on this card — deliberately
// its own palette, not the app-wide AVATAR_COLORS (see lib/constants.ts, which
// is intentionally neutral for the rest of the app). This one matches the
// colorful set from the "Komon board" Figma frames' Avatar Group component,
// scoped to just this new board card so it doesn't change avatar coloring
// anywhere else (Detail's RSVP list, etc).
const BOARD_AVATAR_COLORS = ['#0088ff', '#00c8b3', '#f050f9', '#000000'];

// See public/board/gathering-placeholder.jpg — not supplied yet. Referenced
// as a CSS background-image (not <img src>) so a missing file falls back to
// the neutral fill below instead of a broken-image icon.
export function BoardGatheringCard({ g, onClick }: { g: GatheringWithRelations; onClick: () => void }) {
  const going = activeRsvps(g);
  const shown = going.slice(0, 3);
  const extra = going.length - shown.length;

  return (
    <button className="board-card board-card-gathering" onClick={onClick}>
      <div className="board-card-body">
        <div className="board-card-title">{g.title}</div>
        <div className="board-card-meta">
          <div className="board-card-meta-row">
            {fmtDate(g.gathering_date)}
            <span className="board-dot" />
            {g.gathering_time || '—'}
          </div>
          <div className="board-card-meta-row">{g.location || 'TBD'}</div>
          <div className="board-card-meta-row">
            {going.length}/{g.capacity} Going
            <span className="board-dot" />
            <div className="board-avatar-group">
              {shown.map((r, i) => (
                <div
                  key={r.id}
                  className="board-avatar"
                  style={{ background: BOARD_AVATAR_COLORS[i % BOARD_AVATAR_COLORS.length] }}
                >
                  {(r.name || 'G').trim().charAt(0).toUpperCase()}
                </div>
              ))}
              {extra > 0 && (
                <div className="board-avatar" style={{ background: '#000' }}>
                  +{extra}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div
        className="board-card-thumb"
        style={{ backgroundImage: `url(${g.cover_image_url || '/board/gathering-placeholder.jpg'})` }}
      />
    </button>
  );
}
