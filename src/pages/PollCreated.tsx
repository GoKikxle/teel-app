import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchPoll } from '../data/polls';
import type { AliasPoll } from '../lib/database.types';
import { PollSharePanel } from '../components/polls/PollSharePanel';

// New route (round 5) — the create flow used to navigate straight from
// /poll/new to /poll/:id/organize; this mirrors Created.tsx's exact shell
// pattern (Figma confirmed near-identical for the poll case), reusing its
// .success-* classes verbatim rather than introducing new CSS for the
// shell.
export function PollCreated() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [poll, setPoll] = useState<AliasPoll | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchPoll(id).then(setPoll).catch(console.error);
  }, [id]);

  return (
    <div className="wrap">
      <div className="success-block">
        <img src="/icons/shared/checkbox-active.svg" alt="" width={52} height={52} className="success-check" />
        <h1 className="success-title">Poll created</h1>
        <p className="success-lede">
          {poll ? `${poll.title} is live.` : 'Your poll is live.'} Share the link or QR code below and watch the votes come in.
        </p>
        <div className="success-actions">
          <button className="success-primary-btn" onClick={() => navigate(`/poll/${id}/organize`)}>
            View poll
          </button>
          <button className="success-secondary-btn" onClick={() => navigate('/')}>
            Back to board
          </button>
        </div>
      </div>

      {poll && (
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <PollSharePanel poll={poll} />
        </div>
      )}
    </div>
  );
}
