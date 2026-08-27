-- Adds name capture to the waitlist form (see src/pages/Landing.tsx's new
-- signup modal, pulled from the "Komon waitlist form" Figma frame, which
-- asks for First Name / Last Name alongside email). Nullable, not backfilled
-- — existing rows were captured by the old email-only form and have no name
-- to fill in.
alter table waitlist add column first_name text;
alter table waitlist add column last_name text;
