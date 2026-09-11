import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import {
  aliasLooksLikeRealName,
  castVote,
  fetchPoll,
  fetchPollOptions,
  fetchPollVotesPublic,
  formatCloseCountdown,
  formatDuration,
  guestCanSeeResults,
  wallUnlocked,
} from '../data/polls';
import type { AliasPoll, AliasPollOption, AliasPollVotePublic } from '../lib/database.types';
import { PollTally } from '../components/polls/PollTally';
import { PollOptionBadge } from '../components/polls/PollOptionBadge';
import { PollWall } from '../components/polls/PollWall';
import { PollStatusPill } from '../components/polls/PollStatusPill';
import { PollVoterRow } from '../components/polls/PollVoterRow';
import { PollWinnerHero } from '../components/polls/PollWinnerHero';
import { withTimeout } from '../lib/withTimeout';

// A hung fetch (dead network, a backgrounded tab) used to leave `loading`
// true forever with no error and no retry — reported as the guest voting
// page "not fully loading." Bounding it turns that into a visible error
// with a retry action instead.
const LOAD_TIMEOUT_MS = 15000;

// No emoji-avatar generation exists anymore (round 5 removed the alias
// Shuffle/emoji UI — see the alias field below) but alias_avatar is still
// a not-null column (see 0010_alias_polls.sql) and nothing renders it
// (PollWall/PollVoterRow render initials-based avatars via
// aliasColor/aliasInitials instead) — this fixed default is the least-
// disruptive fallback, not a reintroduction of the old generator.
const DEFAULT_ALIAS_AVATAR = '🙂';

