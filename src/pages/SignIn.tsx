import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { checkWaitlistApproval } from '../data/waitlist';

type Stage = 'form' | 'sent' | 'notApproved';

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
  const { isPersistent, signInWithOtp } = useAuth();
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
    try {
      // Fail closed: any thrown error below (network failure, RPC error)
      // lands in the catch block and stops here — signInWithOtp is never
      // reached unless checkWaitlistApproval resolved true. A failed check
      // is never treated as an approval.
      //
      // Read-only: this never writes to waitlist. Joining the list is a
      // separate, explicit action on the landing page's own form — an
      // unapproved or unrecognized email here just gets turned away, not
      // silently enrolled as a side effect of a failed sign-in attempt.
      const approved = await checkWaitlistApproval(val);
      if (!approved) {
        setSending(false);
        setStage('notApproved');
        return;
      }

      const { error } = await signInWithOtp(val);
      setSending(false);
      if (error) {
        toast(error);
        return;
      }
      setStage('sent');
    } catch (err) {
      console.error(err);
      setSending(false);
      toast('Something went wrong — try again');
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
        ) : stage === 'notApproved' ? (
          <>
            <h1 className="signin-heading">You're not on the approved list yet</h1>
            <p className="signin-lede">
              Komon is invite-only for now, and {email} hasn't been approved. If you haven't already, join the
              waitlist from the homepage — we'll email you once you're in.
            </p>
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
