import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchGathering } from '../data/gatherings';
import type { GatheringWithRelations } from '../lib/database.types';
import { SharePanel } from '../components/detail/SharePanel';

// Figma 1165:3486 "Success creation" — own scoped classes (.success-*)
// rather than the shared .gate-wrap h1/.lede InviteGate.tsx also uses:
// this frame's heading is 32px/500-weight vs. the global h1's 34px/800,
// and its buttons are pill-radius/14px-medium vs. .primary-btn/.btn-
// outline's 16px-radius/700-weight — different enough to fight the
// cascade rather than share it.
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
      <div className="success-block">
        <img src="/icons/shared/checkbox-active.svg" alt="" width={52} height={52} className="success-check" />
        <h1 className="success-title">{isSplitBill ? 'Split bill created' : 'Gathering created'}</h1>
        <p className="success-lede">
          {gathering ? `${gathering.title} is live.` : 'Your gathering is live.'}{' '}
          {isSplitBill ? 'Share the link or QR code below and watch payments come in' : 'Share the link and watch RSVPs, splits and votes come in'}
        </p>
        <button className="success-primary-btn" onClick={() => navigate(`/g/${id}`)}>
          {isSplitBill ? 'View bill' : 'View gathering'}
        </button>
        <button className="success-secondary-btn" onClick={() => navigate('/')}>
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
