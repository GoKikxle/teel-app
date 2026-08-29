import type { GatheringWithRelations } from '../../lib/database.types';
import { splitBillProgress } from '../../data/gatherings';
import { PaidRing } from '../PaidRing';

// Organizer-facing view for a Split Bill gathering — aggregate progress
// only, no per-name roster. There's no guest list to show in the first
// place: guests are never asked for a name, so a "who's in" list would
// have nothing to display anyway.
export function SplitBillProgressPanel({ gathering }: { gathering: GatheringWithRelations }) {
  const { paidCount, targetCount, collected, target } = splitBillProgress(gathering);
  const pct = target > 0 ? Math.round((collected / target) * 100) : 0;

  return (
    <div className="panel">
      <div className="split-head">
        <h2 style={{ marginBottom: 0 }}>Progress</h2>
        <PaidRing pct={pct} size={40} />
      </div>
      <p className="capline">
        {paidCount} of {targetCount} paid
      </p>
      <p style={{ fontWeight: 800, fontSize: 30, color: 'var(--accent)', margin: '0 0 4px' }}>
        £{collected.toFixed(2)}{' '}
        <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--ink-faint)' }}>
          of £{target.toFixed(2)} collected
        </span>
      </p>
    </div>
  );
}
