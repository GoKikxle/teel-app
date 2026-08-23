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
      className={`flyer${cancelled ? ' flyer-cancelled' : ''}${isSplitBill ? ' flyer-receipt' : ''}`}
      onClick={onClick}
      style={{ '--accent': c.accent, '--accent-dark': c.dark } as React.CSSProperties}
    >
      <div className="pin" />
      {cancelled ? <div className="cancelled-flag">Cancelled</div> : g.cost_enabled && <PaidRing pct={pct} />}
      {/* Event cards only — Split Bill anchors on the amount/progress
          below instead of a photo slot. */}
      {!isSplitBill && g.cover_image_url && <div className="flyer-photo" style={{ backgroundImage: `url(${g.cover_image_url})` }} />}
      <div className="stripe" />
      <div className="cat">
        {isSplitBill ? 'Split bill' : c.label} <span className="vis-badge">{v.icon} {v.label}</span>
      </div>
      <div className="title">{g.title}</div>

      {isSplitBill && (
        <>
          <div className="receipt-tear" />
          <div className="receipt-amount">£{splitBillProgress(g).target.toFixed(2)}</div>
        </>
      )}

      <div className="meta">
        {isSplitBill ? (
          <>
            {fmtDate(g.gathering_date)} · {g.gathering_time || '—'}
            <br />
            £{splitBillProgress(g).collected.toFixed(2)} of £{splitBillProgress(g).target.toFixed(2)} collected
          </>
        ) : (
          <>
            {fmtDate(g.gathering_date)} · {g.gathering_time || '—'}
            <br />
            {g.location || 'TBD'}
            <br />
            {going.length}/{g.capacity} going
          </>
        )}
      </div>
    </button>
  );
}
