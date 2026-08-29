import { fmtDate } from '../lib/constants';
import { splitBillProgress } from '../data/gatherings';
import type { GatheringWithRelations } from '../lib/database.types';

// The Figma mock's amount text alternates between #F23506 (an old, retired
// accent color) and #FF2D55 (the current one) across two otherwise-identical
// example cards — a mock inconsistency, not two intentional states. Always
// using --accent here per the "accent reserved for amounts/progress" rule
// this task's own brief calls out.
export function BoardBillCard({ g, onClick }: { g: GatheringWithRelations; onClick: () => void }) {
  const progress = splitBillProgress(g);
  const pct = Math.min(100, Math.round((progress.paidCount / Math.max(g.capacity, 1)) * 100));

  return (
    <button className="board-card board-card-bill" onClick={onClick}>
      <div className="board-card-bill-icon">
        <img src="/icons/board/bill-badge-icon.svg" alt="" width={24} height={24} />
      </div>
      <div className="board-card-body">
        <div className="board-card-amount">${progress.target.toFixed(2)}</div>
        <div className="board-card-meta">
          {/* location is currently never set on split bills (see
              createSplitBill in data/gatherings.ts) — falls back to the
              title until Split Bill creation collects a venue. */}
          <div className="board-card-meta-row">{g.location || g.title}</div>
          <div className="board-card-meta-row">
            {fmtDate(g.gathering_date)}
            <span className="board-dot" />
            {g.gathering_time || '—'}
          </div>
          <div className="board-card-meta-row">
            ${progress.collected.toFixed(2)} of ${progress.target.toFixed(2)} collected
          </div>
        </div>
      </div>
      <div className="board-progress-ring" style={{ '--pct': pct } as React.CSSProperties}>
        <span>{pct}%</span>
      </div>
    </button>
  );
}
