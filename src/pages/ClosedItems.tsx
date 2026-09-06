import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchClosedGatherings } from '../data/gatherings';
import { fetchClosedPolls } from '../data/polls';
import { BackLink } from '../components/BackLink';

// Normalized shape merging closed gatherings/bills (fetchClosedGatherings,
// sorted by created_at — see that type's own comment for why, despite the
// query itself ordering by cancelled_at) with closed alias polls
// (fetchClosedPolls, whose equivalent close timestamp is closed_at) into
// one chronologically-sorted list, rather than a separate visual section.
interface ClosedRow {
  id: string;
  title: string;
  kindLabel: string;
  href: string;
  sortKey: string;
  dateIso: string;
}

// Reference-only list of the signed-in organizer's own closed items
// (gatherings and split bills share the same cancelled_at mechanism, so one
// query covers both — see fetchClosedGatherings; alias polls are a fully
// separate table, merged in alongside them here). Reached only via the
// Board's "Closed (N)" link, which never renders for anonymous sessions;
// this route redirects them too, since the list only ever means anything
// for the organizer who owns the items in it.
export function ClosedItems() {
  const navigate = useNavigate();
  const { userId, ready, isPersistent } = useAuth();
  const [items, setItems] = useState<ClosedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    Promise.all([fetchClosedGatherings(userId), fetchClosedPolls(userId)])
      .then(([gatherings, polls]) => {
        const gatheringRows: ClosedRow[] = gatherings.map((g) => ({
          id: g.id,
          title: g.title,
          kindLabel: g.kind === 'split_bill' ? 'Split Bill' : 'Gathering',
          href: `/g/${g.id}`,
          sortKey: g.created_at,
          dateIso: g.created_at,
        }));
        const pollRows: ClosedRow[] = polls.map((p) => ({
          id: p.id,
          title: p.title,
          kindLabel: 'Poll',
          href: `/poll/${p.id}/organize`,
          sortKey: p.closed_at ?? '',
          dateIso: p.closed_at ?? '',
        }));
        const merged = [...gatheringRows, ...pollRows].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
        setItems(merged);
      })
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
              <Link key={item.id} to={item.href} className="closed-row">
                <span className="closed-row-title">{item.title}</span>
                <span className="closed-row-meta">
                  <span>{item.kindLabel}</span>
                  <span>{formatClosedDate(item.dateIso)}</span>
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
