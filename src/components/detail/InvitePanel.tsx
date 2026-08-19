import { useState } from 'react';
import type { GatheringWithRelations } from '../../lib/database.types';
import { fmtDate } from '../../lib/constants';
import { addInvitedEmail, removeInvitedEmail } from '../../data/gatherings';
import { useToast } from '../../hooks/useToast';

export function InvitePanel({
  gathering,
  onChange,
  onPreviewGuest,
}: {
  gathering: GatheringWithRelations;
  onChange: () => void;
  onPreviewGuest: () => void;
}) {
  const toast = useToast();
  const [newEmail, setNewEmail] = useState('');

  async function handleAdd() {
    const val = newEmail.trim();
    if (!val) {
      toast('Enter an email first');
      return;
    }
    if (gathering.invited_emails.some((e) => e.email.toLowerCase() === val.toLowerCase())) {
      toast('Already invited');
      return;
    }
    try {
      await addInvitedEmail(gathering.id, val);
      setNewEmail('');
      toast('Invited ' + val);
      onChange();
    } catch (err) {
      console.error(err);
      toast('Could not add invite');
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeInvitedEmail(id);
      onChange();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="panel">
      <h2>Invited people</h2>
      <p className="poll-hint" style={{ marginTop: -4 }}>
        Only these emails can open this gathering's link.
      </p>
      <div>
        {gathering.invited_emails.length ? (
          gathering.invited_emails.map((invite) => {
            const subject = encodeURIComponent(`You're invited: ${gathering.title}`);
            const body = encodeURIComponent(
              `Hey! You're invited to ${gathering.title} on ${fmtDate(gathering.gathering_date)}.\n\nView and RSVP here: ${window.location.origin}/g/${gathering.id}\n\nThis link only works for this email address.`
            );
            return (
              <div className="invite-row" key={invite.id}>
                <span className="ie">{invite.email}</span>
                <div className="invite-actions">
                  <span className={`invite-status${invite.accessed ? ' viewed' : ' pending'}`}>
                    {invite.accessed ? 'Viewed' : 'Pending'}
                  </span>
                  <a href={`mailto:${invite.email}?subject=${subject}&body=${body}`}>Email</a>
                  <button type="button" className="item-remove" aria-label="Remove invite" onClick={() => handleRemove(invite.id)}>
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>No one invited yet.</p>
        )}
      </div>
      <div className="email-row" style={{ marginTop: 10 }}>
        <input
          type="text"
          placeholder="name@example.com"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <button className="btn-outline" style={{ flexShrink: 0 }} onClick={handleAdd}>
          + Invite
        </button>
      </div>
      <button className="btn-outline" style={{ marginTop: 14, width: '100%' }} onClick={onPreviewGuest}>
        See what an invited guest sees →
      </button>
    </div>
  );
}
