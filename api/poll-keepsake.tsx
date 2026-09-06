// Vercel Edge Function — renders a closed poll's single-winner result as a
// PNG via @vercel/og (Satori), for PollKeepsakeShare.tsx and the OG
// middleware (see middleware.ts's /p/:id branch). GET
// /api/poll-keepsake?id=<pollId>&size=1080|1200x630 (defaults to 1080).
//
// .tsx, not .ts, because @vercel/og's ImageResponse takes a JSX tree — the
// only file in api/ that needs the JSX transform. Not covered by
// tsconfig.app.json (only includes src) or tsconfig.node.json (only
// vite.config.ts) — same pre-existing gap as middleware.ts/
// poll-link-preview.ts. Type-check standalone from OUTSIDE the project
// directory (to dodge the tsconfig.json-present conflict error):
//   npx --yes -p typescript tsc --noEmit --target es2023 --lib ES2023,DOM \
//     --module esnext --moduleResolution bundler --skipLibCheck --jsx react-jsx \
//     api/poll-keepsake.tsx
//
// Edge Runtime constraints (see middleware.ts's own doc comment for the
// full rationale): raw fetch() to Supabase's PostgREST endpoint with the
// public anon key, no @supabase/supabase-js. Deliberately does NOT import
// tallyOptions/pickWinners from src/data/polls.ts, or the TrophyIcon/
// Wordmark/icon components from src/ — those modules assume a Vite/browser
// build context (that file imports the Supabase JS client at module scope,
// which isn't guaranteed edge-safe end to end) and aren't guaranteed to
// survive being bundled for the Edge Runtime by Vercel's separate function
// build step. The tally/winner logic and the three brand SVG paths are
// small enough to mirror locally instead — see the comments at each below
// for exactly which source file they're kept in sync with.
//
// Privacy: only ever selects option_id from alias_poll_votes_public here —
// never alias, message, avatar, or real_name (see fetchVotes below).

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

// Edge Runtime only actually exposes process.env (for the project's
// configured Environment Variables) — not the rest of Node's process API —
// so this declares just that rather than pulling in @types/node wholesale.
// Same declaration as middleware.ts.
declare const process: { env: Record<string, string | undefined> };

interface PollRow {
  id: string;
  title: string;
  status: string;
}
interface OptionRow {
  id: string;
  label: string;
}
interface VoteRow {
  option_id: string;
}

