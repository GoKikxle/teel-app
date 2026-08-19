import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBoardGatherings } from '../data/gatherings';
import type { GatheringWithRelations } from '../lib/database.types';
import { CATS } from '../lib/constants';
import { FlyerCard } from '../components/FlyerCard';
import { SignInModal } from '../components/SignInModal';
import { useCreateGate } from '../hooks/useCreateGate';

export function Board() {
  const navigate = useNavigate();
  const { open, requestCreate, close } = useCreateGate();
  const [gatherings, setGatherings] = useState<GatheringWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    fetchBoardGatherings()
      .then((data) => {
        if (mounted) setGatherings(data);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return gatherings;
    return gatherings.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        (g.location ?? '').toLowerCase().includes(q) ||
        CATS[g.category].label.toLowerCase().includes(q)
    );
  }, [gatherings, query]);

  return (
    <div className="wrap">
      <p className="eyebrow">The board</p>
      <h1>What's coming up</h1>
      <p className="lede">
        Every gathering here is one shared link — no app, no account, no branding. Just RSVP, split, vote.
      </p>
      <input
        type="text"
        className="board-search"
        placeholder="Search gatherings…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading ? (
        <p className="lede">Loading…</p>
      ) : (
        <div className="board-grid">
          {filtered.map((g) => (
            <FlyerCard key={g.id} g={g} onClick={() => navigate(`/g/${g.id}`)} />
          ))}
          <button className="add-flyer" onClick={requestCreate}>
            <div className="plus">+</div>New gathering
          </button>
        </div>
      )}

      <SignInModal open={open} onClose={close} message="Sign in to create and manage your gathering." />
    </div>
  );
}
