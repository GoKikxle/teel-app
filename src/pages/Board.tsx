import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchBoardGatherings } from '../data/gatherings';
import type { GatheringWithRelations } from '../lib/database.types';
import { BoardGatheringCard } from '../components/BoardGatheringCard';
import { BoardBillCard } from '../components/BoardBillCard';
import { SignInModal } from '../components/SignInModal';
import { useCreateGate } from '../hooks/useCreateGate';

type TabKey = 'all' | 'split_bill' | 'event';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'split_bill', label: 'Bills' },
  { key: 'event', label: 'Gatherings' },
];

// Mobile's tab-select popover uses its own (shorter) labels — confirmed from
// the Figma frame's actual text nodes ("Gathering" singular, "Closed" not
// "Closed Items"), not just guessed as an abbreviation of the desktop copy.
const MOBILE_TAB_LABELS: Record<TabKey, string> = { all: 'All', split_bill: 'Bills', event: 'Gathering' };

function formatGroupDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Board only ever renders for a signed-in session (see Home.tsx — anonymous
// visitors get Landing instead), so every gathering/bill shown here always
// belongs to someone with an account; no anonymous-vs-signed-in branching
// needed within the page itself the way Nav.tsx has to.
export function Board() {
  const navigate = useNavigate();
  const [gatherings, setGatherings] = useState<GatheringWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<TabKey>('all');
  // Mobile-only: which full-screen toolbar overlay (if any) is showing.
  // Search/tabs/add are mutually exclusive — only one slot in the toolbar's
  // right side (search icon vs. close "X") and left side (which trigger
  // shows) at a time. See the "Tabs"/"Add / plus"/"Search" mobile Figma
  // frames — each is this same row in a different state.
  const [mobileOverlay, setMobileOverlay] = useState<'none' | 'search' | 'tabs' | 'add'>('none');
  // Nav.tsx's own create actions ("+ New gathering"/"+Split bill") are
  // hidden on mobile — Figma moves that action into Board's own toolbar
  // there (a "+" button next to the tab selector, not the nav bar), so this
  // page needs its own gate/modal pair for that mobile-only entry point.
  const createGate = useCreateGate();
  const splitBillGate = useCreateGate('/split/create');

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

  // The board only shows active items — gatherings and split bills share
  // the same cancelled_at mechanism, so one filter covers both. Closed
  // items stay on the separate /closed reference list (see the "Closed
  // Items" tab below, which links there rather than filtering in place —
  // a deliberate choice to keep that page's low-visibility treatment
  // rather than fully merging it into the live board).
  const activeGatherings = useMemo(() => gatherings.filter((g) => !g.cancelled_at), [gatherings]);

  const kindFiltered = useMemo(() => {
    if (tab === 'all') return activeGatherings;
    return activeGatherings.filter((g) => g.kind === tab);
  }, [activeGatherings, tab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return kindFiltered;
    return kindFiltered.filter((g) => g.title.toLowerCase().includes(q) || (g.location ?? '').toLowerCase().includes(q));
  }, [kindFiltered, query]);

  // Grouped by date for the pill headers + timeline, most-upcoming first.
  const dateGroups = useMemo(() => {
    const map = new Map<string, GatheringWithRelations[]>();
    for (const g of filtered) {
      const list = map.get(g.gathering_date);
      if (list) list.push(g);
      else map.set(g.gathering_date, [g]);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({ date, items }));
  }, [filtered]);

  function renderCard(g: GatheringWithRelations) {
    return g.kind === 'split_bill' ? (
      <BoardBillCard key={g.id} g={g} onClick={() => navigate(`/g/${g.id}`)} />
    ) : (
      <BoardGatheringCard key={g.id} g={g} onClick={() => navigate(`/g/${g.id}`)} />
    );
  }

  return (
    <div className="board-page">
      <div className="board-toolbar">
        <div className="board-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`board-tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
          <Link to="/closed" className="board-tab">
            Closed Items
          </Link>
        </div>
        <div className="board-search-bar">
          {/* No design was provided for what this filters by — visual only
              for now, matching the Figma frame, until there's a spec for
              its behavior. */}
          <button type="button" className="board-filter-btn" aria-label="Filter">
            <img src="/icons/board/filter.svg" alt="" width={16} height={16} />
          </button>
          <div className="board-search-box">
            <input
              type="text"
              placeholder="Enter keyword to search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="button" className="board-search-submit" aria-label="Search">
              <img src="/icons/board/search.svg" alt="" width={12} height={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile toolbar — replaces the pill row + filter/search bar above
          entirely (CSS-toggled by breakpoint). Search is an inline
          back+input row that takes over the whole row; tabs/add are each a
          trigger button plus a full-screen overlay below (not an anchored
          popover — see the "Tabs"/"Add / plus" Figma frames: the overlay is
          the same flat page background, covers everything below this row,
          and the row itself shows only the active trigger (pressed/active
          background) plus a close "X" replacing the search icon — the
          *other* trigger is hidden while one overlay is open, confirmed
          from both frames only ever showing 2 children in this row. */}
      {mobileOverlay === 'search' ? (
        <div className="board-toolbar-mobile board-mobile-search-row">
          <button type="button" onClick={() => setMobileOverlay('none')} aria-label="Back">
            <img src="/icons/board/chevron-back.svg" alt="" width={24} height={24} />
          </button>
          <div className="board-mobile-search-box">
            <input
              type="text"
              autoFocus
              placeholder="Enter keyword to search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                <img src="/icons/board/close-md.svg" alt="" width={16} height={16} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={`board-toolbar-mobile${mobileOverlay !== 'none' ? ' overlay-open' : ''}`}>
          <div className="board-mobile-toolbar-left">
            {mobileOverlay !== 'tabs' && (
              <button
                type="button"
                className={`board-mobile-add-btn${mobileOverlay === 'add' ? ' active' : ''}`}
                onClick={() => setMobileOverlay(mobileOverlay === 'add' ? 'none' : 'add')}
                aria-label="Create"
              >
                <img src="/icons/board/add-plus.svg" alt="" width={24} height={24} />
              </button>
            )}
            {mobileOverlay !== 'add' && (
              <button
                type="button"
                className={`board-mobile-tab-trigger${mobileOverlay === 'tabs' ? ' active' : ''}`}
                onClick={() => setMobileOverlay(mobileOverlay === 'tabs' ? 'none' : 'tabs')}
              >
                {MOBILE_TAB_LABELS[tab]}
                <img src="/icons/board/caret-down.svg" alt="" width={16} height={16} />
              </button>
            )}
          </div>
          {mobileOverlay === 'none' ? (
            <button type="button" className="board-mobile-search-btn" onClick={() => setMobileOverlay('search')} aria-label="Search">
              {/* Not /icons/board/search.svg — that one is white-filled for
                  the dark desktop search button; this button's background
                  is white, so it needs the dark variant to stay visible. */}
              <img src="/icons/board/search-dark.svg" alt="" width={24} height={24} />
            </button>
          ) : (
            <button type="button" className="board-mobile-overlay-close" onClick={() => setMobileOverlay('none')} aria-label="Close">
              <img src="/icons/board/close-md.svg" alt="" width={24} height={24} />
            </button>
          )}
        </div>
      )}

      {mobileOverlay === 'tabs' && (
        <div className="board-mobile-overlay">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className="board-mobile-overlay-item"
              onClick={() => {
                setTab(t.key);
                setMobileOverlay('none');
              }}
            >
              <span className="board-mobile-overlay-check">{tab === t.key ? '✓' : ''}</span>
              {MOBILE_TAB_LABELS[t.key]}
            </button>
          ))}
          <Link to="/closed" className="board-mobile-overlay-item" onClick={() => setMobileOverlay('none')}>
            <span className="board-mobile-overlay-check" />
            Closed
          </Link>
        </div>
      )}
      {mobileOverlay === 'add' && (
        <div className="board-mobile-overlay board-mobile-overlay-add">
          <button
            type="button"
            className="board-mobile-overlay-pill accent"
            onClick={() => {
              setMobileOverlay('none');
              splitBillGate.requestCreate();
            }}
          >
            +Split bill
          </button>
          <button
            type="button"
            className="board-mobile-overlay-pill dark"
            onClick={() => {
              setMobileOverlay('none');
              createGate.requestCreate();
            }}
          >
            New gathering
          </button>
        </div>
      )}

      {loading ? (
        <p className="lede board-empty">Loading…</p>
      ) : dateGroups.length === 0 ? (
        <p className="lede board-empty">Nothing here yet.</p>
      ) : (
        <div className="board-timeline">
          {dateGroups.map(({ date, items }) => {
            // "All" splits into two fixed columns by type — gatherings
            // always left, bills always right — not alternated by index.
            // Confirmed against the Figma frame directly: every bill card
            // sits at left:calc(50%+296px) and every gathering card at
            // left:calc(50%-296px), regardless of order. A single kind
            // filter (Bills/Gatherings) stays one column.
            const twoColumn = tab === 'all';
            const left = twoColumn ? items.filter((g) => g.kind === 'event') : items;
            const right = twoColumn ? items.filter((g) => g.kind === 'split_bill') : [];
            return (
              <div className="board-date-group" key={date}>
                <div className="board-date-pill">{formatGroupDate(date)}</div>
                {/* Desktop: gatherings-left/bills-right split (or single
                    column when filtered) — hidden on mobile. */}
                <div className={`board-timeline-row board-timeline-row-desktop${twoColumn ? ' two-col' : ' one-col'}`}>
                  <div className="board-timeline-spine" />
                  <div className="board-timeline-col">{left.map(renderCard)}</div>
                  {twoColumn && <div className="board-timeline-col">{right.map(renderCard)}</div>}
                </div>
                {/* Mobile: always one column in original (date-sorted)
                    order — gatherings and bills interleaved, not grouped by
                    type. Confirmed from the "Board Active" mobile frame,
                    whose card sequence is gathering/bill/gathering/bill/bill,
                    not type-grouped like desktop's All tab. Only shown via
                    CSS at the mobile breakpoint. */}
                <div className="board-timeline-row board-timeline-row-mobile one-col">
                  <div className="board-timeline-spine" />
                  <div className="board-timeline-col">{items.map(renderCard)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SignInModal open={createGate.open} onClose={createGate.close} message="Sign in to create and manage your gathering." />
      <SignInModal
        open={splitBillGate.open}
        onClose={splitBillGate.close}
        message="Sign in to create and manage your split bill."
      />
    </div>
  );
}
