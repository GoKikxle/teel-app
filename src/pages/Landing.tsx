import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu } from '@base-ui/react/menu';
import { Logo } from '../components/Logo';
import { WaitlistModal } from '../components/WaitlistModal';

interface DrawerRect {
  top: number;
  left: number;
  width: number;
}

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
  const [drawerRect, setDrawerRect] = useState<DrawerRect>({ top: 0, left: 0, width: 0 });
  const topbarWrapRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  // Measures .waitlist-topbar-wrap's own page position so the drawer
  // (portaled to document.body, like Nav.tsx's own mobile menu — needed to
  // keep that pattern's outside-click dismissal working, which broke when
  // this was portaled into a custom container instead) can still render as
  // a full-width card exactly below it. Unlike Nav.tsx's fixed-position
  // mobile-nav-positioner (pinned to its always-fixed nav bar's constant
  // height), this topbar scrolls with the page, so the offset is measured
  // instead of hardcoded, and re-measured on resize while open.
  function updateDrawerRect() {
    const el = topbarWrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDrawerRect({ top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX, width: rect.width });
  }

  useEffect(() => {
    if (!menuOpen) return;
    window.addEventListener('resize', updateDrawerRect);
    return () => window.removeEventListener('resize', updateDrawerRect);
  }, [menuOpen]);

  function handleMenuOpenChange(open: boolean) {
    if (open) {
      updateDrawerRect();
    } else {
      // Base UI returns focus to the trigger on close by default, but
      // that relies on floating-ui's own anchor tracking, which this
      // drawer bypasses (position comes from updateDrawerRect above, not
      // floating-ui) — so it's done explicitly here instead.
      menuTriggerRef.current?.focus();
    }
    setMenuOpen(open);
  }

  return (
    <div className="waitlist-page">
      <div className="waitlist-topbar-wrap" ref={topbarWrapRef}>
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
                — reuses Nav.tsx's own Menu.Root/Trigger/Portal/Popup/Item
                pattern (Base UI) for the same accessible open/close-on-
                outside-click/Escape behavior, rather than a bespoke
                dropdown. Positioning (see updateDrawerRect above) is the
                one thing that can't be reused verbatim from Nav.tsx's own
                trigger, since that one anchors a fixed nav bar's height,
                not this page's own scrolling topbar. */}
            <Menu.Root open={menuOpen} onOpenChange={handleMenuOpenChange}>
              <Menu.Trigger
                ref={menuTriggerRef}
                className="waitlist-topbar-mobile-trigger"
                aria-label={menuOpen ? 'Close menu' : 'Menu'}
              >
                <img
                  src={menuOpen ? '/icons/board/close-md.svg' : '/icons/board/menu-alt.svg'}
                  alt=""
                  width={24}
                  height={24}
                />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner
                  className="waitlist-mobile-drawer-positioner"
                  style={
                    {
                      '--waitlist-drawer-top': `${drawerRect.top}px`,
                      '--waitlist-drawer-left': `${drawerRect.left}px`,
                      '--waitlist-drawer-width': `${drawerRect.width}px`,
                    } as React.CSSProperties
                  }
                >
                  <Menu.Popup className="waitlist-mobile-drawer">
                    {/* Figma's drawer row is built from a shared "Menu /
                        Item / Vertical / Navigation Item" component — the
                        same primitive behind Nav.tsx's own
                        .account-dropdown-logout / .mobile-nav-menu-item
                        "Log out" rows — but this instance overrides it to
                        a solid full-width pill (no icon/chevron), not
                        their rectangular icon+text row style. Visual
                        styling is new (.waitlist-topbar-signin /
                        .waitlist-mobile-signin) to match that pill exactly;
                        the Sign-in action and Menu.Item wiring are reused
                        as-is. */}
                    <Menu.Item
                      className="waitlist-topbar-signin waitlist-mobile-signin"
                      onClick={() => navigate('/signin')}
                    >
                      Sign in
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
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
