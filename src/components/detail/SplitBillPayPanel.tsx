import { useState } from 'react';
import type { GatheringWithRelations, Rsvp } from '../../lib/database.types';
import { markPaid, splitBillPerPerson, upsertSplitBillPayment } from '../../data/gatherings';
import { useToast } from '../../hooks/useToast';
import { useCreateGate } from '../../hooks/useCreateGate';

// Which wallet-brand button to show next to "Pay" — Apple Pay on iOS/
// Safari, Google Pay everywhere else (Figma shows both as separate
// mock frames, one per platform, not a single fixed choice). No feature
// detection API exists for "is Apple Pay actually available here", so
// this is a platform guess like any other UA-sniffed wallet-button
// choice — defaults to Google Pay when it can't tell.
function detectWalletBrand(): 'apple' | 'google' {
  if (typeof navigator === 'undefined') return 'google';
  const ua = navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const isSafariBrowser = /Safari/.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR/.test(ua);
  return isIOSDevice || isSafariBrowser ? 'apple' : 'google';
}

// en-GB's toLocaleDateString doesn't reliably include a fixed separator
// across engines — built manually, same approach as ClosedItems.tsx's
// formatClosedDate, but without the comma (Figma: "29 Aug 2026").
function fmtConfirmDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00`);
  const day = d.toLocaleDateString('en-GB', { day: 'numeric' });
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  return `${day} ${month} ${d.getFullYear()}`;
}

// Guest-facing view for a Split Bill gathering — replaces RsvpPanel entirely.
// No name is ever collected: the payment record (a bare rsvps row) is
// created silently on the first Pay click, keyed only on the guest's
// (anonymous or persistent) auth uid. Payment itself is simulated (Figma
// 1157:1677) — "Pay" is Stripe-managed copy only, no real charge — but the
// confirmation it lands on is the exact same markPaid() call the old
// manual "I've sent it" self-report used, so the progress ring/collected
// total (splitBillProgress) and the organizer's SplitBillProgressPanel
// update identically either way.
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
  const [paying, setPaying] = useState(false);
  const [wallet] = useState(detectWalletBrand);

  const fixedAmount = isDutch ? null : splitBillPerPerson(gathering);
  const amountNumber = isDutch ? Number(amount) : (fixedAmount as number);
  const canPay = isDutch ? amountNumber > 0 : true;

  async function handlePay() {
    if (!canPay) {
      toast('Enter what you owe first');
      return;
    }
    setPaying(true);
    try {
      const rsvpId = await upsertSplitBillPayment(gathering.id, userId, isDutch ? amountNumber : undefined);
      // No real Stripe/wallet integration at this stage — just a delay
      // long enough to read "Payment processing... Please wait." before
      // it resolves, matching the reference flow's timing.
      await new Promise((resolve) => setTimeout(resolve, 1600));
      await markPaid(rsvpId, true);
      onChange();
    } catch (err) {
      console.error(err);
      toast('Payment failed — try again');
    } finally {
      setPaying(false);
    }
  }

  if (myRsvp?.paid) {
    return (
      <>
        <div className="panel payment-confirmed-panel">
          <div className="payment-confirmed-graphic">
            <img src="/icons/payment/confirmed-check.svg" alt="" className="payment-confirmed-check" />
            <img src="/icons/payment/confirmed-sparkle-1.svg" alt="" className="payment-confirmed-sparkle-1" />
            <img src="/icons/payment/confirmed-sparkle-2.svg" alt="" className="payment-confirmed-sparkle-2" />
          </div>
          <h2>Payment confirmed!</h2>
          <p className="lede" style={{ margin: '0 auto' }}>
            You successfully paid your share of the bill for {gathering.title}, {gathering.location || 'TBD'},{' '}
            {fmtConfirmDate(gathering.gathering_date)}.
          </p>
        </div>
        <div className="panel">
          <p className="split-cta-copy">
            Split a bill with your friends easily on <span className="accent">Komon</span>.
          </p>
          <button className="split-cta-btn" onClick={splitBillGate.requestCreate}>
            +Split bill
          </button>
        </div>
      </>
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
            disabled={paying}
          />
        </div>
      ) : (
        <p style={{ fontWeight: 800, fontSize: 32, color: 'var(--accent)', margin: '0 0 14px' }}>£{(fixedAmount as number).toFixed(2)}</p>
      )}

      {isDutch && !canPay && <p className="step-hint" style={{ marginBottom: 8 }}>Enter an amount to continue</p>}

      <div className="pay-buttons">
        <button className="pay-btn pay-btn-accent" onClick={handlePay} disabled={paying || (isDutch && !canPay)}>
          Pay
        </button>
        <button
          className="pay-btn pay-btn-wallet"
          onClick={handlePay}
          disabled={paying || (isDutch && !canPay)}
          aria-label={wallet === 'apple' ? 'Pay with Apple Pay' : 'Pay with Google Pay'}
        >
          <img
            src={wallet === 'apple' ? '/icons/payment/apple-pay.svg' : '/icons/payment/google-pay.svg'}
            alt={wallet === 'apple' ? 'Apple Pay' : 'Google Pay'}
          />
        </button>
      </div>
      <p className="step-hint" style={{ marginTop: 8 }}>Payments are simulated for now — no card is charged.</p>

      {paying && (
        <>
          <div className="modal-backdrop" />
          <div className="modal-viewport" role="status" aria-live="polite">
            <div className="payment-processing-card">
              <img src="/icon.svg" alt="" width={24} height={24} />
              <div>
                <p className="payment-processing-title">Payment processing...</p>
                <p className="payment-processing-sub">Please wait.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
