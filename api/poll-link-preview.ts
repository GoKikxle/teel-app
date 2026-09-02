// Vercel serverless function — real server-side link preview for Alias
// Polls' "paste a link" option field (src/pages/PollCreate.tsx), replacing
// the reviewed prototype's fake colored-initials-only version with an
// actual og:image/og:title scrape. GET /api/poll-link-preview?url=<...>
//
// Not covered by tsconfig.app.json (only includes src) or tsconfig.node.json
// (only includes vite.config.ts) — same pre-existing gap as middleware.ts.
// Type-check standalone from OUTSIDE the project directory (to dodge the
// tsconfig.json-present conflict error), same invocation middleware.ts uses:
//   npx --yes -p typescript tsc --noEmit --target es2023 --lib ES2023,DOM \
//     --module esnext --moduleResolution bundler --skipLibCheck api/poll-link-preview.ts
//
// Web-standard Request/Response signature (no @vercel/node dependency
// needed) — same shape middleware.ts already uses; Vercel's Node.js
// functions support this natively. No env vars needed here (unlike
// middleware.ts) — this never talks to Supabase, just the pasted URL.

const FETCH_TIMEOUT_MS = 6000;
const MAX_BODY_BYTES = 2_000_000; // don't buffer an unbounded response for a regex scrape

function extractMetaContent(html: string, key: string): string | null {
  // Meta tags show up with either attribute order and either property= or
  // name= — try the combinations actually seen in the wild rather than a
  // single rigid pattern.
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`, 'i'),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }
  return null;
}

function extractTitleTag(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function resolveUrl(maybeRelative: string, base: string): string | null {
  try {
    return new URL(maybeRelative, base).href;
  } catch {
    return null;
  }
}

export default async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get('url');
  if (!rawUrl) {
    return Response.json({ error: 'Missing url param' }, { status: 400 });
  }

  const withScheme = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  let target: URL;
  try {
    target = new URL(withScheme);
  } catch {
    return Response.json({ imageUrl: null, title: null, host: rawUrl });
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return Response.json({ imageUrl: null, title: null, host: target.hostname });
  }
  const host = target.hostname.replace(/^www\./, '');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(target.href, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Some sites (including Google Maps share links) serve a
        // meaningfully different — or blocked — response to an unlabeled
        // bot UA than to a normal browser.
        'user-agent':
          'Mozilla/5.0 (compatible; KomonLinkPreview/1.0; +https://komonapp.com) AppleWebKit/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) {
      return Response.json({ imageUrl: null, title: null, host });
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('xml')) {
      return Response.json({ imageUrl: null, title: null, host });
    }

    // Read only up to MAX_BODY_BYTES — og:/title tags always live in <head>,
    // near the top of the document, so a full-page read is never needed.
    const reader = res.body?.getReader();
    let html = '';
    if (reader) {
      let received = 0;
      const decoder = new TextDecoder();
      while (received < MAX_BODY_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        html += decoder.decode(value, { stream: true });
      }
      reader.cancel().catch(() => {});
    } else {
      html = await res.text();
    }

    const ogImage = extractMetaContent(html, 'og:image');
    const ogTitle = extractMetaContent(html, 'og:title') || extractTitleTag(html);
    const imageUrl = ogImage ? resolveUrl(ogImage, target.href) : null;

    return Response.json({ imageUrl, title: ogTitle, host });
  } catch {
    // Network failure, timeout, or anything else — never surface an error
    // to the client. The caller (fetchLinkPreview in src/data/polls.ts)
    // falls back to the colored-initials badge either way.
    return Response.json({ imageUrl: null, title: null, host });
  } finally {
    clearTimeout(timeout);
  }
}
