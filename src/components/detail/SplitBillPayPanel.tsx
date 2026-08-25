import { useState } from 'react';
import type { GatheringWithRelations, Rsvp } from '../../lib/database.types';
import { payLabel, buildPayUrl } from '../../lib/constants';
import { markPaid, markPaidSent, splitBillPerPerson, upsertSplitBillPayment } from '../../data/gatherings';
import { useToast } from '../../hooks/useToast';
import { useCreateGate } from '../../hooks/useCreateGate';
import { SignInModal } from '../SignInModal';

// Guest-facing view for a Split Bill gathering — replaces RsvpPanel entirely.
// No name is ever collected: the payment record (a bare rsvps row) is
// created silently on the first "Send" click, keyed only on the guest's
// (anonymous or persistent) auth uid. Reuses the same two-step direct-pay
// interaction as SplitPayPanel (Send -> "I've sent it"), just without any
// of the named-guest-list machinery that panel assumes.
export function SplitBillPayPanel({
  gathering,
  userId,
  myRsvp,
  onChange,
}: {
  gathering: GatheringWithRelations;
  userId: string;
  myRsvp: Rsvp | undefined;
  onChange: () => void;
}) {
  const toast = useToast();
  const splitBillGate = useCreateGate('/split/create');
  const isDutch = gathering.split_method === 'dutch';
  const [amount, setAmount] = useState(() => (myRsvp?.amount_owed != null ? String(myRsvp.amount_owed) : ''));
  const [sending, setSending] = useState(false);
  // Local only, never derived from myRsvp.paid — a reload always shows the
  // normal "Confirmed ✓ · undo" state, this one-time screen is purely the
  // immediate result of this session's own confirm click.
  const [justConfirmed, setJustConfirmed] = useState(false);

  const fixedAmount = isDutch ? null : splitBillPerPerson(gathering);
  const amountNumber = isDutch ? Number(amount) : (fixedAmount as number);
  const canSend = isDutch ? amountNumber > 0 : true;

  async function handleSend() {
    if (!canSend) {
      toast('Enter what you owe first');
      return;
    }
    setSending(true);
    try {
      const rsvpId = await upsertSplitBillPayment(gathering.id, userId, isDutch ? amountNumber : undefined);
      const url = buildPayUrl(gathering.pay_method, gathering.pay_handle, amountNumber.toFixed(2), gathering.title);
      window.open(url, '_blank');
      await markPaidSent(rsvpId, true);
      onChange();
    } catch (err) {
      console.error(err);
      toast('Could not start payment — try again');
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm() {
    if (!myRsvp) return;
    const nextPaid = !myRsvp.paid;
    try {
      await markPaid(myRsvp.id, nextPaid);
      if (nextPaid) setJustConfirmed(true);
      onChange();
    } catch (err) {
      console.error(err);
      toast('Could not update payment status');
    }
  }

  if (justConfirmed) {
    return (
      <div className="panel" style={{ textAlign: 'center' }}>
        <div className="success-check">✓</div>
        <h2>Payment confirmed</h2>
        <p className="lede" style={{ margin: '0 auto 18px' }}>
          You're all set — the organizer can see you've paid.
        </p>
        <button
          className="primary-btn"
          style={{ width: 'auto', padding: '12px 26px' }}
          onClick={splitBillGate.requestCreate}
        >
          Split a bill
        </button>
        <SignInModal
          open={splitBillGate.open}
          onClose={splitBillGate.close}
          message="Sign in to create and manage your split bill."
        />
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>{isDutch ? 'What do you owe?' : 'Your share'}</h2>

      {isDutch ? (
        <div className="field">
          <label>Amount (£)</label>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={Boolean(myRsvp?.paid_sent)}
          />
        </div>
      ) : (
        <p style={{ fontWeight: 800, fontSize: 32, color: 'var(--accent)', margin: '0 0 14px' }}>£{(fixedAmount as number).toFixed(2)}</p>
      )}

      <p className="paylink-note">
        Pays directly to the organizer's {payLabel(gathering.pay_method)}
        {gathering.pay_handle ? ` · @${gathering.pay_handle}` : ''}. Komon just tracks who's confirmed.
      </p>

      <div className="pay-steps">
        <div className={`pay-step${myRsvp?.paid_sent ? ' complete' : ''}`}>
          <span className="step-n">1</span>
          <div className="step-body">
            <button className="btn-outline" onClick={handleSend} disabled={sending || (isDutch && !canSend)}>
              {isDutch && !canSend ? 'Enter an amount to continue' : `Send £${amountNumber.toFixed(2)} via ${payLabel(gathering.pay_method)}`}
            </button>
            <span className="step-hint">Opens your payment app with the amount pre-filled</span>
          </div>
        </div>
        <div className={`pay-step${myRsvp?.paid ? ' complete' : ''}`}>
          <span className="step-n">2</span>
          <div className="step-body">
            <button className={`btn-outline${myRsvp?.paid ? ' done' : ''}`} onClick={handleConfirm} disabled={!myRsvp?.paid_sent}>
              {myRsvp?.paid ? "Confirmed ✓ · undo" : "I've sent it"}
            </button>
            <span className="step-hint">Self-confirmed — Komon can't verify the transfer itself</span>
          </div>
        </div>
      </div>
    </div>
  );
}
