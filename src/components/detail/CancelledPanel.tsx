import type { GatheringWithRelations } from '../../lib/database.types';

// Replaces RsvpPanel/InvitePanel/PollPanel entirely once the organizer has
// cancelled the gathering — those all assume the event is still happening.
// SplitPayPanel stays visible (in read-only mode) alongside this rather than
// being replaced too, since a guest's payment history needs to stay visible,
// just clearly marked as belonging to a cancelled event — see Detail.tsx.
export function CancelledPanel({ gathering }: { gathering: GatheringWithRelations }) {
  const cancelledDate = gathering.cancelled_at
    ? new Date(gathering.cancelled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="panel cancelled-panel">
      <h2>This gathering was cancelled</h2>
      <p className="lede" style={{ margin: 0, maxWidth: 'none' }}>
        The organizer cancelled {gathering.title}{cancelledDate ? ` on ${cancelledDate}` : ''}. RSVPs, voting and
        payments are closed for this gathering.
      </p>
    </div>
  );
}
