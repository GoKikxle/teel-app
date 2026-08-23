import type { GatheringWithRelations } from '../lib/database.types';
import { CATS, VIS, fmtDate } from '../lib/constants';
import { activeRsvps, paidPct, splitBillProgress } from '../data/gatherings';
import { PaidRing } from './PaidRing';

export function FlyerCard({ g, onClick }: { g: GatheringWithRelations; onClick: () => void }) {
  const c = CATS[g.category];
  const v = VIS[g.visibility];
  const cancelled = Boolean(g.cancelled_at);
  const isSplitBill = g.kind === 'split_bill';
  const going = activeRsvps(g);
  const paidCount = going.filter((r) => r.paid).length;
  // Split Bill's ring tracks progress against the organizer's target
  // headcount (capacity), not however many payment records exist so far —
  // same reasoning as splitBillProgress() in data/gatherings.ts.
  const pct = isSplitBill
    ? Math.min(100, Math.round((splitBillProgress(g).paidCount / Math.max(g.capacity, 1)) * 100))
    : paidPct(g, going.length, paidCount);

  return (
    <button
      className={`flyer${cancelled ? ' flyer-cancelled' : ''}`}
      onClick={onClick}
      style={{ '--accent': c.accent, '--accent-dark': c.dark } as React.CSSProperties}
    >
      <div className="pin" />
      {cancelled ? <div className="cancelled-flag">Cancelled</div> : g.cost_enabled && <PaidRing pct={pct} />}
      {g.cover_image_url && <div className="flyer-photo" style={{ backgroundImage: `url(${g.cover_image_url})` }} />}
      <div className="stripe" />
      <div className="cat">
        {c.label} <span className="vis-badge">{v.icon} {v.label}</span>
      </div>
      <div className="title">{g.title}</div>
      <div className="meta">
        {fmtDate(g.gathering_date)} · {g.gathering_time || '—'}
        <br />
        {g.location || 'TBD'}
        <br />
        {isSplitBill ? (
          <>£{splitBillProgress(g).collected.toFixed(2)} of £{splitBillProgress(g).target.toFixed(2)} collected</>
        ) : (
          <>
            {going.length}/{g.capacity} going
          </>
        )}
      </div>
    </button>
  );
}
