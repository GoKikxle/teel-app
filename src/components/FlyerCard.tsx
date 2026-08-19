import type { GatheringWithRelations } from '../lib/database.types';
import { CATS, VIS, fmtDate } from '../lib/constants';
import { activeRsvps, paidPct } from '../data/gatherings';
import { PaidRing } from './PaidRing';

export function FlyerCard({ g, onClick }: { g: GatheringWithRelations; onClick: () => void }) {
  const c = CATS[g.category];
  const v = VIS[g.visibility];
  const cancelled = Boolean(g.cancelled_at);
  const going = activeRsvps(g);
  const paidCount = going.filter((r) => r.paid).length;
  const pct = paidPct(g, going.length, paidCount);

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
        {going.length}/{g.capacity} going
      </div>
    </button>
  );
}
