import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Switch } from '@base-ui/react/switch';
import { BackLink } from '../components/BackLink';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import {
  closePoll,
  fetchPoll,
  fetchPollOptions,
  fetchPollVotesForOrganizer,
  formatDuration,
  pickBestMessages,
  pickWinners,
  revealPoll,
  tallyOptions,
} from '../data/polls';
import type { AliasPoll, AliasPollOption, AliasPollVote } from '../lib/database.types';
import { PollTally } from '../components/polls/PollTally';
import { PollWall } from '../components/polls/PollWall';
import { PollOptionBadge } from '../components/polls/PollOptionBadge';

// Figma-less feature (built from the reviewed prototype) — Alias Polls'
// organizer screen. Ownership-gated the same way Edit.tsx gates gathering
// edits (organizer_user_id !== userId). While the poll is open this is the
// full-breakdown/reveal/close view; once closed, this same route renders
// the wrap-up/keepsake content instead — no separate wrap-up route exists
// (only /poll/new, /p/:id, /poll/:id/organize were in scope).
export function PollOrganize() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const justCreated = searchParams.get('created') === '1';
  const { userId, ready, isPersistent } = useAuth();
  const toast = useToast();

  const [poll, setPoll] = useState<AliasPoll | null>(null);
  const [options, setOptions] = useState<AliasPollOption[]>([]);
  const [votes, setVotes] = useState<AliasPollVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealNames, setRevealNames] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    Promise.all([fetchPoll(id), fetchPollOptions(id), fetchPollVotesForOrganizer(id)])
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

  useEffect(() => {
    if (ready && !isPersistent) navigate(`/signin?next=${encodeURIComponent(`/poll/${id}/organize`)}`, { replace: true });
  }, [ready, isPersistent, id, navigate]);

  if (loading || !ready) {
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

  if (poll.organizer_user_id !== userId) {
    return (
      <div className="wrap">
        <BackLink label="Poll" onClick={() => navigate('/')} />
        <p className="lede">Only the organizer can view this page.</p>
      </div>
    );
  }

  const link = `${window.location.origin}/p/${id}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied');
    } catch {
      toast(`Link: ${link}`);
    }
  }

  async function handleReveal() {
    setBusy(true);
    try {
      await revealPoll(id!);
      load();
    } catch (err) {
      console.error(err);
      toast('Could not reveal results — try again');
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    setBusy(true);
    try {
      await closePoll(id!);
      load();
    } catch (err) {
      console.error(err);
      toast('Could not close the poll — try again');
    } finally {
      setBusy(false);
    }
  }

  if (poll.status === 'closed') {
    return <PollWrapUp poll={poll} options={options} votes={votes} pollId={id} />;
  }

  return (
    <div className="wrap">
      <BackLink label="Poll" onClick={() => navigate('/')} />

      {justCreated && (
        <div className="panel">
          <h2 style={{ marginBottom: 10 }}>Poll is live</h2>
          <div className="share-row">
            <input type="text" readOnly value={link} />
            <button className="btn-outline copy-btn" onClick={copyLink} aria-label="Copy link">
              <img src="/icons/board/copy-outline.svg" alt="" width={24} height={24} />
            </button>
          </div>
          <p className="poll-hint" style={{ marginTop: 0 }}>
            Send this link anywhere — text, email, a caption.
          </p>
        </div>
      )}

      <div className="panel">
        <div className="poll-organize-head">
          <div>
            <h1>{poll.title}</h1>
            <p className="lede" style={{ marginBottom: 4 }}>
              Live · <span className="poll-mono">{votes.length}</span> votes
            </p>
          </div>
          <div className="poll-reveal-toggle">
            <span className="tlabel" id="reveal-names-label">
              Reveal real names
            </span>
            <Switch.Root
              checked={revealNames}
              onCheckedChange={setRevealNames}
              nativeButton
              render={<button type="button" />}
              className={(state) => `switch${state.checked ? ' on' : ''}`}
              aria-labelledby="reveal-names-label"
            />
          </div>
        </div>

        <PollTally poll={poll} options={options} votes={votes} />

        {poll.suspense_mode && (
          <div className="toggle-row">
            <div>
              <div className="tlabel">{poll.revealed ? 'Results are visible to guests' : 'Results are hidden from guests'}</div>
              <div className="tsub">
                {poll.revealed
                  ? 'Everyone with the link can now see the full breakdown.'
                  : "They see the vote count ticking up, not the breakdown. Trigger the reveal when you're ready for the moment."}
              </div>
            </div>
            <button className="btn-outline" onClick={handleReveal} disabled={poll.revealed || busy}>
              {poll.revealed ? 'Revealed ✓' : 'Reveal to guests'}
            </button>
          </div>
        )}

        <div className="poll-wall-title">
          <h2>Message wall</h2>
          {!poll.comments_live && <span className="poll-hidden-tag">Hidden from guests</span>}
        </div>
        <PollWall votes={votes} options={options} showRealName={revealNames} showVoteChip />

        <div className="poll-org-actions">
          <button className="btn-outline" onClick={handleClose} disabled={busy}>
            Close poll
          </button>
        </div>

        <p className="poll-hint poll-org-callout">
          🔒 <b>Only you see this screen.</b> Everyone else — including on the message wall shown to voters — sees
          aliases only. Turning off "Reveal real names" shows you the exact view guests get.
        </p>
      </div>
    </div>
  );
}

function PollWrapUp({
  poll,
  options,
  votes,
  pollId,
}: {
  poll: AliasPoll;
  options: AliasPollOption[];
  votes: AliasPollVote[];
  pollId: string;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const counts = tallyOptions(options, votes);
  const winners = pickWinners(counts);
  const messageCount = votes.filter((v) => v.message?.trim()).length;
  const duration = poll.closed_at ? formatDuration(poll.created_at, poll.closed_at) : '—';
  const best = pickBestMessages(votes, 3);
  const voteCount = votes.length;

  async function copySummary() {
    const lines = [poll.title, ''];
    for (const { option, count } of counts) lines.push(`${option.label}: ${count}`);
    lines.push('', `${voteCount} votes · open ${duration}`);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast('Copied');
    } catch {
      toast('Could not copy — try selecting the summary manually');
    }
  }

  return (
    <div className="wrap">
      <BackLink label="Poll" onClick={() => navigate('/')} />
      <div className="panel">
        <h1>Poll closed</h1>
        <p className="lede">Here's the keepsake — the same summary you could share once everyone's had their say.</p>

        <div className="poll-winner-strip">
          <span className="poll-medal">🏆</span>
          <div>
            <div className="poll-winner-kicker">Most guessed</div>
            <div className="poll-winner-label">
              {winners.length === 0
                ? 'No votes yet'
                : winners.length === 1
                  ? (
                    <>
                      {winners[0].option && <PollOptionBadge option={winners[0].option} className="poll-winner-badge" />} {winners[0].option.label}
                    </>
                  )
                  : `Tie — ${winners.map((w) => w.option.label).join(' & ')}`}
            </div>
          </div>
        </div>

        <div className="poll-stat-row">
          <div className="poll-stat-tile">
            <span className="n poll-mono">{voteCount}</span>
            <span className="l">Votes</span>
          </div>
          <div className="poll-stat-tile">
            <span className="n poll-mono">{duration}</span>
            <span className="l">Poll was open</span>
          </div>
          <div className="poll-stat-tile">
            <span className="n poll-mono">{messageCount}</span>
            <span className="l">Messages left</span>
          </div>
        </div>

        <PollTally poll={poll} options={options} votes={votes} />

        <div className="poll-wall-title">
          <h2>Best of the wall</h2>
        </div>
        <PollWall votes={best} options={options} showVoteChip />

        <div className="poll-summary-actions">
          <button className="btn-outline" onClick={copySummary}>
            Copy summary
          </button>
        </div>
      </div>

      <div className="poll-gathering-cta">
        <span className="poll-flame">🔥</span>
        <div className="poll-gathering-cta-copy">
          <h2>The iron's hot — host a gathering with your people</h2>
          <p>
            {voteCount > 0
              ? `Everyone who voted already knows what's up. Turn it into a get-together before the moment passes.`
              : `Turn this into a get-together before the moment passes.`}
          </p>
          <button
            className="primary-btn"
            style={{ width: 'auto', padding: '12px 26px' }}
            onClick={() => navigate(`/create?fromPoll=${pollId}&title=${encodeURIComponent(poll.title)}`)}
          >
            Start a gathering
          </button>
        </div>
      </div>
    </div>
  );
}
