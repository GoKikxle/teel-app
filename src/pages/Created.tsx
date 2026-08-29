import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchGathering } from '../data/gatherings';
import type { GatheringWithRelations } from '../lib/database.types';
import { SharePanel } from '../components/detail/SharePanel';

export function Created() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [gathering, setGathering] = useState<GatheringWithRelations | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchGathering(id).then(setGathering).catch(console.error);
  }, [id]);

  const isSplitBill = gathering?.kind === 'split_bill';

  return (
    <div className="wrap">
      <div className="gate-wrap">
        <div className="success-check">✓</div>
        <h1>{isSplitBill ? 'Split bill created' : 'Gathering created'}</h1>
        <p className="lede" style={{ margin: '0 auto 22px' }}>
          {gathering ? `${gathering.title} is live.` : 'Your gathering is live.'}{' '}
          {isSplitBill ? 'Share the link or QR code below and watch payments come in.' : 'Share the link and watch RSVPs, splits and votes come in.'}
        </p>
        <button
          className="primary-btn"
          style={{ width: 'auto', padding: '12px 26px', marginBottom: 12 }}
          onClick={() => navigate(`/g/${id}`)}
        >
          View gathering
        </button>
        <br />
        {/* Not converted to BackLink deliberately — this is a secondary
            action next to "View gathering" inside a centered success
            card, not a page-level "go back" nav affordance, so the small
            eyebrow-link pattern doesn't fit the same role here. */}
        <button className="btn-outline" onClick={() => navigate('/')}>
          Back to board
        </button>
      </div>

      {isSplitBill && gathering && (
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <SharePanel gathering={gathering} quickShare />
        </div>
      )}
    </div>
  );
}
