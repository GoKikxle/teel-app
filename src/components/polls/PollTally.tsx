import { optionHasBadge, tallyOptions } from '../../data/polls';
import type { AliasPoll, AliasPollOption } from '../../lib/database.types';
import { PollOptionBadge } from './PollOptionBadge';

// Renders either chart style from real state — no static screenshots —
// matching the reviewed prototype's buildTallyCard/buildTallyColumns, just
// in Komon's own single-accent bar treatment instead of the prototype's
// per-option rainbow palette (that palette was explicitly not the source
// of truth for styling).
export function PollTally({
  poll,
  options,
  votes,
}: {
  poll: Pick<AliasPoll, 'chart_style'>;
  options: AliasPollOption[];
  votes: { option_id: string }[];
}) {
  const counts = tallyOptions(options, votes);
  const total = votes.length;

  return (
    <div className="poll-tally">
      {poll.chart_style === 'columns' ? (
        <div className="poll-tally-cols">
          {counts.map(({ option, count, pct }) => (
            <div className="poll-tally-col" key={option.id}>
              <span className="poll-tally-col-count">{count}</span>
              <span className="poll-tally-col-thumb">
                {optionHasBadge(option) ? <PollOptionBadge option={option} className="poll-tally-col-thumb-inner" /> : '·'}
              </span>
              <div className="poll-tally-col-track">
                <div className="poll-tally-col-fill" style={{ height: `${pct}%` }} />
              </div>
              <span className="poll-tally-col-label">{option.label}</span>
            </div>
          ))}
        </div>
      ) : (
        counts.map(({ option, count, pct }) => (
          <div className="poll-tally-card-row" key={option.id}>
            <span className="poll-tally-card-thumb">
              {optionHasBadge(option) ? <PollOptionBadge option={option} className="poll-tally-card-thumb-inner" /> : '·'}
            </span>
            <div className="poll-tally-card-body">
              <div className="poll-tally-card-head">
                <span className="l">{option.label}</span>
                <span className="n poll-mono">
                  {count} · {pct}%
                </span>
              </div>
              <div className="poll-tally-bar-track">
                <div className="poll-tally-bar" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        ))
      )}
      <div className="poll-tally-total poll-mono">
        {total} vote{total === 1 ? '' : 's'} so far
      </div>
    </div>
  );
}
