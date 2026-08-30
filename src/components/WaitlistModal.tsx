import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { joinWaitlist } from '../data/waitlist';
import { useToast } from '../hooks/useToast';
import { Logo } from './Logo';

// The "Komon waitlist form" Figma frame — a dedicated signup modal distinct
// from the /signin page (that one checks approval + sends a magic link;
// this one only writes to the waitlist table via joinWaitlist, same as the
// old inline email form it replaces). Kept as its own component/stylesheet
// scope (.waitlist-modal-*) rather than reusing QRModal's shared .modal-* —
// its backdrop, card width, and field layout all differ from that shared modal.
export function WaitlistModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const firstNameRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setFirstName('');
      setLastName('');
      setEmail('');
      setStatus('idle');
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const emailVal = email.trim();
    if (!firstName.trim() || !lastName.trim() || !emailVal) {
      toast('Fill in your name and email first');
      return;
    }
    setStatus('sending');
    try {
      const result = await joinWaitlist(emailVal, firstName, lastName);
      setStatus('done');
      toast(result === 'already' ? "You're already on the list" : "You're on the list!");
      onClose();
    } catch (err) {
      console.error(err);
      setStatus('idle');
      toast('Could not join — try again');
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="waitlist-modal-backdrop" />
        <Dialog.Viewport className="waitlist-modal-viewport">
          <Dialog.Popup className="waitlist-modal-card" initialFocus={firstNameRef}>
            <div className="waitlist-modal-content">
              <Logo />
              <form onSubmit={handleSubmit} className="waitlist-modal-form">
                <div className="waitlist-modal-fields">
                  <Dialog.Title className="waitlist-modal-title">Join our waitlist</Dialog.Title>
                  <div className="waitlist-modal-row">
                    <label className="waitlist-modal-field">
                      <span>First Name</span>
                      <input
                        ref={firstNameRef}
                        type="text"
                        placeholder="John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        disabled={status === 'sending'}
                        required
                      />
                    </label>
                    <label className="waitlist-modal-field">
                      <span>Last Name</span>
                      <input
                        type="text"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        disabled={status === 'sending'}
                        required
                      />
                    </label>
                  </div>
                  <label className="waitlist-modal-field">
                    <span>Email address</span>
                    <input
                      type="email"
                      placeholder="john@abc.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={status === 'sending'}
                      required
                    />
                  </label>
                </div>
                <div className="waitlist-modal-actions">
                  <button type="submit" className="waitlist-modal-submit" disabled={status === 'sending'}>
                    {status === 'sending' ? 'Submitting…' : 'Submit email'}
                  </button>
                  <Dialog.Close type="button" className="waitlist-modal-cancel">
                    Cancel
                  </Dialog.Close>
                </div>
              </form>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
