import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BackLink } from '../components/BackLink';
import { useToast } from '../hooks/useToast';
import {
  aliasLooksLikeRealName,
  castVote,
  fetchPoll,
  fetchPollOptions,
  fetchPollVotesPublic,
  guestCanSeeResults,
  makeAlias,
  wallUnlocked,
  type Alias,
} from '../data/polls';
import type { AliasPoll, AliasPollOption, AliasPollVotePublic } from '../lib/database.types';
import { PollTally } from '../components/polls/PollTally';
import { PollOptionBadge } from '../components/polls/PollOptionBadge';
import { PollWall } from '../components/polls/PollWall';

// Figma-less feature (built from the reviewed prototype) — Alias Polls'
// guest-facing vote screen, mirroring Detail.tsx's shape (no account
// required, fetch-once + refetch-after-write). Voting stays open the
// whole time the poll is 'open' — no "you already voted" gate exists,
// since there's no identity to check it against (v1 non-goal).
export function PollVote() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [poll, setPoll] = useState<AliasPoll | null>(null);
  const [options, setOptions] = useState<AliasPollOption[]>([]);
  const [votes, setVotes] = useState<AliasPollVotePublic[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [voterName, setVoterName] = useState('');
  const [alias, setAlias] = useState<Alias>(() => makeAlias());
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [justVoted, setJustVoted] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    Promise.all([fetchPoll(id), fetchPollOptions(id), fetchPollVotesPublic(id)])
      .then(([p, opts, v]) => {
        setPoll(p);
        setOptions(opts);
        setVotes(v);
      })
      .catch(console.error)
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

  if (!poll || !id) {
    return (
      <div className="wrap">
        <BackLink label="Board" onClick={() => navigate('/')} />
        <p className="lede">Poll not found.</p>
      </div>
    );
  }

  const nudge = aliasLooksLikeRealName(voterName, alias.name);
  const canSubmit = Boolean(selectedOption) && voterName.trim().length > 0;

  async function handleSubmit() {
    if (!selectedOption) return;
    const name = voterName.trim();
    if (!name) {
      toast("Add your name first — it stays private, but it's how the organizer keeps track.");
      return;
    }
    setSubmitting(true);
    try {
      await castVote({
        pollId: id!,
        optionId: selectedOption,
        realName: name,
        alias: alias.name,
        aliasAvatar: alias.avatar,
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
    return (
      <div className="wrap">
        <BackLink label="Poll" onClick={() => navigate('/')} />
        <div className="panel poll-vote-panel">
          <h1>{poll.title}</h1>
          <p className="lede">This poll is closed — here's how it landed.</p>
          <h2>Final results</h2>
          <PollTally poll={poll} options={options} votes={votes} />
          <div className="poll-wall-title">
            <h2>Message wall</h2>
          </div>
          <PollWall votes={votes} />
        </div>
      </div>
    );
  }

  const unlocked = guestCanSeeResults(poll);
  const showWall = wallUnlocked(poll);

  return (
    <div className="wrap">
      <BackLink label="Poll" onClick={() => navigate('/')} />
      <div className="panel poll-vote-panel" style={justVoted ? { opacity: 0.55 } : undefined}>
        <h1>{poll.title}</h1>
        <p className="lede">Voting as a guest — the organizer is the only one who ever sees your real name.</p>

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
              <p className="poll-hint" style={{ marginTop: 0, marginBottom: 6 }}>
                Only the organizer sees this
              </p>
              <input type="text" placeholder="e.g. Priya Shah" value={voterName} onChange={(e) => setVoterName(e.target.value)} />
            </div>

            <div className="poll-alias-preview">
              <span className="poll-alias-avatar">{alias.avatar}</span>
              <div className="poll-alias-txt">
                <div className="poll-alias-kicker">You'll appear as</div>
                <input
                  type="text"
                  className="poll-alias-input"
                  maxLength={40}
                  value={alias.name}
                  onChange={(e) => setAlias((a) => ({ ...a, name: e.target.value }))}
                />
              </div>
              <button type="button" className="poll-reroll" onClick={() => setAlias(makeAlias())}>
                Shuffle ↻
              </button>
            </div>
            {nudge && (
              <div className="poll-alias-nudge">
                ⚠️ That looks like it might be your real name — guests on the wall will see this alias.
              </div>
            )}

            {poll.allow_messages && (
              <div className="field">
                <label>Add a message (optional)</label>
                <p className="poll-hint" style={{ marginTop: 0, marginBottom: 6 }}>
                  Shown under your alias
                </p>
                <textarea maxLength={120} placeholder="Team Girl! 💗" value={message} onChange={(e) => setMessage(e.target.value)} />
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
        <div className="panel poll-vote-panel">
          <div className="poll-confirm-banner">
            <span className="poll-confirm-tick">✓</span> Your vote is in — thanks for playing along.
          </div>

          {!unlocked && (
            <div className="poll-lock-banner">
              🔒 <b>{votes.length} votes</b> so far — the breakdown stays hidden until the organizer reveals it.
            </div>
          )}
          {unlocked && (
            <>
              <h2>Live results</h2>
              <PollTally poll={poll} options={options} votes={votes} />
            </>
          )}

          <div className="poll-wall-title">
            <h2>Message wall</h2>
          </div>
          {!showWall ? (
            <div className="poll-lock-banner">
              🔒 <b>{votes.filter((v) => v.message?.trim()).length} comments</b> so far — the wall unlocks all at once
              when the organizer closes the poll.
            </div>
          ) : (
            <PollWall votes={votes} />
          )}
        </div>
      )}
    </div>
  );
}
