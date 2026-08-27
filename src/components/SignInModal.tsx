import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { checkWaitlistApproval } from '../data/waitlist';

type Stage = 'form' | 'sent' | 'notApproved';

// Shared by Nav (proactive, no follow-up action), Create (gated at the
// "Create gathering" click — see Create.tsx's pendingSubmit effect, which
// watches isPersistent and resumes creation once this modal's magic link is
// confirmed), and every other create-gate call site (Split Bill, the guest
// "create your own" CTAs). signInWithOtp has exactly one caller in the
// whole app — the handleSend below — which is why the waitlist approval
// check lives here rather than duplicated at each call site.
export function SignInModal({ open, onClose, message }: { open: boolean; onClose: () => void; message?: string }) {
  const { isPersistent, signInWithOtp } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [sending, setSending] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && isPersistent) onClose();
  }, [open, isPersistent, onClose]);

  useEffect(() => {
    if (open) {
      setEmail('');
      setStage('form');
      setSending(false);
    }
  }, [open]);

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
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="modal-backdrop" />
        <Dialog.Viewport className="modal-viewport">
          <Dialog.Popup className="modal-card" initialFocus={stage === 'form' ? emailInputRef : true}>
            <div className="modal-card-inner">
              <Dialog.Close className="modal-close" aria-label="Close">
                ✕
              </Dialog.Close>
              {stage === 'sent' ? (
                <>
                  <div className="lock" style={{ fontSize: 36, marginBottom: 6 }}>
                    ✉
                  </div>
                  <Dialog.Title>Check your email</Dialog.Title>
                  <p className="lede" style={{ margin: '0 auto' }}>
                    We sent a sign-in link to {email}. Open it on this device to continue — this window will pick it
                    up automatically.
                  </p>
                </>
              ) : stage === 'notApproved' ? (
                <>
                  <div className="lock" style={{ fontSize: 36, marginBottom: 6 }}>
                    ◐
                  </div>
                  <Dialog.Title>You're not on the approved list yet</Dialog.Title>
                  <p className="lede" style={{ margin: '0 auto' }}>
                    Komon is invite-only for now, and {email} hasn't been approved. If you haven't already, join the
                    waitlist from the homepage — we'll email you once you're in.
                  </p>
                </>
              ) : (
                <>
                  <Dialog.Title>Sign in</Dialog.Title>
                  <p className="lede" style={{ margin: '0 auto 18px' }}>
                    {message || "We'll email you a link — no password needed."}
                  </p>
                  <input
                    ref={emailInputRef}
                    type="text"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    style={{ marginBottom: 12 }}
                  />
                  <button className="primary-btn" onClick={handleSend} disabled={sending}>
                    {sending ? 'Checking…' : 'Send sign-in link'}
                  </button>
                </>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
