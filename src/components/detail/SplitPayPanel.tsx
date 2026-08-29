import { Switch } from '@base-ui/react/switch';
import type { GatheringWithRelations, Rsvp } from '../../lib/database.types';
import { PaidRing } from '../PaidRing';
import { payLabel, buildPayUrl } from '../../lib/constants';
import { activeRsvps, markPaid, markPaidSent, paidPct, toggleReminder } from '../../data/gatherings';
import { useToast } from '../../hooks/useToast';

export function SplitPayPanel({
  gathering,
  myRsvp,
  onChange,
  readOnly = false,
}: {
  gathering: GatheringWithRelations;
  myRsvp: Rsvp | undefined;
  onChange: () => void;
  readOnly?: boolean;
}) {
  const toast = useToast();
  const going = activeRsvps(gathering);
  const paidCount = going.filter((r) => r.paid).length;
  const pct = paidPct(gathering, paidCount);

  const perPerson =
    gathering.split_method === 'custom'
      ? gathering.cost_total.toFixed(2)
      : (gathering.cost_total / Math.max(going.length, 1)).toFixed(2);

  const splitLabel =
    gathering.split_method === 'equal'
      ? 'equal split'
      : gathering.split_method === 'itemized'
        ? 'itemized, split evenly'
        : 'set per person';

  async function handleSend() {
    if (!myRsvp) return;
    const url = buildPayUrl(gathering.pay_method, gathering.pay_handle, perPerson, gathering.title);
    window.open(url, '_blank');
    try {
      await markPaidSent(myRsvp.id, true);
      onChange();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleConfirm() {
    if (!myRsvp) return;
    try {
      await markPaid(myRsvp.id, !myRsvp.paid);
      onChange();
    } catch (err) {
      console.error(err);
      toast('Could not update payment status');
    }
  }

  async function handleReminder() {
    try {
      await toggleReminder(gathering.id, !gathering.reminder_on);
      toast(!gathering.reminder_on ? 'Reminder on' : 'Reminder off');
      onChange();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="panel">
      <div className="split-head">
        <h2 style={{ marginBottom: 0 }}>
          Split &amp; pay {readOnly && <span className="vis-badge cancelled-badge">Cancelled</span>}
        </h2>
        <PaidRing pct={pct} size={40} />
      </div>
      <div className="split-amount-row">
        <span className="split-amt">£{perPerson}</span>
        <span className="split-pill">{splitLabel}</span>
      </div>
      <p className="poll-hint" style={{ marginTop: 0 }}>Total £{gathering.cost_total.toFixed(2)}</p>

      {gathering.split_method === 'itemized' && gathering.cost_items.length > 0 && (
        <ul className="item-breakdown">
          {gathering.cost_items.map((item) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <span>£{Number(item.amount).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="pay-tag">
        <p className="paylink-note">
          Pays directly to the organizer's {payLabel(gathering.pay_method)}
          {gathering.pay_handle ? (
            <>
              {' · '}
              <span style={{ fontWeight: 600 }}>@{gathering.pay_handle}</span>
            </>
          ) : (
            ''
          )}
          . Komon just tracks who's confirmed.
        </p>
      </div>

      {readOnly ? (
        <p className="step-hint">
          {myRsvp
            ? `Your payment status: ${myRsvp.paid ? 'confirmed ✓' : myRsvp.paid_sent ? 'marked as sent' : 'not paid'} — kept for your records, no action needed on a cancelled gathering.`
            : 'This gathering was cancelled before you RSVPed.'}
        </p>
      ) : !myRsvp ? (
        <p className="step-hint">RSVP above to track your payment here.</p>
      ) : (
        <div className="pay-steps">
          <div className={`pay-step${myRsvp.paid_sent ? ' complete' : ''}`}>
            <span className="step-n">1</span>
            <div className="step-body">
              <button className="btn-outline" onClick={handleSend}>
                Send £{perPerson} via {payLabel(gathering.pay_method)}
              </button>
              <span className="step-hint">Opens your payment app with the amount pre-filled</span>
            </div>
          </div>
          <div className={`pay-step${myRsvp.paid ? ' complete' : ''}`}>
            <span className="step-n">2</span>
            <div className="step-body">
              <button className={`btn-outline${myRsvp.paid ? ' done' : ''}`} onClick={handleConfirm} disabled={!myRsvp.paid_sent}>
                {myRsvp.paid ? "Confirmed ✓ · undo" : "I've sent it"}
              </button>
              <span className="step-hint">Self-confirmed — Komon can't verify the transfer itself</span>
            </div>
          </div>
        </div>
      )}

      <div className="paid-card">
        <div className="paid-card-title">Paid gatherers</div>
        <div className="paid-list">
          {going.map((r) => (
            <div className="paid-item" key={r.id}>
              <span className={`check${r.paid ? ' paid' : ''}`}>{r.paid ? '✓' : ''}</span>
              <span>{r.name}</span>
            </div>
          ))}
        </div>
      </div>

      {!readOnly && (
        <div className="toggle-row" style={{ marginTop: 14 }}>
          <div>
            <div className="tlabel" id="reminder-toggle-label">Payment reminder</div>
            <div className="tsub">We'll nudge you before it's due</div>
          </div>
          <Switch.Root
            checked={gathering.reminder_on}
            onCheckedChange={handleReminder}
            nativeButton
            render={<button type="button" />}
            className={(state) => `switch${state.checked ? ' on' : ''}`}
            aria-labelledby="reminder-toggle-label"
          />
        </div>
      )}
    </div>
  );
}