async function fetchPollRow(baseUrl: string, key: string, id: string): Promise<PollRow | null> {
  const res = await fetch(`${baseUrl}/rest/v1/alias_polls?id=eq.${encodeURIComponent(id)}&select=id,title,status`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as PollRow[];
  return rows[0] ?? null;
}

async function fetchOptions(baseUrl: string, key: string, pollId: string): Promise<OptionRow[]> {
  const res = await fetch(`${baseUrl}/rest/v1/alias_poll_options?poll_id=eq.${encodeURIComponent(pollId)}&select=id,label`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return [];
  return (await res.json()) as OptionRow[];
}

// option_id ONLY — alias_poll_votes_public is the same guest-safe view the
// rest of the app reads from; there is no select policy on the base
// alias_poll_votes table at all.
async function fetchVotes(baseUrl: string, key: string, pollId: string): Promise<VoteRow[]> {
  const res = await fetch(`${baseUrl}/rest/v1/alias_poll_votes_public?poll_id=eq.${encodeURIComponent(pollId)}&select=option_id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return [];
  return (await res.json()) as VoteRow[];
}

// Mirrors tallyOptions/pickWinners in src/data/polls.ts exactly (minus the
// pct field, unused here) — kept as a local copy rather than an import,
// see the file header comment for why.
interface OptionCount {
  option: OptionRow;
  count: number;
}
function tallyOptions(options: OptionRow[], votes: VoteRow[]): OptionCount[] {
  return options.map((option) => ({ option, count: votes.filter((v) => v.option_id === option.id).length }));
}
function pickWinners(counts: OptionCount[]): OptionCount[] {
  const max = Math.max(0, ...counts.map((c) => c.count));
  if (max === 0) return [];
  return counts.filter((c) => c.count === max);
}

// Same TrophyIcon path data as src/components/polls/PollWinnerHero.tsx —
// Figma names it ix:trophy-filled, rendered here at 80x80 (vs. that
// component's 72x71) per the Keepsake frame's own size.
function TrophyIcon() {
  return (
    <svg width={80} height={80} viewBox="0 0 72 71" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 6h32v4h9a3 3 0 0 1 3 3c0 10-7.5 17.2-15.6 18.6C47.3 37 41.3 40 39 40.5V50h9a3 3 0 0 1 3 3v5H21v-5a3 3 0 0 1 3-3h9v-9.5c-2.3-.5-8.3-3.5-9.4-8.9C15.5 30.2 8 23 8 13a3 3 0 0 1 3-3h9V6Zm0 8h-9c0 6.8 4.2 11.8 9.3 13.5A22.6 22.6 0 0 1 20 14Zm32 0a22.6 22.6 0 0 1-.3 13.5C56.8 25.8 61 20.8 61 14h-9Z"
        fill="#fff"
      />
    </svg>
  );
}

// Same path as public/icon.svg (the "Komon four-petal icon" favicon), just
// recolored — Figma's own Keepsake frame renders this icon in its normal
// dark ink color even on the pink card (confirmed via a direct zoom into
// the design file: only the wordmark below is inverted to white, not this
// icon), so this is #111111 rather than icon.svg's brand-pink #FF2D55 or
// the white variant at public/icons/board/komon-icon-white.svg.
function KomonIconDark() {
  return (
    <svg width={40} height={40} viewBox="0 0 231 229" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        fill="#111111"
        d="M 202 128 L 192 125 L 178 124 L 177 123 L 146 124 L 145 125 L 141 125 L 140 126 L 136 126 L 124 131 L 118 137 L 115 146 L 115 158 L 116 159 L 116 166 L 117 167 L 118 177 L 120 181 L 120 184 L 123 193 L 128 203 L 134 210 L 138 213 L 147 217 L 150 217 L 151 218 L 165 218 L 179 214 L 187 210 L 197 203 L 203 197 L 211 186 L 216 176 L 219 166 L 220 153 L 219 152 L 219 147 L 215 138 L 208 131 Z M 17 127 L 14 130 L 10 139 L 10 157 L 15 174 L 21 185 L 27 193 L 33 199 L 45 208 L 63 216 L 72 217 L 73 218 L 88 218 L 97 215 L 104 207 L 105 204 L 105 191 L 101 177 L 94 163 L 85 151 L 72 139 L 63 133 L 50 127 L 40 124 L 35 124 L 34 123 L 23 124 Z M 137 16 L 127 27 L 123 36 L 118 52 L 118 56 L 116 62 L 116 69 L 115 70 L 115 84 L 117 91 L 123 98 L 131 102 L 138 104 L 142 104 L 143 105 L 149 105 L 150 106 L 183 106 L 184 105 L 194 104 L 203 101 L 208 98 L 215 91 L 218 85 L 219 77 L 220 76 L 220 70 L 219 69 L 219 62 L 218 61 L 217 54 L 212 43 L 206 34 L 195 23 L 189 19 L 173 12 L 163 11 L 162 10 L 153 10 L 152 11 L 148 11 L 142 13 Z M 99 15 L 94 12 L 87 11 L 86 10 L 76 10 L 75 11 L 64 12 L 55 15 L 45 20 L 34 28 L 27 35 L 16 52 L 10 72 L 10 89 L 13 97 L 17 102 L 22 105 L 25 105 L 26 106 L 37 106 L 38 105 L 42 105 L 52 102 L 70 92 L 86 77 L 95 64 L 104 42 L 104 38 L 105 37 L 105 25 L 103 20 Z"
      />
    </svg>
  );
}

// Same path as src/components/Wordmark.tsx, just recolored — that
// component hardcodes a fixed dark fill (by design, per its own comment),
// so it's inlined here with fill swapped to white instead of importing it.
function KomonWordmarkWhite() {
  return (
    <svg width={141} height={26} viewBox="0 0 764 144" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#FFFFFF"
        fillRule="evenodd"
        d="M 642 51 L 637 60 L 634 70 L 634 75 L 633 76 L 633 129 L 635 131 L 659 131 L 661 129 L 661 74 L 662 73 L 662 70 L 664 65 L 670 58 L 677 54 L 685 53 L 686 52 L 701 52 L 702 53 L 709 54 L 713 56 L 721 64 L 724 72 L 724 80 L 725 81 L 725 110 L 724 111 L 724 114 L 725 115 L 725 130 L 726 131 L 751 131 L 753 128 L 752 125 L 753 124 L 752 122 L 752 119 L 753 118 L 753 85 L 752 84 L 752 71 L 751 70 L 751 66 L 746 54 L 735 42 L 726 37 L 712 33 L 707 33 L 706 32 L 682 32 L 681 33 L 675 33 L 661 37 L 653 41 Z M 507 50 L 500 60 L 500 62 L 497 68 L 496 78 L 495 79 L 495 87 L 496 88 L 497 97 L 502 109 L 511 119 L 518 124 L 535 131 L 545 132 L 546 133 L 570 133 L 571 132 L 577 132 L 578 131 L 588 129 L 600 123 L 608 117 L 616 107 L 622 89 L 621 72 L 619 65 L 613 54 L 600 42 L 590 37 L 576 33 L 571 33 L 570 32 L 547 32 L 546 33 L 540 33 L 539 34 L 532 35 L 526 38 L 524 38 L 514 44 Z M 534 59 L 543 54 L 550 52 L 567 52 L 574 54 L 583 59 L 591 69 L 593 75 L 593 80 L 594 81 L 593 91 L 588 101 L 579 109 L 572 112 L 563 113 L 562 114 L 548 113 L 536 108 L 528 100 L 524 90 L 524 75 L 527 67 Z M 267 68 L 267 73 L 266 74 L 266 130 L 267 131 L 292 131 L 293 130 L 293 80 L 294 79 L 295 70 L 298 64 L 305 57 L 318 52 L 334 52 L 335 53 L 338 53 L 344 55 L 350 59 L 355 64 L 359 71 L 361 77 L 361 82 L 362 83 L 362 130 L 363 131 L 388 131 L 390 128 L 390 114 L 389 113 L 389 105 L 390 104 L 389 98 L 390 97 L 390 94 L 389 93 L 389 85 L 390 84 L 390 78 L 393 69 L 403 58 L 410 54 L 417 53 L 418 52 L 434 52 L 435 53 L 438 53 L 446 57 L 452 63 L 456 72 L 456 77 L 457 78 L 457 130 L 459 131 L 483 131 L 484 130 L 484 125 L 485 124 L 485 116 L 484 115 L 484 110 L 485 109 L 484 73 L 480 59 L 474 49 L 470 45 L 463 40 L 452 35 L 449 35 L 444 33 L 439 33 L 438 32 L 416 32 L 415 33 L 410 33 L 393 39 L 382 47 L 379 51 L 376 53 L 370 46 L 362 40 L 347 34 L 338 33 L 337 32 L 315 32 L 314 33 L 309 33 L 292 38 L 281 45 L 272 56 Z M 138 52 L 131 64 L 129 71 L 129 75 L 128 76 L 129 96 L 134 108 L 139 115 L 147 122 L 154 126 L 156 126 L 164 130 L 167 130 L 172 132 L 177 132 L 178 133 L 204 133 L 205 132 L 215 131 L 226 127 L 235 122 L 244 114 L 251 103 L 254 93 L 254 88 L 255 87 L 254 72 L 252 65 L 247 55 L 243 50 L 236 44 L 226 38 L 224 38 L 218 35 L 215 35 L 210 33 L 204 33 L 203 32 L 180 32 L 179 33 L 173 33 L 172 34 L 162 36 L 151 41 L 145 45 Z M 168 58 L 173 55 L 183 52 L 200 52 L 207 54 L 216 59 L 222 66 L 226 75 L 226 90 L 225 91 L 225 94 L 221 101 L 212 109 L 205 112 L 196 113 L 195 114 L 181 113 L 169 108 L 159 97 L 157 91 L 157 86 L 156 85 L 156 80 L 157 79 L 158 71 L 162 64 Z M 10 12 L 10 130 L 11 131 L 37 131 L 39 128 L 39 82 L 41 80 L 43 80 L 95 129 L 100 131 L 135 131 L 135 128 L 124 119 L 70 69 L 70 66 L 75 61 L 132 12 L 131 10 L 96 10 L 93 11 L 42 58 L 39 57 L 39 13 L 38 11 L 36 10 L 12 10 Z"
      />
    </svg>
  );
}

// >20 chars steps the name down to 48px so a long option label doesn't run
// past the card edge; >40 chars (roughly 2 lines' worth at that reduced
// size within the card's text column) truncates with a trailing ellipsis
// on top of that, capping it at 2 lines total rather than letting it grow
// unbounded even after the font-size step.
function formatWinnerName(label: string): { text: string; fontSize: number; lineHeight: string; letterSpacing: string } {
  if (label.length <= 20) return { text: label, fontSize: 64, lineHeight: '70px', letterSpacing: '-0.32px' };
  const text = label.length > 40 ? `${label.slice(0, 39)}…` : label;
  return { text, fontSize: 48, lineHeight: '56px', letterSpacing: '-0.24px' };
}

// Satori has no CSS text-overflow, so this truncates the string itself
// before it's ever handed to the layout.
function truncateQuestion(question: string): string {
  return question.length > 70 ? `${question.slice(0, 67)}…` : question;
}

export default async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const size: '1080' | '1200x630' = searchParams.get('size') === '1200x630' ? '1200x630' : '1080';
  if (!id) return new Response('Missing id', { status: 400 });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('poll-keepsake: missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY');
    return new Response('Server misconfigured', { status: 500 });
  }

  // Only ever a closed poll's result — an open poll's outcome can still
  // change, so there is nothing stable to render.
  const poll = await fetchPollRow(supabaseUrl, supabaseKey, id);
  if (!poll || poll.status !== 'closed') {
    return new Response('Not found', { status: 404 });
  }

  const [options, votes] = await Promise.all([fetchOptions(supabaseUrl, supabaseKey, id), fetchVotes(supabaseUrl, supabaseKey, id)]);
  const counts = tallyOptions(options, votes);
  const winners = pickWinners(counts);
  const isZero = winners.length === 0;
  const isTie = winners.length > 1;
  const singleWinner = winners.length === 1 ? winners[0] : null;

  const totalVotes = votes.length;
  const winnerVotes = singleWinner?.count ?? 0;
  const pct = totalVotes ? Math.round((winnerVotes / totalVotes) * 100) : 0;

  // Figma's own 548px text column (node 1204:2158) is ~55% of the 1080
  // card's 1000px interior (1048 card width minus its own 24px*2 padding)
  // — a deliberate narrower-than-full measure for line length, not a fill-
  // width choice. 1200x630's frame wasn't built with a comparably long
  // string to read a hard number off, so 600px applies that same ~55%
  // ratio to that size's own 1120px interior instead of guessing a round
  // number blind.
  const contentWidth = size === '1080' ? 548 : 600;

  const nameLine = isZero
    ? { text: 'No votes yet', fontSize: 64, lineHeight: '70px', letterSpacing: '-0.32px' }
    : isTie
      ? { text: "It's a tie!", fontSize: 64, lineHeight: '70px', letterSpacing: '-0.32px' }
      : formatWinnerName(singleWinner!.option.label);

  // 1200x630 never shows this block at all (Figma's own frame for that
  // size has no equivalent nodes); zero votes has nothing meaningful to
  // report either way. A tie keeps the question line but drops the vote-
  // count line, since there's no single winner's share to state.
  const showVoteQuestionBlock = size === '1080' && !isZero;

  const [plusJakartaMedium, dmMonoRegular] = await Promise.all([
    fetch(new URL('./fonts/PlusJakartaSans-Medium.ttf', import.meta.url)).then((res) => res.arrayBuffer()),
    fetch(new URL('./fonts/DMMono-Regular.ttf', import.meta.url)).then((res) => res.arrayBuffer()),
  ]);

  const width = size === '1080' ? 1080 : 1200;
  const height = size === '1080' ? 1080 : 630;

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: 'flex',
          padding: 16,
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: 24,
          borderRadius: 12,
          border: '1px solid #F0F0F0',
          background: '#FFFFFF',
        }}
      >
        <div
          style={{
            display: 'flex',
            padding: '40px 24px',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'center',
            flex: '1 0 0',
            width: '100%',
            borderRadius: 8,
            background: '#FF2D55',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, flex: '1 0 0', width: '100%' }}>
            <TrophyIcon />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: contentWidth }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
                <div
                  style={{
                    display: 'flex',
                    width: '100%',
                    justifyContent: 'center',
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: 500,
                    fontSize: 32,
                    lineHeight: '40px',
                    letterSpacing: '-0.16px',
                    color: '#111111',
                    textAlign: 'center',
                  }}
                >
                  Most Voted
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    width: '100%',
                    justifyContent: 'center',
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: 500,
                    color: '#FFFFFF',
                    textAlign: 'center',
                    fontSize: nameLine.fontSize,
                    lineHeight: nameLine.lineHeight,
                    letterSpacing: nameLine.letterSpacing,
                  }}
                >
                  {nameLine.text}
                </div>
              </div>
              {showVoteQuestionBlock && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '8px 0',
                    width: '100%',
                    fontFamily: 'DM Mono',
                    fontWeight: 400,
                    fontSize: 20,
                    lineHeight: '28px',
                    letterSpacing: '-0.1px',
                    color: '#FFFFFF',
                    textAlign: 'center',
                  }}
                >
                  {!isTie && <div style={{ display: 'flex', width: '100%', justifyContent: 'center' }}>{`Voted by ${winnerVotes}/${totalVotes} (${pct}%)`}</div>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', width: '100%', justifyContent: 'center' }}>{`Q: ${truncateQuestion(poll.title)}`}</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 189, height: 40 }}>
            <KomonIconDark />
            <KomonWordmarkWhite />
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      fonts: [
        { name: 'Plus Jakarta Sans', data: plusJakartaMedium, weight: 500, style: 'normal' },
        { name: 'DM Mono', data: dmMonoRegular, weight: 400, style: 'normal' },
      ],
      headers: {
        // A closed poll's result never changes — see middleware.ts's own
        // /p/:id og:image caching for the same reasoning.
        'cache-control': 'public, max-age=31536000, immutable',
      },
    }
  );
}
