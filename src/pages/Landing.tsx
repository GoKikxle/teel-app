import { useState } from 'react';
import { Logo } from '../components/Logo';
import { WaitlistModal } from '../components/WaitlistModal';

// Purely illustrative — matches the "Manchester hiking" notification card
// in the "Komon waitlist Page" Figma frame exactly (names, initials, and
// per-avatar colors as designed there). Never fetched, never persisted.
const HERO_AVATARS = [
  { initial: 'T', color: '#00c8b3' },
  { initial: 'K', color: '#f050f9' },
  { initial: 'V', color: '#0088ff' },
];

// Anonymous visitors land here at '/' instead of the board — see Home.tsx,
// which renders this only when there's no signed-in session. Nav.tsx skips
// its own bar for this exact route (see the pathname check there) since
// this page's own header — logo + "Join our waitlist" — replaces it, per
// the Figma frame this was rebuilt from. The app is pre-launch, so joining
// the waitlist (via the header CTA, opening WaitlistModal) is the only
// action available here — no quiet way back into the live create flow.
export function Landing() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="waitlist-page">
      <header className="waitlist-topbar">
        <Logo />
        <button className="waitlist-topbar-cta" onClick={() => setModalOpen(true)}>
          Join our waitlist
        </button>
      </header>

      <h1 className="waitlist-headline">Small gatherings, sorted.</h1>

      <div className="waitlist-hero-card">
        {/* See public/hero.jpg. Sized to the Figma frame's 711:400 crop;
            object-fit: cover means a differently-cropped replacement photo
            will still fill it cleanly. */}
        <img className="waitlist-hero-photo" src="/hero.jpg" alt="Friends at a gathering" />

        <div className="waitlist-notif waitlist-notif-dark">
          <img src="/icon.svg" alt="" width={16} height={16} />
          <p>
            <strong>Olive Garden, 09 June. </strong>John just paid!
          </p>
        </div>

        <div className="waitlist-notif waitlist-notif-light">
          <img src="/icon.svg" alt="" width={20} height={20} />
          <p>
            <strong>Manchester hiking, 28 Aug</strong>, All guests confirmed!
          </p>
          <div className="waitlist-avatar-group">
            {HERO_AVATARS.map((a) => (
              <div key={a.initial} className="waitlist-avatar" style={{ background: a.color }}>
                {a.initial}
              </div>
            ))}
            <div className="waitlist-avatar" style={{ background: '#000' }}>
              +2
            </div>
          </div>
        </div>
      </div>

      <footer className="waitlist-footer">© 2026 Komon. All rights reserved.</footer>

      <WaitlistModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
