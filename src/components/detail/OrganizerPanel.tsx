import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GatheringWithRelations } from '../../lib/database.types';
import { cancelGathering, deleteGathering, getDeleteBlockReason } from '../../data/gatherings';
import { useToast } from '../../hooks/useToast';

export function OrganizerPanel({ gathering, onChange }: { gathering: GatheringWithRelations; onChange: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isCancelled = Boolean(gathering.cancelled_at);
  const deleteBlockReason = getDeleteBlockReason(gathering);

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelGathering(gathering.id);
      toast('Gathering cancelled');
      onChange();
    } catch (err) {
      console.error(err);
      toast('Could not cancel — try again');
    } finally {
      setCancelling(false);
      setConfirmingCancel(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteGathering(gathering);
      toast('Gathering deleted');
      navigate('/');
    } catch (err) {
      console.error(err);
      toast('Could not delete — try again');
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="panel">
      <h2>Organizer tools</h2>

      {isCancelled && (
        <p className="poll-hint" style={{ marginTop: 0 }}>
          You cancelled this gathering on{' '}
          {new Date(gathering.cancelled_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.
          Guests can no longer RSVP, vote or pay.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn-outline" onClick={() => navigate(`/g/${gathering.id}/edit`)}>
          Edit gathering
        </button>

        {!isCancelled &&
          (!confirmingCancel ? (
            <button className="btn-outline" onClick={() => setConfirmingCancel(true)}>
              Cancel gathering
            </button>
          ) : (
            <>
              <button className="btn-outline" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? 'Cancelling…' : 'Confirm cancel'}
              </button>
              <button className="btn-outline" onClick={() => setConfirmingCancel(false)} disabled={cancelling}>
                Back
              </button>
            </>
          ))}

        {!confirmingDelete ? (
          <button
            className="btn-outline"
            style={{ color: 'var(--clay)', borderColor: 'var(--clay)' }}
            onClick={() => setConfirmingDelete(true)}
            disabled={Boolean(deleteBlockReason)}
          >
            Delete gathering
          </button>
        ) : (
          <>
            <button
              className="btn-outline"
              style={{ color: 'var(--clay)', borderColor: 'var(--clay)' }}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Confirm delete'}
            </button>
            <button className="btn-outline" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
              Cancel
            </button>
          </>
        )}
      </div>

      {confirmingCancel && (
        <p className="poll-hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Guests will see this gathering marked as cancelled and won't be able to RSVP, vote or pay. Anyone who already
          RSVPed or paid keeps that history. This can't be undone from here.
        </p>
      )}

      {deleteBlockReason && (
        <p style={{ marginTop: 10, marginBottom: 0, fontSize: 13, color: 'var(--clay)' }}>{deleteBlockReason}</p>
      )}

      {confirmingDelete && (
        <p className="poll-hint" style={{ marginTop: 10, marginBottom: 0 }}>
          This removes the gathering for everyone — RSVPs, payments and poll votes included. Can't be undone.
        </p>
      )}
    </div>
  );
}
