// Vercel Edge Middleware — serves crawler-only requests to /g/:id a tiny
// static HTML document with real per-gathering og:/twitter: meta tags.
// Real browsers get nothing back here (the function returns undefined) and
// fall through to the normal Vite SPA, unchanged.
//
// Why this exists at all: link-preview crawlers (WhatsApp, iMessage,
// Slack, Discord, ...) don't execute JavaScript — they read whatever HTML
// the server sends on first response. A client-rendered SPA sends the same
// static index.html for every route, so without this, every shared
// gathering link unfurls identically (generic site title/description, no
// photo). PRD §3 calls out WhatsApp sharing specifically, so this matters
// for v1, not just polish.
//
// Edge Runtime constraints: no Node APIs, no @supabase/supabase-js (it's
// not guaranteed edge-safe end to end) — just a raw fetch to Supabase's
// PostgREST endpoint using the same public anon key already shipped in the
// client bundle (gatherings are RLS-open to select, so this exposes
// nothing new). process.env works here for whatever's configured in the
// Vercel project's Environment Variables — VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY must already be set there for the production
// build to work at all.
export const config = {
  matcher: ['/g/:id'],
};

// Edge Runtime only actually exposes process.env (for the project's
// configured Environment Variables) — not the rest of Node's process API —
// so this declares just that rather than pulling in @types/node wholesale.
declare const process: { env: Record<string, string | undefined> };

// Matches the major link-unfurling crawlers. Notably, Apple's iMessage
// preview fetcher identifies itself as facebookexternalhit — a deliberate
// choice on Apple's part for compatibility with sites that only special-
// case Facebook's bot — so there's no separate "iMessage" token to match.
const CRAWLER_UA =
  /facebookexternalhit|WhatsApp|Twitterbot|Slackbot|TelegramBot|Discordbot|LinkedInBot|SkypeUriPreview|Pinterest|redditbot|Applebot|Iframely|Embedly|vkShare|W3C_Validator/i;

const KNOWN_CATEGORIES = new Set(['hike', 'brunch', 'game', 'dj', 'poetry', 'other']);

interface GatheringRow {
  title: string;
  category: string;
  gathering_date: string;
  gathering_time: string | null;
  location: string | null;
  cover_image_url: string | null;
  cancelled_at: string | null;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Deliberately reimplemented rather than imported from src/lib/constants —
// that file (and src/data/gatherings.ts) assume a Vite/browser build
// context (import.meta.env, etc.) and aren't guaranteed to survive being
// bundled for the Edge Runtime by Vercel's separate middleware build step.
function fmtDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00`);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

async function fetchGathering(id: string): Promise<GatheringRow | null> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('middleware: missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY');
    return null;
  }

  const endpoint =
    `${url}/rest/v1/gatherings?id=eq.${encodeURIComponent(id)}` +
    `&select=title,category,gathering_date,gathering_time,location,cover_image_url,cancelled_at`;

  const res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) return null;
  const rows = (await res.json()) as GatheringRow[];
  return rows[0] ?? null;
}

function metaResponse(params: {
  origin: string;
  path: string;
  title: string;
  description: string;
  image: string;
  // Only known-accurate for the six generated fallback cards in
  // public/og/*.png (always exactly 1200x630 by construction). A real
  // uploaded cover photo's actual dimensions aren't known here without
  // fetching and decoding the image ourselves, and declaring 1200x630
  // for a photo that's actually e.g. 1400x1400 is just false metadata —
  // omit the tags entirely rather than assert a size we haven't verified.
  imageDimensions?: { width: number; height: number };
}): Response {
  const { origin, path, title, description, image, imageDimensions } = params;
  const pageUrl = `${origin}${path}`;
  const dimensionTags = imageDimensions
    ? `\n<meta property="og:image:width" content="${imageDimensions.width}" />\n<meta property="og:image:height" content="${imageDimensions.height}" />`
    : '';
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<meta property="og:site_name" content="Teel" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${escapeHtml(pageUrl)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(image)}" />${dimensionTags}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body>
<p><a href="${escapeHtml(pageUrl)}">${escapeHtml(title)}</a></p>
<p>${escapeHtml(description)}</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Short edge cache: WhatsApp/iMessage re-fetch on every share, this
      // keeps that from hitting Supabase on every single unfurl.
      'cache-control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
    },
  });
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const ua = request.headers.get('user-agent') || '';
  if (!CRAWLER_UA.test(ua)) return undefined; // real visitors: fall through to the SPA, untouched

  const url = new URL(request.url);
  const match = /^\/g\/([^/]+)$/.exec(url.pathname);
  if (!match) return undefined;
  const id = decodeURIComponent(match[1]);

  const gathering = await fetchGathering(id);

  if (!gathering) {
    return metaResponse({
      origin: url.origin,
      path: url.pathname,
      title: 'Gathering not found — Teel',
      description: 'This gathering may have been removed.',
      image: `${url.origin}/og/other.png`,
      imageDimensions: { width: 1200, height: 630 },
    });
  }

  const cancelled = Boolean(gathering.cancelled_at);
  const title = `${cancelled ? 'Cancelled: ' : ''}${gathering.title} — Teel`;

  const dateLabel = fmtDate(gathering.gathering_date);
  const timeLabel = gathering.gathering_time ? ` · ${gathering.gathering_time}` : '';
  const locationLabel = gathering.location ? ` — ${gathering.location}` : '';
  const description = cancelled
    ? `Cancelled by the organizer. Was ${dateLabel}${timeLabel}${locationLabel}.`
    : `${dateLabel}${timeLabel}${locationLabel}`;

  const category = KNOWN_CATEGORIES.has(gathering.category) ? gathering.category : 'other';
  const usingFallback = !gathering.cover_image_url;
  const image = gathering.cover_image_url || `${url.origin}/og/${category}.png`;

  return metaResponse({
    origin: url.origin,
    path: url.pathname,
    title,
    description,
    image,
    imageDimensions: usingFallback ? { width: 1200, height: 630 } : undefined,
  });
}
