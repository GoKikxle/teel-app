import type { AliasPollOption, AliasPollVotePublic } from '../../lib/database.types';
import { aliasColor, aliasInitials } from '../../data/polls';

interface WallVote extends AliasPollVotePublic {
  real_name?: string;
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
          // Same alias->initials/color mapping as PollVoterRow, so a given
          // person renders identically in both the avatar row and here.
          // Real-name initials/color only ever show on the organizer's own
          // screen with "Reveal real names" on — guests always see the
          // alias-based avatar, never a hint of the real name.
          const displayName = showRealName && v.real_name ? v.real_name : v.alias;
          return (
            <div className="poll-msg-card" key={v.id}>
              <span className="poll-msg-avatar" style={{ background: aliasColor(displayName) }}>
                {aliasInitials(displayName)}
              </span>
              <div className="poll-msg-body">
                <div className="poll-msg-who">
                  <span className="poll-msg-alias">{v.alias}</span>
                  {showRealName && v.real_name && <span className="poll-msg-real-name poll-mono">({v.real_name})</span>}
                  {showVoteChip && option && <span className="poll-msg-chip">{option.label}</span>}
                </div>
                <div className={`poll-msg-text${v.message ? '' : ' empty'}`}>{v.message || 'No message left'}</div>
              </div>
            </div>
          );
        })}
    </div>
  );
}
