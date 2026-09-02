import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@base-ui/react/switch';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { BackLink } from '../components/BackLink';
import {
  createPoll,
  fetchLinkPreview,
  initialsBadge,
  OptionImageTooLargeError,
  optionHasBadge,
  parseLinkMeta,
  uploadPollOptionImage,
  type CreatePollOptionInput,
} from '../data/polls';
import type { ChartStyle, LinkMeta } from '../lib/database.types';

interface DraftOption {
  key: string;
  label: string;
  emoji: string;
  imageFile: File | null;
  imagePreview: string | null;
  linkUrl: string;
  linkMeta: LinkMeta | null;
  linkChecking: boolean;
}

let optKeySeq = 0;
function newOption(emoji: string): DraftOption {
  optKeySeq += 1;
  return { key: `opt${optKeySeq}`, label: '', emoji, imageFile: null, imagePreview: null, linkUrl: '', linkMeta: null, linkChecking: false };
}

const EMOJI_ROTATION = ['🎉', '✨', '🔥', '⭐', '🍀', '🎈'];
// A plausible, always-summing-to-100 spread so the style previews below
// look like a real result rather than an empty chart — ported verbatim
// from the reviewed prototype's fakeDistribution.
const FAKE_BASE = [58, 42, 30, 22, 16, 12];
function fakeDistribution(n: number): number[] {
  if (n <= 0) return [];
  const slice = FAKE_BASE.slice(0, n);
  while (slice.length < n) slice.push(10);
  const sum = slice.reduce((a, b) => a + b, 0);
  return slice.map((v) => Math.round((v / sum) * 100));
}

