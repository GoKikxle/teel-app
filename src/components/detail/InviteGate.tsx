import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GatheringWithRelations } from '../../lib/database.types';
import { markEmailAccessed } from '../../data/gatherings';

export function InviteGate({
  gathering,
  previewAsGuest,
  onVerified,
}: {
  gathering: GatheringWithRelations;
  previewAsGuest: boolean;
  onVerified: (email: string) => void;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);

  async function handleCheck() {
    const val = email.trim().toLowerCase();
    const match = gathering.invited_emails.some((e) => e.email.toLowerCase() === val);
    if (match) {
      setChecking(true);
      try {
        await markEmailAccessed(gathering.id, val);
      } catch (err) {
        console.error(err);
      } finally {
        setChecking(false);
      }
      onVerified(val);
    } else {
      setMessage(val ? "That email wasn't invited." : 'Enter an email to continue.');
    }
  }

  return (
    <div className="wrap">
      <button
        className="btn-outline"
        style={{ marginBottom: 20 }}
        onClick={() => (previewAsGuest ? navigate(`/g/${gathering.id}`) : navigate('/'))}
      >
        ← {previewAsGuest ? 'Back to your view' : 'Back to board'}
      </button>
      {previewAsGuest && <p className="poll-hint" style={{ textAlign: 'center' }}>Previewing what an invited guest sees</p>}
      <div className="gate-wrap">
        <div className="lock">✉</div>
        <h1>Invite only</h1>
        <p className="lede" style={{ margin: '0 auto 4px' }}>
          {gathering.title} is only visible to people the organizer invited. Enter your email to check access.
        </p>
        <input type="text" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div style={{ fontSize: 13, color: 'var(--danger)', minHeight: 18, marginBottom: 10 }}>{message}</div>
        <button className="primary-btn" style={{ width: 'auto', padding: '12px 26px' }} onClick={handleCheck} disabled={checking}>
          Continue
        </button>
      </div>
    </div>
  );
}
