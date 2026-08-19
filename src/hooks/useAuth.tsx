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
  /** Sends a magic link to the given email. Does NOT touch the current
   *  (possibly anonymous) session — nothing changes until the person clicks
   *  the link, at which point auth-js swaps in a session for that email's
   *  account (new or existing). This is a deliberate account switch, not an
   *  upgrade-in-place: the anonymous session's uid is abandoned, which is
   *  fine because nothing is ever written under it before sign-in commits —
   *  callers gate creation on isPersistent first. */
  signInWithOtp: (email: string) => Promise<{ error: string | null }>;
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
  signInWithOtp: async () => ({ error: 'Not ready' }),
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

  async function signInWithOtp(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
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
    signInWithOtp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
