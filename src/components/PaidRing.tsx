export function PaidRing({ pct, size }: { pct: number; size?: number }) {
  return (
    <div
      className="paid-ring"
      style={{ '--pct': pct, ...(size ? { width: size, height: size } : {}) } as React.CSSProperties}
    >
      <span>{pct}%</span>
    </div>
  );
}
