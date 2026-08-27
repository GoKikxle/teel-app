import { useState } from 'react';
import type { FormEvent } from 'react';
import { FlyerCard } from '../components/FlyerCard';
import { ProofStrip } from '../components/ProofStrip';
import { joinWaitlist } from '../data/waitlist';
import { useToast } from '../hooks/useToast';
import type { GatheringWithRelations } from '../lib/database.types';

// Purely illustrative — never fetched, never persisted. Gives the hero
// visual something real-looking to show (reusing the actual FlyerCard/
// PaidRing styling) without a live gathering to point it at.
const HERO_GATHERING: GatheringWithRelations = {
  id: 'demo',
  organizer_id: 'demo',
  title: 'Manchester Hike',
  category: 'hike_sports',
  gathering_date: '2026-09-12',
  gathering_time: '09:30',
  location: 'Peak District',
  capacity: 6,
  cover_image_url: null,
  visibility: 'private',
  cost_enabled: true,
  cost_mode: 'split_pay',
  cost_total: 45,
  split_method: 'equal',
  pay_mode: 'direct',
  pay_method: 'venmo',
  pay_handle: 'sam-hikes',
  stripe_account_id: null,
  poll_enabled: false,
  poll_question: null,
  reminder_on: false,
  created_at: '2026-08-01T00:00:00Z',
  cancelled_at: null,
  kind: 'event',
  cost_items: [],
  poll_options: [],
  invited_emails: [],
  rsvps: ['Alex', 'Jordan', 'Sam', 'Priya'].map((name, i) => ({
    id: `demo-rsvp-${i}`,
    gathering_id: 'demo',
    guest_user_id: `demo-guest-${i}`,
    name,
    phone: null,
    paid_sent: i < 3,
    paid: i < 3,
    created_at: '2026-08-01T00:00:00Z',
    cancelled_at: null,
    amount_owed: null,
  })),
};

const PILLARS = [
  { icon: '£', label: 'Split & Pay', sub: 'Everyone pays their share, one tap.' },
  { icon: '▤', label: 'Simple events', sub: 'A link to share — no app, no account for guests.' },
  { icon: '☑', label: 'Votes & plans', sub: 'Settle the details with a quick poll.' },
];

function WaitlistForm({
  email,
  setEmail,
  status,
  onSubmit,
}: {
  email: string;
  setEmail: (v: string) => void;
  status: 'idle' | 'sending' | 'done';
  onSubmit: (e: FormEvent) => void;
}) {
  if (status === 'done') {
    return <p className="waitlist-done">You're on the list — we'll email you when we launch.</p>;
  }
  return (
    <form className="waitlist-form" onSubmit={onSubmit}>
      <input
        type="email"
        placeholder="name@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === 'sending'}
        required
      />
      <button className="primary-btn" type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Joining…' : 'Join the waitlist'}
      </button>
    </form>
  );
}

// Anonymous visitors land here at '/' instead of the board — see Home.tsx,
// which renders this only when there's no signed-in session. This fully
// replaces the old Get Started/Sign In entry point: the app is pre-launch,
// so the only action here is joining the waitlist (confirmed explicitly —
// no quiet way back into the live create flow on this page by design).
export function Landing() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const toast = useToast();

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    const val = email.trim();
    if (!val) {
      toast('Enter an email first');
      return;
    }
    setStatus('sending');
    try {
      const result = await joinWaitlist(val);
      setStatus('done');
      toast(result === 'already' ? "You're already on the list" : "You're on the list!");
    } catch (err) {
      console.error(err);
      setStatus('idle');
      toast('Could not join — try again');
    }
  }

  const formProps = { email, setEmail, status, onSubmit: handleJoin };

  return (
    <div className="wrap waitlist-page">
      <section className="waitlist-hero">
        <div className="waitlist-hero-copy">
          <p className="eyebrow">Coming soon</p>
          <h1>You planned the trip. Not the spreadsheet.</h1>
          <p className="lede" style={{ margin: '0 0 22px' }}>
            Komon splits the bill, tracks who's paid, and keeps everyone on the same page — one link, no app to
            install.
          </p>
          <WaitlistForm {...formProps} />
        </div>
        <div className="waitlist-hero-visual">
          <FlyerCard g={HERO_GATHERING} onClick={() => {}} />
        </div>
      </section>

      <ProofStrip />

      <section className="pillars">
        {PILLARS.map((p) => (
          <div className="pillar" key={p.label}>
            <span className="pillar-icon">{p.icon}</span>
            <div className="pillar-label">{p.label}</div>
            <p className="pillar-sub">{p.sub}</p>
          </div>
        ))}
      </section>

      <section className="waitlist-footer-cta">
        <h2>Be first in when we launch.</h2>
        <WaitlistForm {...formProps} />
      </section>

      <footer className="waitlist-footer">
        <span className="word" style={{ cursor: 'default' }}>
          Komon
        </span>
        <span className="waitlist-footer-copy">© 2026 Komon</span>
      </footer>
    </div>
  );
}
