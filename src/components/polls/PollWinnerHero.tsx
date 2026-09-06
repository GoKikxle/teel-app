import { pickWinners, tallyOptions } from '../../data/polls';
import type { AliasPollOption } from '../../lib/database.types';
import { PollOptionBadge } from './PollOptionBadge';

// Figma names the wrap-up trophy ix:trophy-filled (72x71, white) — no
// equivalent icon exists under public/icons/ (checked), and this codebase
// hand-authors inline SVGs rather than sourcing/committing new binary
// assets for one-off icons (see PollCreate.tsx's LinkIcon, InfoTooltip's
// InfoIcon), so this follows that same convention instead.
function TrophyIcon() {
  return (
    <svg width="72" height="71" viewBox="0 0 72 71" fill="none" xmlns="http://www.w3.org/2000/svg" className="poll-winner-hero-trophy" aria-hidden="true">
      <path
        d="M20 6h32v4h9a3 3 0 0 1 3 3c0 10-7.5 17.2-15.6 18.6C47.3 37 41.3 40 39 40.5V50h9a3 3 0 0 1 3 3v5H21v-5a3 3 0 0 1 3-3h9v-9.5c-2.3-.5-8.3-3.5-9.4-8.9C15.5 30.2 8 23 8 13a3 3 0 0 1 3-3h9V6Zm0 8h-9c0 6.8 4.2 11.8 9.3 13.5A22.6 22.6 0 0 1 20 14Zm32 0a22.6 22.6 0 0 1-.3 13.5C56.8 25.8 61 20.8 61 14h-9Z"
        fill="#fff"
      />
    </svg>
  );
}

// Extracted out of PollOrganize.tsx's PollWrapUp so PollVote.tsx's guest
// closed-view (Section C) can render the exact same card — same
// zero/one/tie branches, single-winner state unchanged, tie state per
// Figma's updated tie frame (node 1197:1531, see .poll-winner-hero.tie in
// index.css). votes is typed structurally (matching PollTally's own
// { option_id }[] convention) rather than AliasPollVote, since the guest
// call site only ever has AliasPollVotePublic (no real_name) to pass.
export function PollWinnerHero({
  options,
  votes,
}: {
  options: AliasPollOption[];
  votes: { option_id: string }[];
}) {
  const counts = tallyOptions(options, votes);
  const winners = pickWinners(counts);

  return (
    <div className={`poll-winner-hero${winners.length > 1 ? ' tie' : ''}`}>
      {winners.length === 0 ? (
        // No Figma mock exists for the zero-vote wrap-up — same card
        // shell with placeholder copy in place of a winner, so the
        // layout doesn't jump structurally between the voted and
        // unvoted cases.
        <>
          <TrophyIcon />
          <div className="poll-winner-hero-text">
            <div className="poll-winner-hero-label">Most Voted</div>
            <div className="poll-winner-hero-name">No votes yet</div>
          </div>
        </>
      ) : winners.length === 1 ? (
        <>
          <TrophyIcon />
          <div className="poll-winner-hero-row">
            <PollOptionBadge option={winners[0].option} className="poll-winner-hero-thumb" />
            <div className="poll-winner-hero-text">
              <div className="poll-winner-hero-label">Most Voted</div>
              <div className="poll-winner-hero-name">{winners[0].option.label}</div>
            </div>
          </div>
        </>
      ) : (
        // Tie — Figma's updated tie frame (node 1197:1531): one "IT'S A TIE!"
        // badge instead of per-row "Tie N" labels, smaller 68px thumbs + 32px
        // names, left-aligned, flat 24px padding (see the .poll-winner-hero.tie
        // modifier below).
        <>
          <div className="poll-winner-hero-tie-badge">IT'S A TIE!</div>
          {winners.map((w) => (
            <div className="poll-winner-hero-row" key={w.option.id}>
              <PollOptionBadge option={w.option} className="poll-winner-hero-thumb poll-winner-hero-tie-thumb" />
              <div className="poll-winner-hero-text">
                <div className="poll-winner-hero-name poll-winner-hero-tie-name">{w.option.label}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
