import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '@base-ui/react/dialog';
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
// this page's own header — logo + "Sign in" + "Join waitlist" — replaces
// it, per the "Updated nav bar" Figma section (node 1221:1278) this was
// rebuilt from. The app is pre-launch, so joining the waitlist (via the
// header CTA, opening WaitlistModal) is the only action available here for
// most visitors — "Sign in" is just the way back in for the already-
// approved few (see useCreateGate's own redirect for the only other path
// to /signin, which never fires from this page).
export function Landing() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // "Join waitlist" inside the mobile menu needs to close the menu first,
  // then open WaitlistModal — not both at once (they'd visually stack) and
  // not via a guessed setTimeout either. onOpenChangeComplete below fires
  // once the menu's own close animation genuinely finishes, so this just
  // remembers the request until that happens.
  const [waitlistOpenPending, setWaitlistOpenPending] = useState(false);

  function handleSignInFromMenu() {
    setMenuOpen(false);
    navigate('/signin');
  }

  function handleJoinWaitlistFromMenu() {
    setWaitlistOpenPending(true);
    setMenuOpen(false);
  }

  function handleMenuOpenChangeComplete(open: boolean) {
    if (!open && waitlistOpenPending) {
      setModalOpen(true);
      setWaitlistOpenPending(false);
    }
  }

  return (
    <div className="waitlist-page">
      <div className="waitlist-topbar-wrap">
        <header className="waitlist-topbar">
          <Logo />
          <div className="waitlist-topbar-actions">
            <button type="button" className="waitlist-topbar-signin" onClick={() => navigate('/signin')}>
              Sign in
            </button>
            <button className="waitlist-topbar-cta" onClick={() => setModalOpen(true)}>
              Join waitlist
            </button>
            {/* Mobile only (see index.css's (max-width: 430px) block, which
                hides .waitlist-topbar-signin above and shows this instead)
                — a full-screen takeover per the "Mobile nav - sign in
                updated" Figma frame (node 1227:1204), not the small
                anchored drawer the previous version had here. Base UI's
                Dialog (not Menu, which the previous drawer used) is the
                right primitive for that: modal:true gives focus-trap,
                document scroll lock, and outside-press dismissal for
                free, with no anchoring/positioning logic needed at all —
                unlike the drawer, which had to measure the topbar's own
                page position by hand since it wasn't a full-screen shape. */}
            <Dialog.Root
              open={menuOpen}
              onOpenChange={setMenuOpen}
              onOpenChangeComplete={handleMenuOpenChangeComplete}
            >
              <Dialog.Trigger className="waitlist-topbar-mobile-trigger" aria-label="Menu">
                <img src="/icons/board/menu-alt.svg" alt="" width={24} height={24} />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Popup className="waitlist-mobile-menu-overlay" aria-label="Menu" aria-modal="true">
                  <div className="waitlist-mobile-menu-header">
                    <Logo />
                    <Dialog.Close className="waitlist-topbar-mobile-trigger" aria-label="Close menu">
                      <img src="/icons/board/close-md.svg" alt="" width={24} height={24} />
                    </Dialog.Close>
                  </div>
                  <div className="waitlist-mobile-menu-buttons">
                    {/* Same pill styling as the desktop actions row
                        (.waitlist-topbar-signin / .waitlist-topbar-cta),
                        just full-width — .waitlist-mobile-menu-pill only
                        adds that. "Join waitlist" here is new: the old
                        drawer only ever had "Sign in" in it. */}
                    <button
                      type="button"
                      className="waitlist-topbar-signin waitlist-mobile-menu-pill"
                      onClick={handleSignInFromMenu}
                    >
                      Sign in
                    </button>
                    <button
                      type="button"
                      className="waitlist-topbar-cta waitlist-mobile-menu-pill"
                      onClick={handleJoinWaitlistFromMenu}
                    >
                      Join waitlist
                    </button>
                  </div>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </header>
      </div>

      <h1 className="waitlist-headline">Small gatherings, sorted.</h1>

      {/* Wraps the photo card and the two floating notification cards as
          siblings (not the cards nested inside the photo's own padded box)
          — desktop positions the cards absolutely over this group; mobile
          (see index.css) turns the group into a simple flex-column stack,
          photo then cards, per the "- mobile" Figma frames. */}
      <div className="waitlist-hero-group">
        <div className="waitlist-hero-card">
          {/* See public/hero.jpg. Sized to the desktop frame's 711:400 crop
              (309:283 on mobile — see index.css); object-fit: cover means a
              differently-cropped replacement photo will still fill it
              cleanly. */}
          <img className="waitlist-hero-photo" src="/hero.jpg" alt="Friends at a gathering" />
        </div>

        <div className="waitlist-notif waitlist-notif-dark">
          <img src="/icon.svg" alt="" width={16} height={16} />
          <p>
            <strong>Olive Garden, 09 June. </strong>John just paid!
          </p>
        </div>

        <div className="waitlist-notif waitlist-notif-light">
          <img src="/icon.svg" alt="" width={20} height={20} />
          <p>
            <strong>Manchester hiking, 28 Aug</strong>
            {/* Copy is shorter on mobile in Figma ("All confirmed!" vs
                "All guests confirmed!") — toggled by breakpoint in CSS
                rather than picked in JS, since it's a pure display switch. */}
            <span className="waitlist-notif-full">, All guests confirmed!</span>
            <span className="waitlist-notif-short">, All confirmed!</span>
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
