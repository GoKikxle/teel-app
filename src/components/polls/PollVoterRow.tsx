import { AvatarStack } from '../AvatarStack';
import { aliasColor, aliasInitials } from '../../data/polls';

interface Voter {
  alias: string;
  real_name?: string;
}

// Replaces PollTally's old "N vote(s) so far" line on PollOrganize's live
// view — the stacked avatars carry the "who" at a glance, the count below
// carries the "how many". showRealName mirrors PollWall's own prop: only
// the organizer's own screen, with "Reveal real names" on, ever swaps
// alias-based initials/color for real-name-based ones (never guest-facing).
export function PollVoterRow({ votes, showRealName = false }: { votes: Voter[]; showRealName?: boolean }) {
  const total = votes.length;
  if (!total) return null;
  const names = votes.map((v) => (showRealName && v.real_name ? v.real_name : v.alias));

  return (
    <div className="poll-voter-row">
      <AvatarStack names={names} getInitials={aliasInitials} getColor={aliasColor} />
      <span className="poll-voter-count">
        {total} {total === 1 ? 'person has' : 'people have'} voted
      </span>
    </div>
  );
}
