import { AVATAR_COLORS } from '../lib/constants';

// getInitials/getColor default to this component's original index-based
// behavior (single first-letter initial, color by position) so any
// existing usage is unaffected. Alias Polls' voter row (PollOrganize.tsx)
// passes data/polls.ts's aliasInitials/aliasColor instead, since aliases
// are two-word ("Glorious Unicorn" -> "GU") and need a color that's
// deterministic per-alias (same person = same color everywhere), not
// per-position.
export function AvatarStack({
  names,
  max = 5,
  getInitials = (n: string) => n.trim().charAt(0).toUpperCase(),
  getColor = (_name: string, i: number) => AVATAR_COLORS[i % AVATAR_COLORS.length],
}: {
  names: string[];
  max?: number;
  getInitials?: (name: string) => string;
  getColor?: (name: string, index: number) => string;
}) {
  if (!names.length) return null;
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;

  return (
    <div className="avatar-stack">
      {shown.map((n, i) => (
        <div key={i} className="avatar" style={{ background: getColor(n, i), zIndex: max - i }}>
          {getInitials(n)}
        </div>
      ))}
      {extra > 0 && (
        <div className="avatar more" style={{ zIndex: 0 }}>
          +{extra}
        </div>
      )}
    </div>
  );
}
