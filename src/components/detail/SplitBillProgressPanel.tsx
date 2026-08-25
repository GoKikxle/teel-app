import type { GatheringWithRelations } from '../../lib/database.types';
import { splitBillProgress } from '../../data/gatherings';

// Organizer-facing view for a Split Bill gathering — aggregate progress
// only, no per-name roster. There's no guest list to show in the first
// place: guests are never asked for a name, so a "who's in" list would
// have nothing to display anyway.
export function SplitBillProgressPanel({ gathering }: { gathering: GatheringWithRelations }) {
  const { paidCount, targetCount, collected, target } = splitBillProgress(gathering);

  return (
    <div className="panel">
      <h2>Progress</h2>
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
