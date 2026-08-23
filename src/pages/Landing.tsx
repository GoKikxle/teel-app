import { useState } from 'react';
import { useCreateGate } from '../hooks/useCreateGate';
import { SignInModal } from '../components/SignInModal';

// Anonymous visitors land here at '/' instead of the board — see Home.tsx,
// which renders this only when there's no signed-in session. Signed-in
// sessions always get the real board immediately, never this page.
export function Landing() {
  const createGate = useCreateGate();
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <div className="wrap">
      <div className="gate-wrap">
        <p className="eyebrow">Komon</p>
        <h1>Small gatherings, sorted.</h1>
        <p className="lede" style={{ margin: '0 auto 22px' }}>
          Create a gathering or split a bill and share one link — no app to install, no account needed for your
          guests. RSVPs, splits and polls, all in one place.
        </p>
        <button
          className="primary-btn"
          style={{ width: 'auto', padding: '12px 26px', marginBottom: 12 }}
          onClick={createGate.requestCreate}
        >
          Get Started
        </button>
        <br />
        <button className="btn-outline" onClick={() => setShowSignIn(true)}>
          Sign In
        </button>
      </div>

      <SignInModal
        open={createGate.open}
        onClose={createGate.close}
        message="Sign in to create and manage your gathering."
      />
      <SignInModal open={showSignIn} onClose={() => setShowSignIn(false)} />
    </div>
  );
}
