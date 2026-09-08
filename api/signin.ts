// Vercel Edge Function — the ONLY place in this app that's allowed to call
// Supabase's signInWithOtp. POST /api/signin { email: string } ->
// { status: 'sent' | 'waitlisted' | 'error', message?: string }.
//
// Why this exists: the client used to call checkWaitlistApproval() (a
// public RPC, is_waitlist_approved() — see 0008_waitlist_grandfather.sql)
// and only call supabase.auth.signInWithOtp() directly from the browser if
// that returned true. The RPC itself is a real server-side check, but it
// never actually gated anything: signInWithOtp is a public Supabase Auth
// endpoint, callable with the same anon key already shipped in the client
// bundle, so anyone could skip the RPC and call it directly for any email —
// Supabase has no concept of this app's waitlist, so it would happily
// create a (real, if unconfirmed) user and send a working magic link
// regardless of approval. This endpoint moves the decision here instead:
// the client now POSTs { email } to this route and never calls
// signInWithOtp itself (see useAuth.tsx's requestSignIn).
//
// Bug fix: this was originally written with the Web-standard
// `(request: Request) => Promise<Response>` signature but no explicit
// `config.runtime`, so Vercel built it as a Node.js Function — which
// expects the legacy `(req, res) => void` signature (write to `res`,
// don't return a value). Every `return new Response(...)` below was
// silently dropped as a result, so no response ever reached the client;
// every request just hung until Vercel's own 300s timeout killed it. The
// `export const config` below opts this into the Edge runtime instead,
// which natively expects exactly the Request/Response signature this
// file already uses — no rewrite of the handler itself needed.
//
// Uses @supabase/supabase-js rather than raw fetch (unlike
// middleware.ts/poll-link-preview.ts) — unlike @vercel/og (see the
// archived poll-keepsake feature), this SDK is genuinely isomorphic and
// runs fine on Edge, so reusing it here means the actual signInWithOtp
// call is byte-for-byte the same shape the client used to make (same
// options), rather than a hand-rolled reimplementation of GoTrue's wire
// format that could subtly drift from it (e.g. getting the redirect
// option's request shape wrong in a way that silently breaks the
// emailed link).
//
// Requires SUPABASE_SERVICE_ROLE_KEY in addition to the existing
// VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY — set it in the Vercel
// project's Environment Variables (Project Settings -> Environment
// Variables). Deliberately NOT prefixed with VITE_: that prefix is what
// tells Vite to inline a variable into the client bundle, and this key
// must never leave the server. It's also not read from .env.local by Vite
// for the same reason — add it there too (locally only, never committed)
// if you need to run this function locally.
//
// Privacy/enumeration: the waitlist table has no select policy at all (see
// 0007_waitlist.sql) — this is the one place allowed to read the real
// `approved` column directly, via the service-role key, which bypasses
// RLS entirely. The response never reveals whether an email was already
// on the waitlist versus newly added — both paths return the identical
// { status: 'waitlisted' }, so this can't be used to probe who has
// attempted to sign in before.
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// A permissive sanity check, not full RFC 5322 validation — Supabase's own
// auth endpoint is the real validator; this just filters obvious junk
// before it reaches Supabase or gets written to the waitlist table.
function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ status: 'error', message: 'Method not allowed' }, { status: 405 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('api/signin: missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY');
    return Response.json({ status: 'error', message: 'Server misconfigured' }, { status: 500 });
  }

  let email: string;
  try {
    const body = (await request.json()) as { email?: unknown };
    email = normalizeEmail(typeof body.email === 'string' ? body.email : '');
  } catch {
    return Response.json({ status: 'error', message: 'Invalid request body' }, { status: 400 });
  }
  if (!isPlausibleEmail(email)) {
    return Response.json({ status: 'error', message: 'Enter a valid email address' }, { status: 400 });
  }

  // persistSession: false — this is a short-lived server-side client with
  // nowhere to persist a session to (no browser storage), and it should
  // never accidentally hold one open across requests either way.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: existing, error: readError } = await adminClient.from('waitlist').select('approved').eq('email', email).maybeSingle();
  if (readError) {
    console.error('api/signin: waitlist read failed', readError);
    return Response.json({ status: 'error', message: 'Something went wrong — try again' }, { status: 500 });
  }

  if (!existing?.approved) {
    // Insert-or-ignore: whether this email has never been seen or was
    // already sitting on the waitlist unapproved, the outcome (still on
    // the waitlist) and the response are identical either way.
    const { error: insertError } = await adminClient.from('waitlist').insert({ email });
    if (insertError && insertError.code !== '23505') {
      // Not fatal to the response — the person still gets the same
      // friendly waitlist message even if this particular write failed;
      // logged so it's visible without surfacing an error to them.
      console.error('api/signin: waitlist insert failed', insertError);
    }
    return Response.json({ status: 'waitlisted' });
  }

  // Approved — the only place in the app allowed to call signInWithOtp.
  // Same call shape (and thus same emailed-link redirect behavior) as
  // useAuth.tsx used to make directly from the browser.
  const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const origin = request.headers.get('origin') || new URL(request.url).origin;
  const { error: otpError } = await anonClient.auth.signInWithOtp({ email, options: { emailRedirectTo: origin } });
  if (otpError) {
    console.error('api/signin: signInWithOtp failed', otpError);
    return Response.json({ status: 'error', message: 'Could not send the sign-in link — try again' }, { status: 500 });
  }

  return Response.json({ status: 'sent' });
}
