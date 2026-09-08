import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

type Stage = 'form' | 'sent' | 'waitlisted';

// Figma 1157:3070 "Sign in" — standalone page, not a modal (replaces the
// old SignInModal.tsx). Reached via useCreateGate's requestCreate() or a
// direct navigate() from Create.tsx/SplitBillCreate.tsx's own anonymous
// gate, always as /signin?next=<path-to-resume>. The magic-link cross-tab
// mechanism is unchanged from the old modal — clicking the emailed link
// opens a new tab, auth-js syncs the session into this tab via
// localStorage, isPersistent flips true here, and the effect below
// navigates on to `next` automatically. No page reload involved.
export function SignIn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') || '/';
  const { isPersistent, requestSignIn } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [sending, setSending] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPersistent) navigate(next, { replace: true });
  }, [isPersistent, next, navigate]);

  async function handleSend() {
    const val = email.trim();
    if (!val) {
      toast('Enter an email first');
      return;
    }
    setSending(true);
    // The approval check and the decision to send a link or record a
    // waitlist entry both happen server-side, in api/signin.ts — this just
    // renders whichever of the two outcomes comes back. A failed request
    // (status: 'error') is never treated as either.
    const result = await requestSignIn(val);
    setSending(false);
    if (result.status === 'sent') {
      setStage('sent');
    } else if (result.status === 'waitlisted') {
      setStage('waitlisted');
    } else {
      toast(result.message || 'Something went wrong — try again');
    }
  }

  return (
    <div className="signin-page">
      <div className="signin-content">
        {stage === 'sent' ? (
          <>
            <h1 className="signin-heading">Check your email</h1>
            <p className="signin-lede">
              We sent a sign-in link to {email}. Open it on this device to continue — this page will pick it up
              automatically.
            </p>
          </>
        ) : stage === 'waitlisted' ? (
          <>
            <h1 className="signin-heading">You're on the list</h1>
            <p className="signin-lede">We'll email you when Komon opens up.</p>
          </>
        ) : (
          <>
            <h1 className="signin-heading">Sign In</h1>
            <div className="signin-field">
              <label htmlFor="signin-email">Email address</label>
              <input
                id="signin-email"
                ref={emailInputRef}
                type="email"
                placeholder="john@abc.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                autoFocus
              />
            </div>
            <button className="signin-submit" onClick={handleSend} disabled={sending}>
              {sending ? 'Checking…' : 'Sign in'}
            </button>
            <div className="signin-divider" />
            {/* Visual only — no signInWithOAuth wired up yet, there's no
                Google provider configured on the Supabase project. */}
            <button className="signin-google" disabled title="Google sign-in isn't available yet">
              <img src="/icons/auth/google-g.svg" alt="" width={16} height={16} />
              Sign In with Google
            </button>
          </>
        )}
      </div>
    </div>
  );
}
