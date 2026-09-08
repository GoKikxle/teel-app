import { supabase } from '../lib/supabase';

// Lowercases the email before using it, so a waitlist signup and a later
// sign-in attempt compare equal regardless of how each was typed —
// Postgres' text equality is case-sensitive, and this table has no
// citext/lowercasing at the schema level, so the normalization has to
// happen here, consistently, on every call site rather than trusting each
// caller to do it themselves. api/signin.ts does its own normalization
// separately (it can't import this client-only module).
function normalize(email: string): string {
  return email.trim().toLowerCase();
}

// No .select() chained on the insert below — the waitlist table has no
// select policy at all (see 0007_waitlist.sql), so asking PostgREST to
// return the inserted row would fail under RLS. The insert itself is all
// this needs.
//
// firstName/lastName are trimmed but otherwise unvalidated — see
// 0009_waitlist_names.sql, which adds them as nullable columns with no
// backfill for pre-existing rows. Both are optional: WaitlistModal.tsx
// (the landing page's full signup form) always supplies both, but the
// low-key WaitlistInlinePrompt shown on guest surfaces only asks for an
// email, so this needs to accept that too rather than forcing empty
// strings into columns that are genuinely nullable.
export async function joinWaitlist(email: string, firstName?: string, lastName?: string): Promise<'joined' | 'already'> {
  const { error } = await supabase
    .from('waitlist')
    .insert({ email: normalize(email), first_name: firstName?.trim() || null, last_name: lastName?.trim() || null });
  if (error) {
    if (error.code === '23505') return 'already';
    throw error;
  }
  return 'joined';
}
