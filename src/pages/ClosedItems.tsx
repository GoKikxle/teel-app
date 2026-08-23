import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchClosedGatherings, type ClosedGatheringSummary } from '../data/gatherings';

// Reference-only list of the signed-in organizer's own closed items
// (gatherings and split bills share the same cancelled_at mechanism, so one
// query covers both — see fetchClosedGatherings). Reached only via the
// Board's "Closed (N)" link, which never renders for anonymous sessions;
// this route redirects them too, since the list only ever means anything
// for the organizer who owns the items in it.
export function ClosedItems() {
  const navigate = useNavigate();
  const { userId, ready, isPersistent } = useAuth();
  const [items, setItems] = useState<ClosedGatheringSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetchClosedGatherings(userId)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  if (!ready) {
    return (
      <div className="wrap">
        <p className="lede">Loading…</p>
      </div>
    );
  }

  if (!isPersistent) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="wrap">
      <button className="btn-outline" style={{ marginBottom: 20 }} onClick={() => navigate('/')}>
        ← Back to board
      </button>
      <p className="eyebrow">Closed</p>
      <h1>Closed gatherings &amp; bills</h1>
      <p className="lede">Reference only — these are no longer active. Open one to view details or delete it.</p>

      {loading ? (
        <p className="lede">Loading…</p>
      ) : items.length === 0 ? (
        <p className="lede">Nothing closed yet.</p>
      ) : (
        <div className="paid-list">
          {items.map((item) => (
            <Link key={item.id} to={`/g/${item.id}`} className="paid-item" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span>{item.title}</span>
              <span style={{ display: 'flex', gap: 14, fontFamily: "'Space Mono', monospace", fontSize: 12, color: 'var(--ink-faint)' }}>
                <span>{item.kind === 'split_bill' ? 'Split Bill' : 'Gathering'}</span>
                <span>
                  {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
