import { useState } from 'react';
import { useToast } from '../../hooks/useToast';

// Shares a closed poll's single-winner result image (api/poll-keepsake.tsx)
// — gated on isSingleWinner (renders nothing for a tie or a zero-vote
// close, same gate as that route's own 404/placeholder split) since the
// whole point is a "you won" keepsake, not a fallback frame. Rendered
// right below <PollWinnerHero> on both closed-poll views (PollOrganize's
// PollWrapUp and PollVote's closed branch).
export function PollKeepsakeShare({ pollId, isSingleWinner }: { pollId: string; isSingleWinner: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!isSingleWinner) return null;

  const pollUrl = `${window.location.origin}/p/${pollId}`;
  const imageUrl = `${window.location.origin}/api/poll-keepsake?id=${pollId}&size=1080`;
  // Some mobile browsers support navigator.share but not the files param —
  // detected properly at share-time below (canShare), not assumed from
  // this alone. This just decides which static control(s) render: a
  // browser with no share sheet at all gets Copy link + Download image
  // instead of a single dynamic "Share" button.
  const hasShareSheet = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pollUrl);
      toast('Link copied');
    } catch {
      toast('Link: ' + pollUrl);
    }
  }

  async function handleShare() {
    setBusy(true);
    try {
      // Mobile path first: drop the PNG into the share sheet as a real
      // file attachment — this is what actually lands it in WhatsApp as
      // an image with the link as a tappable caption, not just a bare
      // link. canShare({files}) is the real capability check; a browser
      // can have navigator.share without file support.
      try {
        const res = await fetch(imageUrl);
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], 'komon-poll-result.png', { type: 'image/png' });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], text: pollUrl, title: 'Poll result' });
            return;
          }
        }
      } catch (err) {
        // A user dismissing the share sheet isn't a failure worth
        // reporting; anything else falls through to the link-only share.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }

      // File-sharing isn't supported here — link-only share sheet.
      await navigator.share({ url: pollUrl, title: 'Poll result' });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="poll-keepsake-share">
      {hasShareSheet ? (
        <button type="button" className="btn-outline" onClick={handleShare} disabled={busy}>
          {busy ? 'Sharing…' : 'Share result'}
        </button>
      ) : (
        <>
          <button type="button" className="btn-outline" onClick={copyLink}>
            Copy link
          </button>
          <a className="btn-outline" href={imageUrl} download="komon-poll-result.png">
            Download image
          </a>
        </>
      )}
    </div>
  );
}
