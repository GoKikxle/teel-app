import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { initialsBadge, optionMonogram } from '../../data/polls';
import type { AliasPollOption } from '../../lib/database.types';

// Priority: uploaded image > link-derived thumbnail (or colored-initials
// fallback) > monogram (first letter of the label, white on black) — no
// emoji fallback anymore, so a badge always renders; there's no longer an
// empty case to bail out on. Shared by the vote screen, organizer screen,
// and tally components so the same option always renders identically.
//
// Only the uploaded-image case opens a lightbox on click — the link-
// preview thumbnail and monogram fallback below are small derived
// previews, not something someone attached, so there's nothing to view
// "full-size." role="button"/tabIndex/onKeyDown (rather than a real
// <button>) because this renders inside an actual <button> at its one
// call site that matters for this (PollVote.tsx's option row) — a
// button can't nest inside a button, and stopPropagation below is what
// keeps the click from also selecting that poll option.
export function PollOptionBadge({ option, className = 'poll-opt-badge' }: { option: AliasPollOption; className?: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (option.image_url) {
    return (
      <>
        <span
          className={`${className} poll-opt-badge-clickable`}
          role="button"
          tabIndex={0}
          aria-label="View image full-size"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            setLightboxOpen(true);
          }}
        >
          <img src={option.image_url} alt="" />
        </span>
        <Dialog.Root open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <Dialog.Portal>
            <Dialog.Backdrop className="modal-backdrop" />
            <Dialog.Viewport className="modal-viewport">
              <Dialog.Popup className="poll-option-lightbox-card" aria-label={option.label}>
                <Dialog.Close className="poll-option-lightbox-close" aria-label="Close">
                  <img src="/icons/board/close-md.svg" alt="" width={20} height={20} />
                </Dialog.Close>
                <img src={option.image_url} alt="" />
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>
      </>
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
