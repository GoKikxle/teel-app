import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Switch } from '@base-ui/react/switch';
import { BackLink } from '../components/BackLink';
import { InfoTooltip } from '../components/InfoTooltip';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import {
  closePoll,
  fetchPoll,
  fetchPollOptions,
  fetchPollVotesForOrganizer,
  formatCloseCountdown,
  formatDuration,
  pickBestMessages,
  setPollRevealed,
} from '../data/polls';
import type { AliasPoll, AliasPollOption, AliasPollVote } from '../lib/database.types';
import { PollTally } from '../components/polls/PollTally';
import { PollWall } from '../components/polls/PollWall';
import { PollStatusPill } from '../components/polls/PollStatusPill';
import { PollVoterRow } from '../components/polls/PollVoterRow';
import { PollSharePanel } from '../components/polls/PollSharePanel';
import { PollWinnerHero } from '../components/polls/PollWinnerHero';
import { withTimeout } from '../lib/withTimeout';

// A hung fetch (dead network, a backgrounded tab) used to leave `loading`
// true forever with no error and no retry — the "poll dashboard gets
// stuck on refresh" report. Bounding it turns that into a visible error
// with a retry action instead.
const LOAD_TIMEOUT_MS = 15000;

// Figma-less feature (built from the reviewed prototype) — Alias Polls'
// organizer screen. Ownership-gated the same way Edit.tsx gates gathering
// edits (organizer_user_id !== userId). While the poll is open this is the
// full-breakdown/reveal/close view; once closed, this same route renders
// the wrap-up/keepsake content instead — no separate wrap-up route exists
// (only /poll/new, /p/:id, /poll/:id/organize were in scope).
export function PollOrganize() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId, ready, isPersistent } = useAuth();
  const toast = useToast();

  const [poll, setPoll] = useState<AliasPoll | null>(null);
  const [options, setOptions] = useState<AliasPollOption[]>([]);
  const [votes, setVotes] = useState<AliasPollVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setLoadError(false);
    withTimeout(Promise.all([fetchPoll(id), fetchPollOptions(id), fetchPollVotesForOrganizer(id)]), LOAD_TIMEOUT_MS)
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

  if (loadError) {
    return (
      <div className="wrap">
        <BackLink label="Board" onClick={() => navigate('/')} />
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

  async function handleRevealChange(next: boolean) {
    setBusy(true);
    try {
      await setPollRevealed(id!, next);
      load();
    } catch (err) {
      console.error(err);
      toast(`Could not ${next ? 'reveal' : 'hide'} results — try again`);
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

  // Round 4: replaced the old stack of full-width panels with a two-column
  // layout, since matched to Figma's own "View Created Poll" frame (node
  // 1182:4780): left column stacks the results card + PollSharePanel (its
  // own self-contained .panel), right column stacks Organizer controls +
  // Message Wall — a fixed 517px, not a narrow sidebar, per that frame's
  // real measurements (see .poll-organize-layout's own comment).
  return (
    <div className="wrap poll-organize-wrap">
      <BackLink label="Poll" onClick={() => navigate('/')} />

      <div className="poll-organize-layout">
        <div>
          <div className="panel poll-page-panel">
            <PollStatusPill status="open" />
            <h1>{poll.title}</h1>
            {/* No exact Figma copy confirmed for this exact spot beyond the
                general "closes in X" phrasing — short sentence framing, own
                call. Plain body font, not DM Mono (see formatCloseCountdown's
                own doc comment for why). */}
            <p className="poll-plain-note" style={{ marginTop: 8, marginBottom: 14 }}>
              {formatCloseCountdown(poll.closes_at).replace(/^./, (c) => c.toUpperCase())}
            </p>
            {/* Always the real name, no gate — this is the organizer's own
                page (ownership-checked above), and guests structurally
                can't ever see this regardless: they only ever receive
                AliasPollVotePublic, which has no real_name field at all
                (see PollVote.tsx / alias_poll_votes_public). The "Reveal
                real names" toggle this replaces controlled only this
                screen's own display, never anything guest-facing — GDPR
                exposure was already zero, but removed anyway per the
                request to drop it. */}
            <PollVoterRow votes={votes} showRealName />
            <PollTally options={options} votes={votes} hideTotal />
          </div>

          <PollSharePanel poll={poll} />
        </div>

        <div>
          <div className="panel poll-page-panel">
            <h2>Organizer controls</h2>

            {poll.suspense_mode && (
              <div className="toggle-row">
                <div className="toggle-row-label-wrap">
                  <div className="tlabel" id="show-results-label">
                    Show results to guests
                  </div>
                  <InfoTooltip text="They see the vote count ticking up, not the breakdown. Toggle it on for the reveal moment — and back off again any time." />
                </div>
                {/* Two-way now — was insert-only (setPollRevealed's own
                    predecessor, revealPoll(), could only ever flip this
                    true "by design"; that design call is what's being
                    reversed here). */}
                <Switch.Root
                  checked={poll.revealed}
                  onCheckedChange={handleRevealChange}
                  disabled={busy}
                  nativeButton
                  render={<button type="button" />}
                  className={(state) => `switch${state.checked ? ' on' : ''}`}
                  aria-labelledby="show-results-label"
                />
              </div>
            )}

            <div className="poll-org-actions">
              <button className="btn-outline" onClick={() => navigate(`/poll/${id}/edit`)}>
                Edit poll
              </button>
              <button className="btn-outline" onClick={handleClose} disabled={busy}>
                Close poll
              </button>
            </div>
          </div>

          <div className="panel poll-page-panel">
            <div className="poll-wall-title">
              <h2>Message Wall</h2>
              {!poll.comments_live && <span className="poll-hidden-tag">Hidden from guests</span>}
            </div>
            <PollWall votes={votes} options={options} showRealName showVoteChip />
          </div>
        </div>
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
  const messageCount = votes.filter((v) => v.message?.trim()).length;
  const duration = poll.closed_at ? formatDuration(poll.created_at, poll.closed_at) : '—';
  const best = pickBestMessages(votes, 3);
  const voteCount = votes.length;

  return (
    <div className="wrap poll-organize-wrap">
      <BackLink label="Poll" onClick={() => navigate('/')} />
      {/* Round 6: reuses the live view's own two-column grid
          (.poll-organize-layout) instead of stacking everything in one
          column (.poll-page-body) — Figma puts the "host a gathering" CTA
          in its own card in the right column, visible without scrolling
          past the whole keepsake first. */}
      <div className="poll-organize-layout">
      <div className="panel poll-page-panel">
        <PollStatusPill status="closed" />
        <h1>{poll.title || 'Poll closed'}</h1>
        <p className="lede">Here's the keepsake — the same summary you could share once everyone's had their say.</p>

        <PollWinnerHero options={options} votes={votes} />

        {/* Voter avatar row capped at 4 here (Figma), vs. the live view's
            default 5 — see PollVoterRow's max prop. showRealName wasn't
            passed here before, so this screen — also the organizer's own,
            same as the live view above — silently showed aliases only;
            fixed to match. */}
        <div className="poll-wrapup-meta">
          <PollVoterRow votes={votes} max={4} showRealName />
          {voteCount > 0 && <span className="board-dot" />}
          <span className="poll-wrapup-duration">{duration} duration</span>
        </div>

        {/* No stat-tile widget exists in Figma for this screen — the vote
            count/duration are already covered by the avatar-row line above
            and the per-option counts below, so this was pure duplication. */}
        <div className="poll-wrapup-divider" />

        <PollTally options={options} votes={votes} hideTotal />

        <div className="poll-wrapup-divider" />

        <div className="poll-wall-title">
          <h2>Best of the Wall</h2>
        </div>
        <p className="poll-wall-count">
          {messageCount} Message{messageCount === 1 ? '' : 's'}
        </p>
        <PollWall votes={best} options={options} showRealName showVoteChip />
      </div>

      <div>
        <div className="poll-gathering-cta poll-page-panel">
          <BuntingIcon />
          <div className="poll-gathering-cta-copy">
            <h2>The Iron's hot. Host a gathering with your friends.</h2>
            <p>
              {voteCount > 0
                ? `Everyone who voted already knows what's up. Turn it into a get-together before the moment passes.`
                : `Turn this into a get-together before the moment passes.`}
            </p>
          </div>
          <button
            className="primary-btn"
            onClick={() => navigate(`/create?fromPoll=${pollId}&title=${encodeURIComponent(poll.title)}`)}
          >
            Start a gathering
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// Real streamline-freehand-color:party-decoration-banner-1 vector, fetched
// from Iconify (api.iconify.design) rather than hand-drawn. Its published
// default palette is black + blue (#0c6fff) — Figma's own instance
// (node 1182:4768) overrides the second string to the app's accent red, so
// that one fill is repainted to match what the design frame actually shows
// rather than the icon's stock color.
function BuntingIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g fillRule="evenodd" clipRule="evenodd">
        <path
          fill="#020202"
          d="m9.212 9.597l.401-.15s0 .09.08.12c.633.531 1.285 1.003 1.947 1.515c.662.511 1.324.953 2.006 1.424c.09.06.703.482 1.004.622a.69.69 0 0 0 .822-.08c.278-.366.482-.781.602-1.224a10 10 0 0 0 .271-1.806c.06-.833.12-1.665.2-2.508c.061-.542.121-1.084.191-1.625l.522-.372a.26.26 0 0 0 .14.251q.973.563 2.007 1.004q1.022.46 2.087.812c.07 0 .953.301 1.304.391a.74.74 0 0 0 .753-.22c.14-.249.215-.528.22-.813a5.4 5.4 0 0 0-.23-1.404a12 12 0 0 0-.462-1.214c-.341-.893-.742-1.756-1.053-2.66a.32.32 0 0 0-.261-.23l.36-.431a.333.333 0 1 0-.46-.482c-.693.652-1.315 1.325-2.007 1.947c-.281.26-.572.511-.883.752a34 34 0 0 1-6.02 3.662a41 41 0 0 1-3.902 1.695a35 35 0 0 1-2.679.883c-.582.16-1.154.291-1.736.392c-1.384.25-2.789.39-4.183.632a.31.31 0 0 0-.251.34a.29.29 0 0 0 .331.211l1.124-.1c.511.823 1.003 1.625 1.625 2.398a27 27 0 0 0 1.274 1.595s.602.682.853.893a.68.68 0 0 0 .692.14a1.93 1.93 0 0 0 .793-.692q.345-.526.572-1.114q.276-.679.441-1.394c.21-.943.271-1.816.472-2.89c.34-.06.692-.16 1.033-.27m10.103-5.679c.32-.27.612-.562.903-.842c.29-.281.782-.833 1.164-1.245c.23.934.551 1.836.802 2.77q.17.562.26 1.143c0 .21.101.532.131.853v.17l-.872-.24a20 20 0 0 1-2.067-.512a20 20 0 0 1-2.007-.742c.562-.462 1.144-.903 1.686-1.355m-6.07 4.013a39 39 0 0 0 2.679-1.535l-.632 3.512a10 10 0 0 1-.331 1.605q-.065.226-.16.441l-.583-.36a69 69 0 0 1-2.538-1.445a21 21 0 0 1-1.455-.924a31 31 0 0 0 3.02-1.304zm-6.32 4.184a8 8 0 0 1-.633 1.625q-.205.481-.501.913a2 2 0 0 1-.18.2a6 6 0 0 1-.462-.651a48 48 0 0 1-1.706-1.786c-.572-.622-.853-1.003-1.264-1.525c.793-.07 1.595-.13 2.388-.23a19 19 0 0 0 1.826-.302c.34-.07.672-.16 1.003-.25c-.18.722-.3 1.364-.471 2.006"
        />
        <path
          fill="var(--accent)"
          d="M23.77 18.375a31 31 0 0 1-5.438-1.003a24 24 0 0 1-2.218-.762a22 22 0 0 1-2.127-1.004a18.6 18.6 0 0 1-4.434-3.21a.28.28 0 0 0-.411 0a.29.29 0 0 0 0 .411c.22.261.451.492.682.743c-.07.36-.12.722-.17 1.083s-.07.803-.091 1.214v2.438a7 7 0 0 0 0 .732a.61.61 0 0 0 .331.482c.283.117.6.117.883 0a6.3 6.3 0 0 0 1.074-.582c.692-.431 1.334-1.003 2.006-1.405q.333-.214.692-.38c.371.17.743.34 1.114.48l.18.06c.161.553.312 1.095.482 1.636c.17.542.391 1.254.612 1.876q.227.673.532 1.315c.165.335.389.637.662.893a.76.76 0 0 0 .863.09a4.5 4.5 0 0 0 1.093-.853q.627-.631 1.174-1.334c.532-.672 1.003-1.395 1.495-2.137a.3.3 0 0 0 0-.19h.893a.32.32 0 0 0 .35-.302a.34.34 0 0 0-.23-.29M13.515 16.87c-.732.361-1.425.823-2.147 1.174c-.13.06-.492.331-.752.462v-.251l-.221-2.398c0-.401-.06-.782-.07-1.164v-.532a16.2 16.2 0 0 0 3.08 2.398l.34.19c-.03.041-.14.071-.23.121m7.103 3.873q-.566.605-1.204 1.134a4.5 4.5 0 0 1-.592.622a3 3 0 0 1-.331-.492c-.22-.401-.401-.843-.562-1.184c-.33-.702-.662-1.404-1.003-2.117c-.11-.24-.2-.481-.301-.732c.462.15.923.29 1.395.401c1.339.306 2.701.5 4.073.582a19 19 0 0 1-1.475 1.786"
        />
      </g>
    </svg>
  );
}
