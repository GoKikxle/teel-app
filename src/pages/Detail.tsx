import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { activeRsvps, fetchGathering } from '../data/gatherings';
import type { GatheringWithRelations } from '../lib/database.types';
import { useAuth } from '../hooks/useAuth';
import { CATS, VIS, fmtDate } from '../lib/constants';
import { RsvpPanel } from '../components/detail/RsvpPanel';
import { SplitPayPanel } from '../components/detail/SplitPayPanel';
import { PollPanel } from '../components/detail/PollPanel';
import { InvitePanel } from '../components/detail/InvitePanel';
import { SharePanel } from '../components/detail/SharePanel';
import { InviteGate } from '../components/detail/InviteGate';
import { OrganizerPanel } from '../components/detail/OrganizerPanel';
import { CancelledPanel } from '../components/detail/CancelledPanel';

function gateKey(gatheringId: string) {
  return `teel-gate-${gatheringId}`;
}

export function Detail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const previewAsGuest = searchParams.get('preview') === 'guest';
  const { userId, ready } = useAuth();

  const [gathering, setGathering] = useState<GatheringWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [gateVerified, setGateVerified] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    fetchGathering(id)
      .then((data) => {
        setGathering(data);
        setGateVerified(Boolean(sessionStorage.getItem(gateKey(id))));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !ready) {
    return (
      <div className="wrap">
        <p className="lede">Loading…</p>
      </div>
    );
  }

  if (!gathering || !id) {
    return (
      <div className="wrap">
        <p className="lede">Gathering not found.</p>
        <button className="btn-outline" onClick={() => navigate('/')}>
          ← Back to board
        </button>
      </div>
    );
  }

  const isOrganizer = gathering.organizer_id === userId;

  if (gathering.visibility === 'invited' && !gateVerified && (previewAsGuest || !isOrganizer)) {
    return (
      <InviteGate
        gathering={gathering}
        previewAsGuest={previewAsGuest}
        onVerified={() => {
          sessionStorage.setItem(gateKey(id), '1');
          setGateVerified(true);
          load();
        }}
      />
    );
  }

  const c = CATS[gathering.category];
  const v = VIS[gathering.visibility];
  const isCancelled = Boolean(gathering.cancelled_at);
  const going = activeRsvps(gathering);
  // Only an active RSVP counts as "mine" — a cancelled row for this user
  // still exists (for its payment history), but the UI should treat it the
  // same as never having RSVP'd, so upsertRsvp's un-cancel path can kick in.
  const myRsvp = going.find((r) => r.guest_user_id === userId);

  return (
    <div className="wrap">
      <button className="btn-outline" style={{ marginBottom: 20 }} onClick={() => navigate('/')}>
        ← Back to board
      </button>
      <div className="detail-top">
        <div>
          <div className="hero-flyer" style={{ '--accent': c.accent, '--accent-dark': c.dark } as React.CSSProperties}>
            <div className="stripe" />
            <div className="cat">
              {c.label} <span className="vis-badge">{v.icon} {v.label}</span>
              {isCancelled && <span className="vis-badge cancelled-badge">Cancelled</span>}
            </div>
            <div className="title">{gathering.title}</div>
            <div className="meta">
              {fmtDate(gathering.gathering_date)} · {gathering.gathering_time || '—'}
              <br />
              {gathering.location || 'TBD'}
              <br />
              {going.length}/{gathering.capacity} going
            </div>
            {gathering.cover_image_url && (
              <div className="flyer-photo" style={{ backgroundImage: `url(${gathering.cover_image_url})` }} />
            )}
          </div>

          <SharePanel gathering={gathering} />
        </div>

        <div>
          {isOrganizer && <OrganizerPanel gathering={gathering} onChange={load} />}

          {isCancelled ? (
            <CancelledPanel gathering={gathering} />
          ) : (
            <>
              {userId && <RsvpPanel gathering={gathering} userId={userId} myRsvp={myRsvp} onChange={load} />}

              {isOrganizer && gathering.visibility === 'invited' && (
                <InvitePanel gathering={gathering} onChange={load} onPreviewGuest={() => navigate(`/g/${id}?preview=guest`)} />
              )}

              {gathering.poll_enabled && userId && <PollPanel gathering={gathering} userId={userId} onChange={load} />}
            </>
          )}

          {gathering.cost_enabled && (
            <SplitPayPanel gathering={gathering} myRsvp={myRsvp} onChange={load} readOnly={isCancelled} />
          )}
        </div>
      </div>
    </div>
  );
}
