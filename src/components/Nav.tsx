import { useEffect, useState } from 'react';
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { Menu } from '@base-ui/react/menu';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { useCreateGate } from '../hooks/useCreateGate';
import { fetchGatheringKind } from '../data/gatherings';
import type { GatheringKind } from '../lib/database.types';
import { Logo } from './Logo';

export function Nav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { installable, promptInstall } = usePwaInstall();
  const toast = useToast();
  const { isPersistent, email, signOut } = useAuth();
  const createGate = useCreateGate();
  const splitBillGate = useCreateGate('/split/create');

  const gatheringMatch = matchPath('/g/:id', location.pathname);
  const viewingGatheringId = gatheringMatch?.params.id ?? null;
  const [viewedKind, setViewedKind] = useState<GatheringKind | null>(null);

  // Only matters for the anonymous + on-a-gathering-page case below — a
  // signed-in session always sees the full nav no matter whose gathering
  // it's looking at, so there's nothing to fetch for it.
  useEffect(() => {
    if (isPersistent || !viewingGatheringId) {
      setViewedKind(null);
      return;
    }
    let mounted = true;
    fetchGatheringKind(viewingGatheringId)
      .then((kind) => {
        if (mounted) setViewedKind(kind);
      })
      .catch(() => {
        if (mounted) setViewedKind(null);
      });
    return () => {
      mounted = false;
    };
  }, [isPersistent, viewingGatheringId]);

  async function handleInstall() {
    const outcome = await promptInstall();
    if (outcome === 'unavailable') toast('Use your browser’s "Add to Home Screen"');
  }

  async function handleSignOut() {
    await signOut();
    toast('Signed out');
  }

  // Anonymous visitor on a specific gathering's page: minimal, contextual
  // nav — just the logo and one creation CTA matching what they're looking
  // at. No Board link, Install app, or account indicator. The CTA is
  // withheld (logo shows alone) until viewedKind resolves, rather than
  // flashing the wrong label first.
  if (!isPersistent && viewingGatheringId) {
    const isSplitBillView = viewedKind === 'split_bill';
    const gate = isSplitBillView ? splitBillGate : createGate;
    return (
      <nav>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button className="word" onClick={() => navigate('/')}>
            <Logo />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {viewedKind && (
            <button className="navbtn" onClick={gate.requestCreate}>
              {isSplitBillView ? '+ Split Bill' : '+ New Gathering'}
            </button>
          )}
        </div>
      </nav>
    );
  }

  // Anonymous visitor on the root path — Landing.tsx renders its own full
  // header (logo + "Join our waitlist" pill, per the Figma frame it was
  // rebuilt from), so this bar renders nothing here to avoid a duplicate
  // header stacked on top of it.
  if (!isPersistent && location.pathname === '/') {
    return null;
  }

  // Anonymous visitor anywhere else — just the logo, no CTAs.
  if (!isPersistent) {
    return (
      <nav>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button className="word" onClick={() => navigate('/')}>
            <Logo />
          </button>
        </div>
      </nav>
    );
  }

  // Signed-in nav — pulled from the "Komon board - All/Gatherings/Bills"
  // Figma frames' shared menu-item bar (all three show the exact same nav,
  // so one implementation covers every Board tab) plus the "Komon - Log
  // out" frame for the account dropdown's open state.
  return (
    <nav className="board-nav">
      <div className="board-nav-inner">
        <button className="word" onClick={() => navigate('/')}>
          <Logo />
        </button>
        <div className="board-nav-actions">
          {installable && (
            <button className="navbtn" onClick={handleInstall}>
              Install app
            </button>
          )}
          <Link to="/" className="navbtn">
            Board
          </Link>
          <button className="navbtn" onClick={createGate.requestCreate}>
            + New gathering
          </button>
          <button className="navbtn accent" onClick={splitBillGate.requestCreate}>
            +Split bill
          </button>
          <Menu.Root>
            <Menu.Trigger className="account-trigger" aria-label="Account menu">
              <img src="/icons/board/profile-circle.svg" alt="" width={24} height={24} />
              <img src="/icons/board/caret-down.svg" alt="" width={24} height={24} />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={8} align="end">
                <Menu.Popup className="account-dropdown">
                  <div className="account-dropdown-email">
                    <img src="/icons/board/profile-circle.svg" alt="" width={20} height={20} />
                    <span>{email}</span>
                  </div>
                  <Menu.Item className="account-dropdown-logout" onClick={handleSignOut}>
                    Log out
                    <img src="/icons/board/log-out.svg" alt="" width={20} height={20} />
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
        {/* Mobile collapses everything above into one hamburger menu — see
            the "Header Menu" mobile Figma frame. .board-nav-actions and
            this trigger are CSS-toggled by breakpoint, never both visible. */}
        <Menu.Root>
          <Menu.Trigger className="board-nav-mobile-trigger" aria-label="Menu">
            <img src="/icons/board/menu-alt.svg" alt="" width={24} height={24} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner className="mobile-nav-positioner">
              <Menu.Popup className="mobile-nav-menu">
                <div className="mobile-nav-menu-item mobile-nav-menu-email">
                  <img src="/icons/board/profile-circle.svg" alt="" width={20} height={20} />
                  <span>{email}</span>
                </div>
                <Menu.Item className="mobile-nav-menu-item" onClick={handleSignOut}>
                  Log out
                  <img src="/icons/board/log-out.svg" alt="" width={20} height={20} />
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </nav>
  );
}
