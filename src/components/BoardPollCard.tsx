import { fmtDate } from '../lib/constants';
import { PollStatusPill } from './polls/PollStatusPill';
import type { BoardPoll } from '../data/polls';

// Follows BoardGatheringCard/BoardBillCard's exact shape (board-card >
// board-card-body > board-card-title + board-card-meta > meta-rows). Polls
// have no location/time/cover fields, so there's no thumb and no avatar
// group here — just title, status, creation date, and vote count. Always
// status="open": fetchBoardPolls only ever returns open polls (closed ones
// live on /closed instead, via fetchClosedPolls).
export function BoardPollCard({ poll, onClick }: { poll: BoardPoll; onClick: () => void }) {
  return (
    <button className="board-card board-card-poll" onClick={onClick}>
      <div className="board-card-body">
        <div className="board-card-title">{poll.title}</div>
        <div className="board-card-meta">
          <div className="board-card-meta-row">
            <PollStatusPill status="open" style={{ marginBottom: 0 }} />
          </div>
          <div className="board-card-meta-row">{fmtDate(poll.created_at.slice(0, 10))}</div>
          {/* Not the row's default DM Mono — its zero glyph renders slashed,
              which read as a bug at 0 votes in the earlier Alias Polls
              rounds (see PollOrganize/PollWall's own poll-mono opt-outs).
              Same fix, scoped to just this row rather than touching the
              shared .board-card-meta-row class other cards still rely on. */}
          <div className="board-card-meta-row" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {poll.voteCount} vote{poll.voteCount === 1 ? '' : 's'}
          </div>
        </div>
      </div>
    </button>
  );
}
