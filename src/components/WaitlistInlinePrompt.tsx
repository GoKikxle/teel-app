import { useState } from 'react';
import type { FormEvent } from 'react';
import { joinWaitlist } from '../data/waitlist';
import { useToast } from '../hooks/useToast';

// A low-key, non-blocking waitlist invitation for guest-facing surfaces —
// viewing a gathering or split bill (Detail.tsx) and voting on a poll
// (PollVote.tsx). Never a gate: those pages render their real content and
// primary action (RSVP, pay, vote) fully, with this as one line + a single
// email field underneath, easy to ignore. Copy/tone matches the existing
// "Join our waitlist" CTA (Landing.tsx's topbar, WaitlistModal.tsx's own
// title) and the exact "You're on the list" wording SignIn.tsx uses for
// the same event, rather than inventing new phrasing for this surface.
export function WaitlistInlinePrompt() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const toast = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const val = email.trim();
    if (!val) return;
    setStatus('sending');
    try {
      await joinWaitlist(val);
      setStatus('done');
    } catch (err) {
      console.error(err);
      setStatus('idle');
      toast('Could not join — try again');
    }
  }

  if (status === 'done') {
    return (
      <p className="waitlist-inline-copy">You're on the list — we'll email you when Komon opens up.</p>
    );
  }

  return (
    <form className="waitlist-inline" onSubmit={handleSubmit}>
      <p className="waitlist-inline-copy">Made with Komon. Join our waitlist for early access.</p>
      <div className="waitlist-inline-field">
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'sending'}
          required
        />
        <button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Joining…' : 'Join waitlist'}
        </button>
      </div>
    </form>
  );
}