// Figma-less feature (built from the reviewed prototype, not a Figma pull)
// — Alias Polls' Create screen. Gated like Create.tsx's own direct-URL
// fallback: redirects straight to /signin rather than an intermediate
// screen, no separate entry-point button exists yet (out of this task's
// scope — only the three routes were asked for).
export function PollCreate() {
  const navigate = useNavigate();
  const { userId, ready, isPersistent } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (ready && !isPersistent) navigate('/signin?next=/poll/new', { replace: true });
  }, [ready, isPersistent, navigate]);

  const [title, setTitle] = useState('');
  const [options, setOptions] = useState<DraftOption[]>([newOption('💙'), newOption('💗')]);
  const [chartStyle, setChartStyle] = useState<ChartStyle>('card');
  const [allowMessages, setAllowMessages] = useState(true);
  const [suspenseMode, setSuspenseMode] = useState(true);
  const [commentsLive, setCommentsLive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  function updateOption(key: string, patch: Partial<DraftOption>) {
    setOptions((prev) => prev.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  }

  function addOption() {
    setOptions((prev) => [...prev, newOption(EMOJI_ROTATION[prev.length % EMOJI_ROTATION.length])]);
  }

  function removeOption(key: string) {
    setOptions((prev) => (prev.length > 2 ? prev.filter((o) => o.key !== key) : prev));
  }

  async function handleImageChange(key: string, file: File | null) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('That file is a bit large (over 5MB) — try a smaller one.');
      return;
    }
    updateOption(key, { imageFile: file, imagePreview: URL.createObjectURL(file) });
  }

  function removeImage(key: string) {
    updateOption(key, { imageFile: null, imagePreview: null });
  }

  // Debounced: parseLinkMeta runs instantly on every keystroke for the
  // status label, but the real server-side scrape only fires once typing
  // pauses — no reason to hit the endpoint on every character.
  function handleLinkChange(key: string, value: string) {
    const meta = value.trim() ? parseLinkMeta(value.trim()) : null;
    updateOption(key, { linkUrl: value, linkMeta: meta, linkChecking: Boolean(meta) });
    if (!meta) return;
    const val = value.trim();
    window.setTimeout(async () => {
      // Stale-response guard: re-read current state before applying —
      // if the field changed again since this timer was set, drop the result.
      const preview = await fetchLinkPreview(val);
      setOptions((prev) =>
        prev.map((o) => {
          if (o.key !== key || o.linkUrl.trim() !== val) return o;
          const resolvedMeta: LinkMeta = {
            host: preview?.host || meta.host,
            name: (preview?.title && preview.title.trim()) || meta.name,
            imageUrl: preview?.imageUrl ?? null,
          };
          return { ...o, linkMeta: resolvedMeta, linkChecking: false, label: o.label.trim() ? o.label : resolvedMeta.name };
        })
      );
    }, 500);
  }

  async function handleCreate() {
    const cleanTitle = title.trim();
    const cleanOptions = options.filter((o) => o.label.trim().length);
    if (!cleanTitle) {
      toast('Add a question first');
      return;
    }
    if (cleanOptions.length < 2) {
      toast('Add at least two options first');
      return;
    }
    if (!userId) {
      toast('Still setting things up — try again in a moment');
      return;
    }

    setSubmitting(true);
    try {
      const resolvedOptions: CreatePollOptionInput[] = [];
      for (const opt of cleanOptions) {
        let imageUrl: string | null = null;
        if (opt.imageFile) {
          try {
            imageUrl = await uploadPollOptionImage(opt.imageFile, userId);
          } catch (err) {
            if (err instanceof OptionImageTooLargeError) {
              toast(err.message);
              setSubmitting(false);
              return;
            }
            throw err;
          }
        }
        resolvedOptions.push({
          label: opt.label.trim(),
          emoji: imageUrl || opt.linkUrl.trim() ? null : opt.emoji || null,
          image_url: imageUrl,
          link_url: opt.linkUrl.trim() || null,
          link_meta: opt.linkUrl.trim() ? opt.linkMeta : null,
        });
      }

      const pollId = await createPoll({
        organizerId: userId,
        title: cleanTitle,
        chartStyle,
        suspenseMode,
        commentsLive,
        allowMessages,
        options: resolvedOptions,
      });
      navigate(`/poll/${pollId}/organize?created=1`);
    } catch (err) {
      console.error(err);
      toast('Something went wrong creating the poll');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !isPersistent) {
    return (
      <div className="wrap">
        <p className="lede">Loading…</p>
      </div>
    );
  }

  const pcts = fakeDistribution(options.filter((o) => o.label.trim()).length || options.length);
  const previewOptions = options.filter((o) => o.label.trim()).length ? options.filter((o) => o.label.trim()) : options;

  return (
    <div className="wrap">
      <BackLink label="Poll" onClick={() => navigate('/')} />
      <div className="panel poll-create-panel">
        <h1>Set up a poll</h1>
        <p className="lede">
          No group chat, no shared contacts. Anyone with the link can vote under an alias — you're the only one who
          ever sees a real name.
        </p>

        <div className="field">
          <label>Question</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Boy or girl?" />
        </div>

        <div className="field">
          <label>Options</label>
          <p className="poll-hint" style={{ marginTop: 0 }}>
            Add an emoji, image, or GIF to each — it rides the bar on the results chart
          </p>
        </div>

        {options.map((opt) => (
          <div className="poll-opt-block" key={opt.key}>
            <div className="poll-opt-row">
              <div className="poll-opt-avatar-wrap">
                <button
                  type="button"
                  className={`poll-opt-avatar-btn${opt.imagePreview || opt.linkMeta ? ' has-image' : ''}`}
                  onClick={() => document.getElementById(`poll-opt-file-${opt.key}`)?.click()}
                  title={opt.imagePreview ? 'Replace image or GIF' : 'Add an image or GIF'}
                >
                  {opt.imagePreview ? (
                    <img src={opt.imagePreview} alt="" />
                  ) : opt.linkMeta ? (
                    opt.linkMeta.imageUrl ? (
                      <img src={opt.linkMeta.imageUrl} alt="" />
                    ) : (
                      <PollInitialsBadge meta={opt.linkMeta} />
                    )
                  ) : (
                    '📷'
                  )}
                </button>
                <input
                  id={`poll-opt-file-${opt.key}`}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => handleImageChange(opt.key, e.target.files?.[0] ?? null)}
                />
                {opt.imagePreview && (
                  <button
                    type="button"
                    className="poll-opt-avatar-remove"
                    onClick={() => removeImage(opt.key)}
                    title="Remove image, use emoji instead"
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* A picture (uploaded or link-derived) always wins over the
                  emoji, so the field is redundant once one is set — hidden
                  rather than left sitting there doing nothing. */}
              {!opt.imagePreview && !opt.linkMeta && (
                <input
                  type="text"
                  className="poll-opt-emoji-input"
                  maxLength={4}
                  placeholder="🙂"
                  value={opt.emoji}
                  onChange={(e) => updateOption(opt.key, { emoji: e.target.value })}
                  title="Emoji — used when there's no image or link"
                />
              )}

              <input
                type="text"
                className="poll-opt-label-input"
                value={opt.label}
                onChange={(e) => updateOption(opt.key, { label: e.target.value })}
                placeholder="Option label"
              />
              {options.length > 2 && (
                <button type="button" className="poll-opt-remove" onClick={() => removeOption(opt.key)} aria-label="Remove option">
                  −
                </button>
              )}
            </div>

            <div className="poll-opt-link-row">
              <input
                type="text"
                className="poll-opt-link-input"
                placeholder="🔗 Or paste a link — restaurant site, Google Maps…"
                value={opt.linkUrl}
                onChange={(e) => handleLinkChange(opt.key, e.target.value)}
              />
              <span className={`poll-opt-link-status${opt.linkMeta ? '' : ' bad'}`}>
                {!opt.linkUrl ? '' : opt.linkChecking ? 'Checking…' : opt.linkMeta ? `✓ ${opt.linkMeta.host}` : "That doesn't look like a full link yet"}
              </span>
            </div>
          </div>
        ))}
        <button type="button" className="poll-add-opt" onClick={addOption}>
          + Add option
        </button>

        <div className="field">
          <label>Results chart style</label>
          <p className="poll-hint" style={{ marginTop: 0, marginBottom: 10 }}>
            Preview uses your options above — pick whichever reads better.
          </p>
          <div className="poll-style-grid">
            <button type="button" className={`poll-style-card${chartStyle === 'card' ? ' active' : ''}`} onClick={() => setChartStyle('card')}>
              <div className="poll-style-thumb">
                <PollMiniCardPreview options={previewOptions} pcts={pcts} />
              </div>
              <span className="poll-style-label">Row card</span>
            </button>
            <button type="button" className={`poll-style-card${chartStyle === 'columns' ? ' active' : ''}`} onClick={() => setChartStyle('columns')}>
              <div className="poll-style-thumb">
                <PollMiniColumnsPreview options={previewOptions} pcts={pcts} />
              </div>
              <span className="poll-style-label">Columns</span>
            </button>
          </div>
        </div>

        <PollToggleRow
          id="allowMsg"
          label="Let voters attach a message"
          hint={'Short note next to their vote — "Team Girl! 💗" — shown under their alias, never their name.'}
          checked={allowMessages}
          onChange={setAllowMessages}
        />
        <div className="toggle-row">
          <div>
            <div className="tlabel">Ask for a name before voting</div>
            <div className="tsub">Stops repeat votes and lets you know who's who. Only you ever see it.</div>
          </div>
          <Switch.Root checked disabled nativeButton render={<button type="button" />} className="switch on" aria-label="Ask for a name before voting (always on)" />
        </div>
        <PollToggleRow
          id="suspenseMode"
          label="Hide results until you reveal them"
          hint="Guests watch votes roll in but can't see the breakdown — you trigger the reveal moment when everyone's ready."
          checked={suspenseMode}
          onChange={setSuspenseMode}
        />
        <PollToggleRow
          id="commentsLive"
          label="Show comments & activity live"
          hint="Guests watch the message wall fill up as people vote. Turn off to reveal it all at once when you close the poll."
          checked={commentsLive}
          onChange={setCommentsLive}
        />

        <button className="primary-btn" style={{ marginTop: 22 }} onClick={handleCreate} disabled={submitting}>
          {submitting ? 'Creating…' : 'Create poll'}
        </button>
      </div>
    </div>
  );
}

function PollToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <div>
        <div className="tlabel" id={`${id}-label`}>{label}</div>
        <div className="tsub">{hint}</div>
      </div>
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        nativeButton
        render={<button type="button" />}
        className={(state) => `switch${state.checked ? ' on' : ''}`}
        aria-labelledby={`${id}-label`}
      />
    </div>
  );
}

function PollInitialsBadge({ meta }: { meta: LinkMeta }) {
  const badge = initialsBadge(meta);
  return (
    <span className="poll-initials-badge" style={{ background: badge.bg, color: badge.fg }}>
      {badge.initials}
    </span>
  );
}

function optionBadgeContent(opt: DraftOption) {
  if (opt.imagePreview) return <img src={opt.imagePreview} alt="" />;
  if (opt.linkMeta) return opt.linkMeta.imageUrl ? <img src={opt.linkMeta.imageUrl} alt="" /> : <PollInitialsBadge meta={opt.linkMeta} />;
  if (opt.emoji) return opt.emoji;
  return null;
}

function PollMiniCardPreview({ options, pcts }: { options: DraftOption[]; pcts: number[] }) {
  return (
    <>
      {options.map((opt, i) => (
        <div className="poll-mini-card-row" key={opt.key}>
          <span className="poll-mini-thumb">{optionHasBadge({ image_url: opt.imagePreview, link_url: opt.linkMeta ? opt.linkUrl : null, emoji: opt.emoji }) ? optionBadgeContent(opt) : '·'}</span>
          <div className="poll-mini-bar-track">
            <div className="poll-mini-bar" style={{ width: `${pcts[i] || 0}%` }} />
          </div>
        </div>
      ))}
    </>
  );
}

function PollMiniColumnsPreview({ options, pcts }: { options: DraftOption[]; pcts: number[] }) {
  return (
    <div className="poll-mini-cols">
      {options.map((opt, i) => (
        <div className="poll-mini-col" key={opt.key}>
          <span className="poll-mini-thumb sm">{optionHasBadge({ image_url: opt.imagePreview, link_url: opt.linkMeta ? opt.linkUrl : null, emoji: opt.emoji }) ? optionBadgeContent(opt) : '·'}</span>
          <div className="poll-mini-col-track">
            <div className="poll-mini-col-fill" style={{ height: `${pcts[i] || 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
