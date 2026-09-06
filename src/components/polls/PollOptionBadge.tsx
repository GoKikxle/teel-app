import { initialsBadge, optionMonogram } from '../../data/polls';
import type { AliasPollOption } from '../../lib/database.types';

// Priority: uploaded image > link-derived thumbnail (or colored-initials
// fallback) > monogram (first letter of the label, white on black) — no
// emoji fallback anymore, so a badge always renders; there's no longer an
// empty case to bail out on. Shared by the vote screen, organizer screen,
// and tally components so the same option always renders identically.
export function PollOptionBadge({ option, className = 'poll-opt-badge' }: { option: AliasPollOption; className?: string }) {
  if (option.image_url) {
    return (
      <span className={className}>
        <img src={option.image_url} alt="" />
      </span>
    );
  }
  if (option.link_url) {
    if (option.link_meta?.imageUrl) {
      return (
        <span className={className}>
          <img src={option.link_meta.imageUrl} alt="" />
        </span>
      );
    }
    const badge = initialsBadge(option.link_meta || { host: option.link_url, name: option.link_url, imageUrl: null });
    return (
      <span className={className} style={{ background: badge.bg, color: badge.fg }}>
        {badge.initials}
      </span>
    );
  }
  return (
    <span className={className} style={{ background: '#000', color: '#fff' }}>
      {optionMonogram(option.label)}
    </span>
  );
}
