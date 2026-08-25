import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

// Shared by Nav (proactive, no follow-up action) and Create (gated at the
// "Create gathering" click — see Create.tsx's pendingSubmit effect, which
// watches isPersistent and resumes creation once this modal's magic link is
// confirmed). This component only owns the send-link UI; it closes itself
// as soon as the session becomes persistent, wherever that call comes from.
export function SignInModal({ open, onClose, message }: { open: boolean; onClose: () => void; message?: string }) {
  const { isPersistent, signInWithOtp } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && isPersistent) onClose();
  }, [open, isPersistent, onClose]);

  useEffect(() => {
    if (open) {
      setEmail('');
      setSent(false);
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
    const { error } = await signInWithOtp(val);
    setSending(false);
    if (error) {
      toast(error);
      return;
    }
    setSent(true);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="modal-backdrop" />
        <Dialog.Viewport className="modal-viewport">
          <Dialog.Popup className="modal-card" initialFocus={sent ? true : emailInputRef}>
            <div className="modal-card-inner">
              <Dialog.Close className="modal-close" aria-label="Close">
                ✕
              </Dialog.Close>
              {sent ? (
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
                    {sending ? 'Sending…' : 'Send sign-in link'}
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
