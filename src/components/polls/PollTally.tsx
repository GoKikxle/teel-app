import { tallyOptions } from '../../data/polls';
import type { AliasPollOption } from '../../lib/database.types';
import { PollOptionBadge } from './PollOptionBadge';

// Renders the row-card tally from real state — no static screenshots —
// matching the reviewed prototype's buildTallyCard, just in Komon's own
// single-accent bar treatment instead of the prototype's per-option
// rainbow palette (that palette was explicitly not the source of truth
// for styling). The columns chart style existed as a second, selectable
// treatment early on; that choice was removed from the create form (round
// 4 simplification) so this component no longer branches on chart_style
// at all — every poll renders this one row-card layout.
export function PollTally({
  options,
  votes,
  hideTotal = false,
}: {
  options: AliasPollOption[];
  votes: { option_id: string }[];
  // PollOrganize's live view shows the count via the voter-avatar row
  // instead (see PollVoterRow) — this line there would just repeat it.
  // PollVote.tsx's "Live results" section and PollWrapUp keep this on.
  hideTotal?: boolean;
}) {
  const counts = tallyOptions(options, votes);
  const total = votes.length;

  return (
    <div className="poll-tally">
      {counts.map(({ option, count, pct }) => (
        <div className="poll-tally-card-row" key={option.id}>
          <span className="poll-tally-card-thumb">
            <PollOptionBadge option={option} className="poll-tally-card-thumb-inner" />
          </span>
          <div className="poll-tally-card-body">
            <div className="poll-tally-card-head">
              <span className="l">{option.label}</span>
              <span className="n">
                {count} · {pct}%
              </span>
            </div>
            <div className="poll-tally-bar-track">
              <div className="poll-tally-bar" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      ))}
      {!hideTotal && (
        <div className="poll-tally-total">
          {total} vote{total === 1 ? '' : 's'} so far
        </div>
      )}
    </div>
  );
}
