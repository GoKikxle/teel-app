import type { GatheringWithRelations } from '../../lib/database.types';
import { castVote } from '../../data/gatherings';
import { useToast } from '../../hooks/useToast';

export function PollPanel({
  gathering,
  userId,
  onChange,
}: {
  gathering: GatheringWithRelations;
  userId: string;
  onChange: () => void;
}) {
  const toast = useToast();
  const options = gathering.poll_options;
  const votedOption = options.find((o) => o.poll_votes.some((v) => v.voter_user_id === userId));
  const voted = Boolean(votedOption);
  const total = options.reduce((sum, o) => sum + o.poll_votes.length, 0) || 1;

  async function vote(optionId: string) {
    if (voted) {
      toast('You already voted');
      return;
    }
    try {
      await castVote(gathering.id, optionId, userId);
      onChange();
    } catch (err) {
      console.error(err);
      toast('Could not cast vote');
    }
  }

  return (
    <div className="panel">
      <h2>{gathering.poll_question}</h2>
      <p className="poll-hint">{voted ? "You've voted, tap again to see results." : 'Tap an option to vote'}</p>
      <div>
        {options.map((o) => {
          const isChosen = votedOption?.id === o.id;
          const pct = (o.poll_votes.length / total) * 100;
          return (
            <button
              key={o.id}
              className={`poll-opt${voted ? ' disabled' : ''}${isChosen ? ' chosen' : ''}`}
              aria-disabled={voted}
              onClick={() => vote(o.id)}
            >
              <div className="poll-label">{o.label}</div>
              <div className="poll-row">
                <span className="poll-radio" />
                <div className="poll-track">
                  <div className="poll-fill" style={{ width: `${pct.toFixed(0)}%` }} />
                </div>
                <span className="poll-count">{o.poll_votes.length}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
