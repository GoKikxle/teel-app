import type { GatheringWithRelations } from '../../lib/database.types';
import { CATS, VIS, fmtDate } from '../../lib/constants';
import { useToast } from '../../hooks/useToast';

export function SharePanel({ gathering }: { gathering: GatheringWithRelations }) {
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