// Figma-less feature (built from the reviewed prototype) — Alias Polls'
// guest-facing vote screen, mirroring Detail.tsx's shape (no account
// required, fetch-once + refetch-after-write). Voting stays open the
// whole time the poll is 'open' — no "you already voted" gate exists,
// since there's no identity to check it against (v1 non-goal).
export function PollVote() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [poll, setPoll] = useState<AliasPoll | null>(null);
  const [options, setOptions] = useState<AliasPollOption[]>([]);
  const [votes, setVotes] = useState<AliasPollVotePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [voterName, setVoterName] = useState('');
  // Plain typed field now (round 5 removed the generated Shuffle/emoji
  // alias) — starts empty, the guest must type one, no auto-generated
  // default.
  const [aliasName, setAliasName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [justVoted, setJustVoted] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setLoadError(false);
    withTimeout(Promise.all([fetchPoll(id), fetchPollOptions(id), fetchPollVotesPublic(id)]), LOAD_TIMEOUT_MS)
      .then(([p, opts, v]) => {
        setPoll(p);
        setOptions(opts);
        setVotes(v);
      })
      .catch((err) => {
        console.error(err);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="wrap">
        <p className="lede">Loading…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="wrap">
        <p className="lede">
          Couldn't load this poll.{' '}
          <button type="button" className="link-btn" onClick={load}>
            Try again
          </button>
        </p>
      </div>
    );
  }

  if (!poll || !id) {
    return (
      <div className="wrap">
        <p className="lede">Poll not found.</p>
      </div>
    );
  }

  const nudge = aliasLooksLikeRealName(voterName, aliasName);
  const canSubmit = Boolean(selectedOption) && voterName.trim().length > 0 && aliasName.trim().length > 0;

  async function handleSubmit() {
    if (!selectedOption) return;
    const name = voterName.trim();
    const displayAlias = aliasName.trim();
    if (!name || !displayAlias) {
      toast("Add your name and an alias first — your name stays private, only the alias is shown.");
      return;
    }
    setSubmitting(true);
    try {
      await castVote({
        pollId: id!,
        optionId: selectedOption,
        realName: name,
        alias: displayAlias,
        aliasAvatar: DEFAULT_ALIAS_AVATAR,
        message: poll!.allow_messages ? message.trim() || null : null,
      });
      setJustVoted(true);
      load();
    } catch (err) {
      console.error(err);
      toast('Could not cast your vote — try again');
    } finally {
      setSubmitting(false);
    }
  }

  if (poll.status === 'closed') {
    const messageCount = votes.filter((v) => v.message?.trim()).length;
    const duration = poll.closed_at ? formatDuration(poll.created_at, poll.closed_at) : '—';
    return (
      <div className="wrap">
        <div className="poll-page-body">
        <div className="panel poll-vote-panel poll-page-panel">
          <PollStatusPill status={poll.status} />
          <h1>{poll.title}</h1>
          <p className="lede">This poll is closed, here's how it landed.</p>
          <PollWinnerHero options={options} votes={votes} />
          <div className="poll-wrapup-meta">
            <PollVoterRow votes={votes} max={4} />
            {votes.length > 0 && <span className="board-dot" />}
            <span className="poll-wrapup-duration">{duration} duration</span>
          </div>
          <PollTally options={options} votes={votes} hideTotal />
          <div className="poll-wall-title">
            <h2>Best of the Wall</h2>
          </div>
          <p className="poll-wall-count">
            {messageCount} Message{messageCount === 1 ? '' : 's'}
          </p>
          <PollWall votes={votes} />
        </div>
        </div>
      </div>
    );
  }

  const unlocked = guestCanSeeResults(poll);
  const showWall = wallUnlocked(poll);
  const commentCount = votes.filter((v) => v.message?.trim()).length;

  return (
    <div className="wrap">
      <div className="poll-page-body">
      <div className={`panel poll-vote-panel poll-page-panel${justVoted ? ' locked' : ''}`}>
        <PollStatusPill status={poll.status} />
        <h1>{poll.title}</h1>
        <p className="lede">Voting as a guest, only the organizer sees your real name.</p>

        <div className="poll-vote-opts">
          {options.map((opt) => (
            <div className="poll-vote-opt-row" key={opt.id}>
              <button
                type="button"
                className={`poll-vote-opt${selectedOption === opt.id ? ' selected' : ''}`}
                onClick={() => setSelectedOption(opt.id)}
                disabled={justVoted}
              >
                <PollOptionBadge option={opt} className="poll-vote-opt-badge" />
                <span className="poll-vote-opt-label">{opt.label}</span>
                <span className="poll-vote-opt-dot" />
              </button>
              {opt.link_url && (
                <a
                  className="poll-vote-opt-link"
                  href={/^https?:\/\//i.test(opt.link_url) ? opt.link_url : `https://${opt.link_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open ${opt.link_meta?.host || 'link'} in a new tab`}
                >
                  ↗
                </a>
              )}
            </div>
          ))}
        </div>

        {!justVoted && (
          <>
            <div className="field" style={{ marginTop: 18 }}>
              <label>Your name</label>
              <p className="field-hint">Only the Organizer sees this</p>
              <input type="text" placeholder="e.g Janet Lewis" value={voterName} onChange={(e) => setVoterName(e.target.value)} />
            </div>

            <div className="field">
              <label>Your alias / nick name</label>
              <p className="field-hint">This is how you will appear to everyone else</p>
              <input type="text" maxLength={40} placeholder="e.g Sponge Bob" value={aliasName} onChange={(e) => setAliasName(e.target.value)} />
            </div>
            {/* No concrete Figma spec found for this nudge's styling in the
                fetched frames — kept the same trigger logic, restyled to a
                restrained inline note (muted text + small icon) instead of
                the old bright amber box, consistent with this redesigned
                form. Flagged as an assumption. */}
            {nudge && (
              <p className="poll-alias-nudge">
                <span aria-hidden="true">ⓘ</span> That looks like it might be your real name — guests on the wall will see this alias.
              </p>
            )}

            {poll.allow_messages && (
              <div className="field">
                <label>Add a message (optional)</label>
                <p className="field-hint">Shown under your alias</p>
                <textarea maxLength={120} placeholder="Team Komon" value={message} onChange={(e) => setMessage(e.target.value)} />
                <div className="poll-char-count">{message.length}/120</div>
              </div>
            )}

            <button className="primary-btn" onClick={handleSubmit} disabled={!canSubmit || submitting}>
              {submitting ? 'Casting…' : 'Cast vote'}
            </button>
          </>
        )}
      </div>

      {justVoted && (
        <div className="panel poll-vote-panel poll-page-panel">
          <div className="poll-confirm-banner">
            <img src="/icons/shared/checkbox-active.svg" alt="" width={24} height={24} className="poll-confirm-tick" />
            Your vote is in! Thank you for playing along.
          </div>

          {!unlocked && (
            <p className="poll-plain-note">Poll {formatCloseCountdown(poll.closes_at)}. The breakdown stays hidden until the organizer reveals it.</p>
          )}
          {unlocked && (
            <>
              <h2>Live results</h2>
              <PollTally options={options} votes={votes} />
            </>
          )}

          <div className="poll-wall-title">
            <h2>Message Wall</h2>
          </div>
          {!showWall ? (
            <p className="poll-plain-note">
              {commentCount} comment{commentCount === 1 ? '' : 's'} so far — the wall unlocks all at once when the organizer closes the poll.
            </p>
          ) : (
            <PollWall votes={votes} />
          )}
        </div>
      )}
      </div>
    </div>
  );
}
