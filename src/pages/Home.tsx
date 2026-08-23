import { useAuth } from '../hooks/useAuth';
import { Board } from './Board';
import { Landing } from './Landing';

// Root route: signed-in sessions get the real board; anonymous visitors get
// a marketing landing page instead (see Landing.tsx). Gating on `ready`
// avoids a Landing->Board flash for a signed-in session whose auth
// bootstrap just hasn't resolved yet on first load.
export function Home() {
  const { ready, isPersistent } = useAuth();

  if (!ready) {
    return (
      <div className="wrap">
        <p className="lede">Loading…</p>
      </div>
    );
  }

  return isPersistent ? <Board /> : <Landing />;
}
