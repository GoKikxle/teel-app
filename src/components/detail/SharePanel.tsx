import { useState } from 'react';
import type { GatheringWithRelations } from '../../lib/database.types';
import { VIS, fmtDate } from '../../lib/constants';
import { useToast } from '../../hooks/useToast';
import { QRModal } from '../QRModal';

// quickShare adds a real WhatsApp share action and a "View QR code"
// button, for Split Bill's share screen and the post-creation Created.tsx
// page (both gatherings and bills) — omit it (the full-flow gathering
// call site on Detail.tsx does) and this renders exactly as it always
// has. Not the same thing as isSplitBill below: a freshly-created
// gathering also gets quickShare=true from Created.tsx.
export function SharePanel({ gathering, quickShare = false }: { gathering: GatheringWithRelations; quickShare?: boolean }) {
  const toast = useToast();
  const v = VIS[gathering.visibility];
  const link = `${window.location.origin}/g/${gathering.id}`;
  const isSplitBill = gathering.kind === 'split_bill';
  const [showQr, setShowQr] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied');
    } catch {
      toast('Link: ' + link);
    }
  }

  return (
    <div className="panel" style={{ marginTop: 20 }}>
      <h2>{isSplitBill ? 'Share bill' : 'Share'}</h2>
      {/* v.desc is already sourced from the gathering's real visibility
          (createSplitBill hardcodes 'private' for every split bill — see
          data/gatherings.ts — so this always reads "Only people you share
          the link with can view or RSVP." for bills, never "Anyone can
          find..."; the Figma mock's sample text is a copy-paste leftover
          from the gathering share panel, not the actual bill copy). */}
      <p className="poll-hint" style={{ marginTop: -4 }}>
        {v.desc}
      </p>
      <div className="share-row">
        <input type="text" readOnly value={link} />
        <button className="btn-outline copy-btn" onClick={copyLink} aria-label="Copy link">
          <img src="/icons/board/copy-outline.svg" alt="" width={24} height={24} />
        </button>
      </div>
      {quickShare && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
          <a
            className="btn-outline"
            style={{ textDecoration: 'none', display: 'inline-block' }}
            href={`https://wa.me/?text=${encodeURIComponent(`${gathering.title} — ${link}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            Share via WhatsApp
          </a>
          <button type="button" className="btn-outline" onClick={() => setShowQr(true)}>
            View QR code
          </button>
        </div>
      )}
      <div className="chat-mock">
        <div className="chat-card">
          {gathering.cover_image_url ? (
            <div
              className="thumb"
              style={{ backgroundImage: `url(${gathering.cover_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
          ) : (
            <div className="thumb-fallback">
              <img src="/icons/board/komon-icon-white.svg" alt="" width={24} height={24} />
              <img src="/icons/board/komon-lettermark-white.svg" alt="" width={85} height={16} />
            </div>
          )}
          <div className="body">
            <p className="t">{gathering.title}</p>
            <p className="s">{fmtDate(gathering.gathering_date)} · komon.app</p>
          </div>
        </div>
      </div>
      {quickShare && (
        <QRModal
          open={showQr}
          onClose={() => setShowQr(false)}
          title={gathering.location ? `${gathering.title} - ${gathering.location}` : gathering.title}
          hint={isSplitBill ? 'Scan split bill QR code.' : 'Scan to view this gathering.'}
          value={link}
        />
      )}
    </div>
  );
}
