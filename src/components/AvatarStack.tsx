import { AVATAR_COLORS } from '../lib/constants';

export function AvatarStack({ names, max = 5 }: { names: string[]; max?: number }) {
  if (!names.length) return null;
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;

  return (
    <div className="avatar-stack">
      {shown.map((n, i) => (
        <div
          key={i}
          className="avatar"
          style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length], zIndex: max - i }}
        >
          {n.trim().charAt(0).toUpperCase()}
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
