import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { useCreateGate } from '../hooks/useCreateGate';
import { SignInModal } from './SignInModal';

export function Nav() {
  const navigate = useNavigate();
  const { installable, promptInstall } = usePwaInstall();
  const toast = useToast();
  const { isPersistent, email, signOut } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);
  const createGate = useCreateGate();

  async function handleInstall() {
    const outcome = await promptInstall();
    if (outcome === 'unavailable') toast('Use your browser’s "Add to Home Screen"');
  }

  async function handleSignOut() {
    await signOut();
    toast('Signed out');
  }

  return (
    <>
      <nav>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button className="word" onClick={() => navigate('/')}>
            Teel
          </button>
          {isPersistent ? (
            <>
              <span className="vis-badge" title={email ?? undefined}>
                {email}
              </span>
              <button
                onClick={handleSignOut}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Space Mono',monospace",
                  fontSize: 11,
                  color: 'var(--clay)',
                  padding: '2px 4px',
                  marginLeft: 2,
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <button className="vis-badge" style={{ border: 'none', cursor: 'pointer' }} onClick={() => setShowSignIn(true)}>
              Sign in
            </button>
          )}
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
          <button className="navbtn" onClick={createGate.requestCreate}>
            + New gathering
          </button>
        </div>
      </nav>
      <SignInModal open={showSignIn} onClose={() => setShowSignIn(false)} />
      <SignInModal
        open={createGate.open}
        onClose={createGate.close}
        message="Sign in to create and manage your gathering."
      />
    </>
  );
}
