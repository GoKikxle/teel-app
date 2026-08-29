import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchClosedGatherings, type ClosedGatheringSummary } from '../data/gatherings';
import { BackLink } from '../components/BackLink';

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
      <div className="closed-panel">
        <BackLink label="Closed" onClick={() => navigate('/')} />
        <h1>Closed gatherings and bills</h1>

        {loading ? (
          <p className="lede">Loading…</p>
        ) : items.length === 0 ? (
          <p className="lede">Nothing closed yet.</p>
        ) : (
          <div className="closed-list">
            {items.map((item) => (
              <Link key={item.id} to={`/g/${item.id}`} className="closed-row">
                <span className="closed-row-title">{item.title}</span>
                <span className="closed-row-meta">
                  <span>{item.kind === 'split_bill' ? 'Split Bill' : 'Gathering'}</span>
                  <span>{formatClosedDate(item.created_at)}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// en-GB's toLocaleDateString doesn't reliably include the comma Figma's
// "23 Aug, 2026" format shows (locale/engine-dependent) — built manually
// to guarantee it.
function formatClosedDate(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-GB', { day: 'numeric' });
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month}, ${year}`;
}
