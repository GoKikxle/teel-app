import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  userId: string | null;
  ready: boolean;
  /** True once auth.uid() belongs to a real (non-anonymous) account — i.e. the
   *  session will follow the person to another device/browser. */
  isPersistent: boolean;
  /** Only set once isPersistent is true. */
  email: string | null;
  /** POSTs to api/signin — the only place allowed to call Supabase's
   *  signInWithOtp (see that file's own header comment for why this isn't
   *  called directly from the client anymore). Does NOT touch the current
   *  (possibly anonymous) session either way: if approved, nothing changes
   *  until the person clicks the emailed link, at which point auth-js swaps
   *  in a session for that email's account (new or existing) — a deliberate
   *  account switch, not an upgrade-in-place, which is fine because nothing
   *  is ever written under the anonymous uid before sign-in commits. If not
   *  approved, the email is recorded on the waitlist server-side and no
   *  session-affecting call is made at all. */
  requestSignIn: (email: string) => Promise<{ status: 'sent' | 'waitlisted' | 'error'; message?: string }>;
  /** Signs out of the persistent account. The app always needs *some*
   *  session — guests RSVP/vote/pay anonymously — so a fresh anonymous
   *  session is established right behind it (see the SIGNED_OUT handler
   *  below), not left null. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  userId: null,
  ready: false,
  isPersistent: false,
  email: null,
  requestSignIn: async () => ({ status: 'error', message: 'Not ready' }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const { data } = await supabase.auth.getSession();
      let session = data.session;

      if (!session) {
        const { data: signInData, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error('Anonymous sign-in failed', error);
        }
        session = signInData?.session ?? null;
      }

      if (mounted) {
        setUser(session?.user ?? null);
        setReady(true);
      }
    }

    bootstrap();

    // Fires when the person clicks the emailed magic link — including in a
    // different tab of the same browser, since auth-js syncs sessions across
    // tabs via localStorage. That's what lets a pending "create gathering"
    // flow resume in the original tab without the person having to come back
    // and click anything else.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);

      if (event === 'SIGNED_OUT') {
        // signOut() below clears the session outright — immediately swap in
        // a fresh anonymous one so the app (and any guest browsing) never
        // sees a null userId.
        supabase.auth.signInAnonymously().then(({ data, error }) => {
          if (error) console.error('Anonymous re-sign-in after logout failed', error);
          if (mounted) setUser(data?.user ?? null);
        });
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Fails closed: any thrown error (network failure, bad JSON, non-2xx
  // with no parseable body) resolves to { status: 'error' } — never
  // 'sent', so a failed request can't be mistaken for a link having gone
  // out. See api/signin.ts for what actually decides sent vs waitlisted.
  async function requestSignIn(email: string): Promise<{ status: 'sent' | 'waitlisted' | 'error'; message?: string }> {
    try {
      const res = await fetch('/api/signin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { status: 'sent' | 'waitlisted' | 'error'; message?: string };
      return data;
    } catch (err) {
      console.error('requestSignIn failed', err);
      return { status: 'error', message: 'Something went wrong — try again' };
    }
  }

  async function signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Sign out failed', error);
    // Re-anonymization happens in the onAuthStateChange SIGNED_OUT handler.
  }

  const value: AuthState = {
    userId: user?.id ?? null,
    ready,
    isPersistent: user ? user.is_anonymous === false : false,
    email: user?.is_anonymous === false ? (user.email ?? null) : null,
    requestSignIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
