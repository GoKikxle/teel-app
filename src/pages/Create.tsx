import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { CATS, fmtDate } from '../lib/constants';
import { createGathering, uploadCoverImage } from '../data/gatherings';
import type { Category, PayMethod, SplitMethod, Visibility } from '../lib/database.types';
import { SignInModal } from '../components/SignInModal';

interface ItemRow {
  name: string;
  amount: string;
}

export function Create() {
  const navigate = useNavigate();
  const { userId, ready, isPersistent } = useAuth();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [cat, setCat] = useState<Category>('hike');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('8');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [visibility, setVisibility] = useState<Visibility>('private');
  const [emails, setEmails] = useState<string[]>([]);

  const [costEnabled, setCostEnabled] = useState(false);
  const [costMethod, setCostMethod] = useState<SplitMethod>('equal');
  const [costTotal, setCostTotal] = useState('');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [payMethod, setPayMethod] = useState<PayMethod>('venmo');
  const [payHandle, setPayHandle] = useState('');

  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQ, setPollQ] = useState('');
  const [opt1, setOpt1] = useState('');
  const [opt2, setOpt2] = useState('');
  const [opt3, setOpt3] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  const itemTotal = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0),
    [items]
  );

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
  }

  function updateItem(i: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateEmail(i: number, value: string) {
    setEmails((prev) => prev.map((e, idx) => (idx === i ? value : e)));
  }

  function removeEmail(i: number) {
    setEmails((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    if (!title || !date) {
      toast('Add at least a title and date');
      return;
    }
    if (!userId) {
      toast('Still setting things up — try again in a moment');
      return;
    }

    setSubmitting(true);
    try {
      let coverImageUrl: string | null = null;
      if (imageFile) {
        coverImageUrl = await uploadCoverImage(imageFile, userId);
      }

      const cleanItems = items
        .filter((it) => it.name || it.amount)
        .map((it) => ({ name: it.name || 'Item', amount: Number(it.amount) || 0 }));
      const finalTotal = costMethod === 'itemized' ? itemTotal : Number(costTotal) || 0;
      const cleanEmails = emails.map((e) => e.trim()).filter(Boolean);
      const pollOptions = [opt1, opt2, opt3].map((o) => o.trim()).filter(Boolean);

      const id = await createGathering({
        organizerId: userId,
        title,
        category: cat,
        date,
        time,
        location,
        capacity: Number(capacity) || 8,
        coverImageUrl,
        visibility,
        invitedEmails: cleanEmails,
        costEnabled,
        splitMethod: costMethod,
        costTotal: finalTotal,
        items: cleanItems,
        payMethod,
        payHandle,
        pollEnabled,
        pollQuestion: pollQ,
        pollOptions,
      });

      navigate(`/created/${id}`);
    } catch (err) {
      console.error(err);
      toast('Something went wrong creating the gathering');
    } finally {
      setSubmitting(false);
    }
  }

  // Primary entry is gated upstream (Board/Nav's "+ New gathering" won't
  // navigate here until signed in), but this covers a direct URL visit —
  // the form itself must never render for an anonymous session.
  if (!ready) {
    return (
      <div className="wrap">
        <p className="lede">Loading…</p>
      </div>
    );
  }

  if (!isPersistent) {
    return (
      <div className="wrap">
        <div className="gate-wrap">
          <h1>Sign in to create</h1>
          <p className="lede" style={{ margin: '0 auto 22px' }}>
            You'll need to sign in so this gathering can be managed from any device.
          </p>
          <button
            className="primary-btn"
            style={{ width: 'auto', padding: '12px 26px' }}
            onClick={() => setShowSignIn(true)}
          >
            Sign in
          </button>
        </div>
        <SignInModal
          open={showSignIn}
          onClose={() => setShowSignIn(false)}
          message="Sign in to create and manage your gathering."
        />
      </div>
    );
  }

  const c = CATS[cat];
  const dateStr = date ? fmtDate(date) : 'Pick a date';
  const locStr = location || 'Add a place';

  return (
    <div className="wrap">
      <p className="eyebrow">New gathering</p>
      <h1>Pin up the details</h1>
      <p className="lede">
        Fill this in once. Everything on the right updates live — that's the flyer people will actually see.
      </p>

      <div className="create-layout">
        <div>
          <div className="field">
            <label>Title</label>
            <input
              type="text"
              placeholder="e.g. Ridge Line Sunrise Hike"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Cover image</label>
            <div className={`image-picker${imagePreview ? ' filled' : ''}`}>
              {imagePreview ? (
                <>
                  <img className="image-preview" src={imagePreview} alt="" />
                  <div className="image-actions">
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      Cover set
                    </span>
                    <button type="button" onClick={removeImage}>
                      Remove
                    </button>
                  </div>
                </>
              ) : (
                <label className="image-picker-label">
                  Tap to add a photo (optional)
                  <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                </label>
              )}
            </div>
          </div>

          <div className="field">
            <label>Category</label>
            <div className="cats">
              {(Object.entries(CATS) as [Category, typeof CATS[Category]][])
                .filter(([key]) => key !== 'other')
                .map(([key, catDef]) => (
                  <button
                    key={key}
                    type="button"
                    className={`cat-chip${cat === key ? ' active' : ''}`}
                    onClick={() => setCat(key)}
                  >
                    {catDef.label}
                  </button>
                ))}
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Location</label>
            <input
              type="text"
              placeholder="Where you're meeting"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Capacity</label>
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>

          <div className="field">
            <label>Who can access this?</label>
            <div className="mode-cards">
              {(
                [
                  ['public', 'Public', 'Anyone can find and access it'],
                  ['private', 'Private', 'Only people you share the link with'],
                  ['invited', 'Invited', 'Only the email addresses you add'],
                ] as [Visibility, string, string][]
              ).map(([key, label, sub]) => (
                <button
                  key={key}
                  type="button"
                  className={`mode-card${visibility === key ? ' active' : ''}`}
                  onClick={() => setVisibility(key)}
                >
                  <span className="mode-title">{label}</span>
                  <span className="mode-sub">{sub}</span>
                </button>
              ))}
            </div>
            {visibility === 'invited' && (
              <div>
                <label>Invited emails</label>
                <div>
                  {emails.map((email, i) => (
                    <div className="email-row" key={i}>
                      <input
                        type="text"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => updateEmail(i, e.target.value)}
                      />
                      <button type="button" className="item-remove" aria-label="Remove email" onClick={() => removeEmail(i)}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn-outline" onClick={() => setEmails((p) => [...p, ''])}>
                  + Add email
                </button>
              </div>
            )}
          </div>

          <div className="toggle-row">
            <div>
              <div className="tlabel">Split a cost</div>
              <div className="tsub">Everyone pays their share, one tap</div>
            </div>
            <button
              type="button"
              className={`switch${costEnabled ? ' on' : ''}`}
              onClick={() => setCostEnabled((v) => !v)}
            />
          </div>
          {costEnabled && (
            <div className="subfields">
              <label>Split method</label>
              <div className="radio-group">
                {(
                  [
                    ['equal', 'Equal split'],
                    ['custom', 'Set amount per person'],
                    ['itemized', 'Itemized'],
                  ] as [SplitMethod, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`radio-chip${costMethod === key ? ' active' : ''}`}
                    onClick={() => setCostMethod(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {costMethod !== 'itemized' ? (
                <div className="field">
                  <label>Total cost (£)</label>
                  <input type="number" placeholder="60" value={costTotal} onChange={(e) => setCostTotal(e.target.value)} />
                </div>
              ) : (
                <div>
                  <label>Cost items</label>
                  <div>
                    {items.map((item, i) => (
                      <div className="item-row" key={i}>
                        <input
                          type="text"
                          className="iname"
                          placeholder="e.g. Entrance fee"
                          value={item.name}
                          onChange={(e) => updateItem(i, { name: e.target.value })}
                        />
                        <input
                          type="number"
                          className="iamt"
                          placeholder="0.00"
                          value={item.amount}
                          onChange={(e) => updateItem(i, { amount: e.target.value })}
                        />
                        <button type="button" className="item-remove" aria-label="Remove item" onClick={() => removeItem(i)}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn-outline" onClick={() => setItems((p) => [...p, { name: '', amount: '' }])}>
                    + Add item
                  </button>
                  <div className="item-total">Total: £{itemTotal.toFixed(2)}</div>
                </div>
              )}

              <label style={{ marginTop: 12 }}>How should people pay?</label>
              <div className="radio-group">
                {(
                  [
                    ['venmo', 'Venmo'],
                    ['paypal', 'PayPal'],
                    ['cashapp', 'Cash App'],
                    ['monzo', 'Monzo'],
                    ['revolut', 'Revolut'],
                  ] as [PayMethod, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`radio-chip${payMethod === key ? ' active' : ''}`}
                    onClick={() => setPayMethod(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="field">
                <label>Your @handle</label>
                <input
                  type="text"
                  placeholder="e.g. sam-hikes"
                  value={payHandle}
                  onChange={(e) => setPayHandle(e.target.value)}
                />
              </div>
              <p className="mode-note">
                Teel doesn't hold or move money — it sends each guest to your payment link with the amount pre-filled,
                then tracks who's confirmed paying. ("Pay through Teel" via Stripe is coming in a later pass.)
              </p>
            </div>
          )}

          <div className="toggle-row">
            <div>
              <div className="tlabel">Add a poll</div>
              <div className="tsub">Let the group decide something</div>
            </div>
            <button
              type="button"
              className={`switch${pollEnabled ? ' on' : ''}`}
              onClick={() => setPollEnabled((v) => !v)}
            />
          </div>
          {pollEnabled && (
            <div className="subfields">
              <div className="field">
                <label>Question</label>
                <input type="text" placeholder="Which trailhead?" value={pollQ} onChange={(e) => setPollQ(e.target.value)} />
              </div>
              <div className="field opt-input">
                <label>Option A</label>
                <input type="text" placeholder="North ridge" value={opt1} onChange={(e) => setOpt1(e.target.value)} />
              </div>
              <div className="field opt-input">
                <label>Option B</label>
                <input type="text" placeholder="Riverside path" value={opt2} onChange={(e) => setOpt2(e.target.value)} />
              </div>
              <div className="field opt-input">
                <label>Option C (optional)</label>
                <input type="text" placeholder="" value={opt3} onChange={(e) => setOpt3(e.target.value)} />
              </div>
            </div>
          )}

          <button className="primary-btn" onClick={handleSubmit} disabled={submitting || !ready}>
            {submitting ? 'Creating…' : 'Create gathering'}
          </button>
        </div>

        <div className="preview-wrap">
          <div className="preview-flyer">
            <div className="stripe" />
            <div className="cat">{c.label}</div>
            <div className="title">{title || 'Your gathering title'}</div>
            <div className="meta">
              {dateStr}
              {time ? ` · ${time}` : ''}
              <br />
              {locStr}
            </div>
            {imagePreview && <div className="flyer-photo" style={{ backgroundImage: `url(${imagePreview})` }} />}
          </div>
        </div>
      </div>
    </div>
  );
}
