import { useEffect, useState } from 'react';
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { useCreateGate } from '../hooks/useCreateGate';
import { fetchGatheringKind } from '../data/gatherings';
import type { GatheringKind } from '../lib/database.types';
import { SignInModal } from './SignInModal';
import { Wordmark } from './Wordmark';

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
      <>
        <nav>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="word" onClick={() => navigate('/')}>
              <Wordmark />
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
        <SignInModal
          open={gate.open}
          onClose={gate.close}
          message={
            isSplitBillView ? 'Sign in to create and manage your split bill.' : 'Sign in to create and manage your gathering.'
          }
        />
      </>
    );
  }

  // Anonymous visitor anywhere else — the root path renders its own
  // marketing landing page for this case (see Home.tsx/Landing.tsx), with
  // its own Get Started / Sign In actions, so this bar stays out of its way
  // rather than duplicating them.
  if (!isPersistent) {
    return (
      <nav>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button className="word" onClick={() => navigate('/')}>
            <Wordmark />
          </button>
        </div>
      </nav>
    );
  }

  return (
    <>
      <nav>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button className="word" onClick={() => navigate('/')}>
            <Wordmark />
          </button>
          <span className="vis-badge" title={email ?? undefined}>
            {email}
          </span>
          <button
            onClick={handleSignOut}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--danger)',
              padding: '2px 4px',
              marginLeft: 2,
            }}
          >
            Log out
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {installable && (
            <button className="navbtn ghost" onClick={handleInstall}>
              Install app
            </button>
          )}
          <Link to="/" className="navbtn ghost" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Board
          </Link>
          <button className="navbtn ghost" onClick={createGate.requestCreate}>
            + New gathering
          </button>
          <button className="navbtn" onClick={splitBillGate.requestCreate}>
            + Split Bill
          </button>
        </div>
      </nav>
      <SignInModal
        open={createGate.open}
        onClose={createGate.close}
        message="Sign in to create and manage your gathering."
      />
      <SignInModal
        open={splitBillGate.open}
        onClose={splitBillGate.close}
        message="Sign in to create and manage your split bill."
      />
    </>
  );
}
