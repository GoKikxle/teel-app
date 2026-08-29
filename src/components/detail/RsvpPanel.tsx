import { useState } from 'react';
import type { GatheringWithRelations, Rsvp } from '../../lib/database.types';
import { AVATAR_COLORS } from '../../lib/constants';
import { activeRsvps, upsertRsvp, cancelRsvp } from '../../data/gatherings';
import { useToast } from '../../hooks/useToast';

export function RsvpPanel({
  gathering,
  userId,
  myRsvp,
  isOrganizer,
  onChange,
}: {
  gathering: GatheringWithRelations;
  userId: string;
  myRsvp: Rsvp | undefined;
  isOrganizer: boolean;
  onChange: () => void;
}) {
  const toast = useToast();
  const [expanding, setExpanding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const going = activeRsvps(gathering);

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
      <h2>Who's in?</h2>
      <p className="poll-hint" style={{ marginTop: 0 }}>
        {going.length} of {gathering.capacity} spots taken
      </p>
      <div className="rsvp-list">
        {going.length ? (
          <div className="rsvp-rows">
            {going.map((r, i) => (
              <div className="rsvp-row" key={r.id}>
                <span className="rsvp-avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                  {(r.name || 'G').trim().charAt(0).toUpperCase()}
                </span>
                <span className="rsvp-name">{r.name}</span>
                {/* Contact detail is organizer-only — guests see who's
                    going, not each other's phone numbers. Using `phone`
                    here (not email): the Rsvp table has no email column,
                    and this is the only contact field it already
                    collects, so it stands in for "contact" rather than
                    adding a new field for this. */}
                {isOrganizer && <span className="rsvp-contact">{r.phone || 'No contact given'}</span>}
              </div>
            ))}
          </div>
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
          <button className="primary-btn" onClick={confirmRsvp} disabled={saving}>
            {saving ? 'Saving…' : 'Confirm RSVP'}
          </button>
        </div>
      ) : (
        <button className="primary-btn" onClick={() => setExpanding(true)}>
          I'm going to the gathering
        </button>
      )}
    </div>
  );
}
