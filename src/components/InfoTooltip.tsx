import { Tooltip } from '@base-ui/react/tooltip';

// Small reusable info-icon tooltip — used by PollOrganize.tsx's organizer
// controls (round 4: moved the "Reveal real names"/"Show results to
// guests" explanations out of a subtitle line and into these instead).
// Base UI's Tooltip (Root/Trigger/Portal/Positioner/Popup) is already the
// app's toolkit for this kind of floating-element pattern — Nav.tsx and
// PollOrganize/PollCreate's own Switch use the same family of primitives —
// so this reuses it rather than hand-rolling a hover popup. Base UI's
// Tooltip has touch handling built in (tap opens it, tap elsewhere closes
// it), no extra config needed for that.
export function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger className="info-tooltip-trigger" aria-label={text}>
        <InfoIcon />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={8}>
          <Tooltip.Popup className="info-tooltip-popup">{text}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// Plain inline circle-i SVG, matching PollCreate.tsx's own hand-authored
// LinkIcon() in style (stroke-based, currentColor) rather than pulling in
// an icon library or using a text glyph — no info-icon asset exists under
// public/icons/board/ for this yet.
function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <circle cx="12" cy="7.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}
