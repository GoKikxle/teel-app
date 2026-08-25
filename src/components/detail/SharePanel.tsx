import type { GatheringWithRelations } from '../../lib/database.types';
import { VIS, fmtDate } from '../../lib/constants';
import { useToast } from '../../hooks/useToast';
import { QRCode } from '../QRCode';

// quickShare adds a real WhatsApp share action and a QR code, for Split
// Bill's share screen — omit it (the full-flow call site on Detail.tsx
// does) and this renders exactly as it always has.
export function SharePanel({ gathering, quickShare = false }: { gathering: GatheringWithRelations; quickShare?: boolean }) {
  const toast = useToast();
  const v = VIS[gathering.visibility];
  const link = `${window.location.origin}/g/${gathering.id}`;

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
      <h2>Share</h2>
      <p className="poll-hint" style={{ marginTop: -4 }}>
        {v.desc}
      </p>
      <div className="share-row">
        <input type="text" readOnly value={link} />
        <button className="btn-outline copy-btn" onClick={copyLink} aria-label="Copy link">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.3" stroke="currentColor" strokeWidth="1.3" />
            <path d="M3.5 10V3.8a1.3 1.3 0 0 1 1.3-1.3H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
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
          <QRCode value={link} size={120} />
        </div>
      )}
      <div className="chat-mock">
        <div className="chat-card">
          <div
            className="thumb"
            style={
              gathering.cover_image_url
                ? { backgroundImage: `url(${gathering.cover_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : undefined
            }
          />
          <div className="body">
            <p className="t">{gathering.title}</p>
            <p className="s">{fmtDate(gathering.gathering_date)} · komon.app</p>
          </div>
        </div>
      </div>
    </div>
  );
}
