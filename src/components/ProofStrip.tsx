import { useEffect, useState } from 'react';

// Short, real-sounding lines meant to make the product feel already-in-use.
// Cycles on a plain setInterval + a React `key` remount to retrigger the
// existing riseIn keyframe — no animation library needed.
const LINES = [
  'Split £45 for game night',
  '3 of 4 paid',
  'RSVP confirmed — Manchester Hike',
  'Poll closed: North ridge wins',
];

export function ProofStrip() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % LINES.length), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="proof-strip">
      <span className="proof-dot" />
      <span key={index} className="proof-line">
        {LINES[index]}
      </span>
    </div>
  );
}
