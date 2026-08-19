import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchGathering } from '../data/gatherings';
import type { GatheringWithRelations } from '../lib/database.types';

export function Created() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [gathering, setGathering] = useState<GatheringWithRelations | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchGathering(id).then(setGathering).catch(console.error);
  }, [id]);

  return (
    <div className="wrap">
      <div className="gate-wrap">
        <div className="success-check">✓</div>
        <h1>Gathering created</h1>
        <p className="lede" style={{ margin: '0 auto 22px' }}>
          {gathering ? `${gathering.title} is live.` : 'Your gathering is live.'} Share the link and watch RSVPs,
          splits and votes come in.
        </p>
        <button
          className="primary-btn"
          style={{ width: 'auto', padding: '12px 26px', marginBottom: 12 }}
          onClick={() => navigate(`/g/${id}`)}
        >
          View gathering
        </button>
        <br />
        <button className="btn-outline" onClick={() => navigate('/')}>
          Back to board
        </button>
      </div>
    </div>
  );
}
