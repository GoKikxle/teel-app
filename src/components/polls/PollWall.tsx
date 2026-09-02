import type { AliasPollOption, AliasPollVotePublic } from '../../lib/database.types';

interface WallVote extends AliasPollVotePublic {
  real_name?: string;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Shared by the guest vote screen (never passed real_name — the type it
// receives, AliasPollVotePublic, structurally can't carry it) and the
// organizer screen (passes real_name + showRealName, toggled by its own
// "Reveal real names" switch). showVoteChip is only meaningful once
// results are unlocked — showing which option each message went with
// before that would leak the breakdown suspense_mode is hiding.
export function PollWall({
  votes,
  options,
  showRealName = false,
  showVoteChip = false,
}: {
  votes: WallVote[];
  options?: AliasPollOption[];
  showRealName?: boolean;
  showVoteChip?: boolean;
}) {
  if (!votes.length) {
    return <div className="poll-empty-wall">No votes yet.</div>;
  }

  return (
    <div className="poll-wall">
      {votes
        .slice()
        .reverse()
        .map((v) => {
          const option = options?.find((o) => o.id === v.option_id);
          return (
            <div className="poll-msg-card" key={v.id}>
              <span className="poll-msg-avatar">{v.alias_avatar}</span>
              <div className="poll-msg-body">
                <div className="poll-msg-who">
                  <span className="poll-msg-alias">{v.alias}</span>
                  {showRealName && v.real_name && <span className="poll-msg-real-name poll-mono">({v.real_name})</span>}
                  {showVoteChip && option && <span className="poll-msg-chip">{option.label}</span>}
                  <span className="poll-msg-time poll-mono">{fmtTime(v.created_at)}</span>
                </div>
                <div className={`poll-msg-text${v.message ? '' : ' empty'}`}>{v.message || 'No message left'}</div>
              </div>
            </div>
          );
        })}
    </div>
  );
}
