import type { GatheringWithRelations } from '../../lib/database.types';
import { CATS, VIS, fmtDate } from '../../lib/constants';
import { useToast } from '../../hooks/useToast';
import { QRCode } from '../QRCode';

// quickShare adds a real WhatsApp share action and a QR code, for Split
// Bill's share screen — omit it (the full-flow call site on Detail.tsx
// does) and this renders exactly as it always has.
export function SharePanel({ gathering, quickShare = false }: { gathering: GatheringWithRelations; quickShare?: boolean }) {
  const toast = useToast();
  const c = CATS[gathering.category];
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
        <button className="btn-outline" onClick={copyLink}>
          Copy link
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
            style={{
              background: c.accent,
              ...(gathering.cover_image_url
                ? { backgroundImage: `url(${gathering.cover_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : {}),
            }}
          />
          <div className="body">
            <p className="t">{gathering.title}</p>
            <p className="s">{fmtDate(gathering.gathering_date)} · teel.app</p>
          </div>
        </div>
      </div>
    </div>
  );
}
