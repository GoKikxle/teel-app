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

  const isSplitBill = gathering.kind === 'split_bill';
  const isCancelled = Boolean(gathering.cancelled_at);
  const deleteBlockReason = getDeleteBlockReason(gathering);
  const cancelLabel = isSplitBill ? 'Close bill' : 'Cancel gathering';

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelGathering(gathering.id);
      toast(isSplitBill ? 'Bill closed' : 'Gathering cancelled');
      onChange();
    } catch (err) {
      console.error(err);
      toast(isSplitBill ? 'Could not close — try again' : 'Could not cancel — try again');
    } finally {
      setCancelling(false);
      setConfirmingCancel(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteGathering(gathering);
      toast(isSplitBill ? 'Bill deleted' : 'Gathering deleted');
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
          {isSplitBill ? (
            <>
              You closed this bill on{' '}
              {new Date(gathering.cancelled_at as string).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              . Guests can no longer pay.
            </>
          ) : (
            <>
              You cancelled this gathering on{' '}
              {new Date(gathering.cancelled_at as string).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              . Guests can no longer RSVP, vote or pay.
            </>
          )}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {/* Split Bills are never editable, full stop — there's no Edit
            screen for them to begin with, unlike the full flow. */}
        {!isSplitBill && (
          <button className="btn-outline" onClick={() => navigate(`/g/${gathering.id}/edit`)}>
            Edit gathering
          </button>
        )}

        {!isCancelled &&
          (!confirmingCancel ? (
            <button className="btn-outline" onClick={() => setConfirmingCancel(true)}>
              {cancelLabel}
            </button>
          ) : (
            <>
              <button className="btn-outline" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? (isSplitBill ? 'Closing…' : 'Cancelling…') : isSplitBill ? 'Confirm close' : 'Confirm cancel'}
              </button>
              <button className="btn-outline" onClick={() => setConfirmingCancel(false)} disabled={cancelling}>
                Back
              </button>
            </>
          ))}

        {!confirmingDelete ? (
          <button
            className="btn-outline"
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={() => setConfirmingDelete(true)}
            disabled={Boolean(deleteBlockReason)}
          >
            {isSplitBill ? 'Delete bill' : 'Delete gathering'}
          </button>
        ) : (
          <>
            <button
              className="btn-outline"
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
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
          {isSplitBill
            ? "Guests will see this bill marked as closed and won't be able to pay. Anyone who already paid keeps that history. This can't be undone from here."
            : "Guests will see this gathering marked as cancelled and won't be able to RSVP, vote or pay. Anyone who already RSVPed or paid keeps that history. This can't be undone from here."}
        </p>
      )}

      {deleteBlockReason && (
        <p style={{ marginTop: 10, marginBottom: 0, fontSize: 13, color: 'var(--danger)' }}>{deleteBlockReason}</p>
      )}

      {confirmingDelete && (
        <p className="poll-hint" style={{ marginTop: 10, marginBottom: 0 }}>
          {isSplitBill
            ? "This removes the bill for everyone — payment records included. Can't be undone."
            : "This removes the gathering for everyone — RSVPs, payments and poll votes included. Can't be undone."}
        </p>
      )}
    </div>
  );
}
