import { useState } from 'react';
import type { AliasPoll } from '../../lib/database.types';
import { useToast } from '../../hooks/useToast';
import { QRModal } from '../QRModal';
import { formatCloseCountdown } from '../../data/polls';

// Alias Polls' own share block — modeled directly on
// detail/SharePanel.tsx's markup/classes, but built as its own component
// rather than generalizing SharePanel's prop type: SharePanel is typed
// against GatheringWithRelations (visibility/kind/cover_image_url/
// gathering_date/title/id), and a poll doesn't have most of those fields.
// Persistent rather than a first-run-only banner — this is meant to stay
// useful on every visit to the organizer screen, so quickShare's WhatsApp
// + QR options are always shown here (no gate), and a poll never has a
// cover image, so the .thumb-fallback branch is the only branch — there's
// no image-thumb path to render at all.
export function PollSharePanel({ poll }: { poll: Pick<AliasPoll, 'id' | 'title' | 'closes_at'> }) {
  const toast = useToast();
  const link = `${window.location.origin}/p/${poll.id}`;
  const [showQr, setShowQr] = useState(false);
  const countdown = formatCloseCountdown(poll.closes_at);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied');
    } catch {
      toast('Link: ' + link);
    }
  }

  return (
    <div className="panel poll-page-panel">
      <h2>Share poll</h2>
      <p className="poll-hint" style={{ marginTop: -4 }}>
        Anyone can find and access this poll
      </p>
      <div className="share-row">
        <input type="text" readOnly value={link} />
        <button className="btn-outline copy-btn" onClick={copyLink} aria-label="Copy link">
          <img src="/icons/board/copy-outline.svg" alt="" width={24} height={24} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
        <a
          className="btn-outline"
          style={{ textDecoration: 'none', display: 'inline-block', flex: 1, textAlign: 'center' }}
          href={`https://wa.me/?text=${encodeURIComponent(`${poll.title} — ${link}`)}`}
          target="_blank"
          rel="noreferrer"
        >
          Share via WhatsApp
        </a>
        <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={() => setShowQr(true)}>
          View QR code
        </button>
      </div>
      <div className="chat-mock">
        <div className="chat-card">
          <div className="thumb-fallback">
            <img src="/icons/board/komon-icon-white.svg" alt="" width={24} height={24} />
            <img src="/icons/board/komon-lettermark-white.svg" alt="" width={85} height={16} />
          </div>
          <div className="body">
            <p className="t">{poll.title}</p>
            {/* Figma's raw text here read "Closes in 7 days · komonapp.com" —
                that domain doesn't match komon.app used everywhere else in
                this codebase (including this same card before this change),
                so treating it as a Figma typo rather than intentional
                distinct copy for this one screen; kept komon.app for
                consistency. */}
            <p className="s">
              {countdown.charAt(0).toUpperCase() + countdown.slice(1)}
              <span className="board-dot" style={{ margin: '0 6px' }} />
              komon.app
            </p>
          </div>
        </div>
      </div>
      <QRModal open={showQr} onClose={() => setShowQr(false)} title={poll.title} hint="Scan to vote in this poll." value={link} />
    </div>
  );
}
