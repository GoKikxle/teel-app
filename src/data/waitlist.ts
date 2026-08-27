import { supabase } from '../lib/supabase';

// Both functions below lowercase the email before using it, so a waitlist
// signup and a later sign-in attempt compare equal regardless of how each
// was typed — Postgres' text equality is case-sensitive, and this table has
// no citext/lowercasing at the schema level, so the normalization has to
// happen here, consistently, on every call site rather than trusting each
// caller to do it themselves.
function normalize(email: string): string {
  return email.trim().toLowerCase();
}

// Calls the is_waitlist_approved() function (see
// 0008_waitlist_grandfather.sql) rather than selecting the table directly —
// there's still no select policy on waitlist itself, so this is the only
// way to check one email's status without exposing the whole list. Throws
// on any failure (network, RPC error) rather than returning false, so a
// failed check can never be silently mistaken for "not approved" by a
// caller that isn't paying attention — see SignInModal.tsx, which fails
// closed on a thrown error rather than treating it as approved or denied.
export async function checkWaitlistApproval(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_waitlist_approved', { check_email: normalize(email) });
  if (error) throw error;
  return data === true;
}

// No .select() chained on the insert below — the waitlist table has no
// select policy at all (see 0007_waitlist.sql), so asking PostgREST to
// return the inserted row would fail under RLS. The insert itself is all
// this needs.
//
// firstName/lastName are trimmed but otherwise unvalidated — see
// 0009_waitlist_names.sql, which adds them as nullable columns with no
// backfill for pre-existing rows.
export async function joinWaitlist(email: string, firstName: string, lastName: string): Promise<'joined' | 'already'> {
  const { error } = await supabase
    .from('waitlist')
    .insert({ email: normalize(email), first_name: firstName.trim(), last_name: lastName.trim() });
  if (error) {
    if (error.code === '23505') return 'already';
    throw error;
  }
  return 'joined';
}
