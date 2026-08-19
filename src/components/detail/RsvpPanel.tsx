import { useState } from 'react';
import type { GatheringWithRelations, Rsvp } from '../../lib/database.types';
import { AvatarStack } from '../AvatarStack';
import { activeRsvps, upsertRsvp, cancelRsvp } from '../../data/gatherings';
import { useToast } from '../../hooks/useToast';

export function RsvpPanel({
  gathering,
  userId,
  myRsvp,
  onChange,
}: {
  gathering: GatheringWithRelations;
  userId: string;
  myRsvp: Rsvp | undefined;
  onChange: () => void;
}) {
  const toast = useToast();
  const [expanding, setExpanding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const going = activeRsvps(gathering);
  const names = going.map((r) => r.name);

  async function confirmRsvp() {
    if (!name.trim()) {
      toast('Add your name to RSVP');
      return;
    }
    setSaving(true);
    try {
      await upsertRsvp(gathering.id, userId, name.trim(), phone.trim());
      setExpanding(false);
      onChange();
    } catch (err) {
      console.error(err);
      toast('Could not RSVP — try again');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    try {
      await cancelRsvp(gathering.id, userId);
      onChange();
    } catch (err) {
      console.error(err);
      toast('Could not cancel RSVP');
    }
  }

  return (
    <div className="panel">
      <h2>Who's in</h2>
      <p className="capline">
        {going.length} of {gathering.capacity} spots taken
      </p>
      <div className="rsvp-list">
        {names.length ? (
          <>
            <AvatarStack names={names} />
            <p className="avatar-names">{names.join(', ')}</p>
          </>
        ) : (
          <p style={{ color: 'var(--ink-faint)', fontSize: 13, margin: '0 0 14px' }}>No one yet — be first</p>
        )}
      </div>

      {myRsvp ? (
        <button className="btn-outline done" onClick={handleCancel}>
          You're in · cancel
        </button>
      ) : expanding ? (
        <div>
          <div className="field">
            <label>Your name</label>
            <input type="text" placeholder="e.g. Sam" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Phone (optional)</label>
            <input type="text" placeholder="e.g. 07700 900123" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <button className="btn-outline" onClick={confirmRsvp} disabled={saving}>
            {saving ? 'Saving…' : 'Confirm RSVP'}
          </button>
        </div>
      ) : (
        <button className="btn-outline" onClick={() => setExpanding(true)}>
          I'm in
        </button>
      )}
    </div>
  );
}
