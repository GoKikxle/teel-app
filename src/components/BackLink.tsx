// The single back-navigation pattern for the whole app — small chevron +
// uppercase eyebrow label (originally built for Create.tsx/SplitBillCreate.tsx,
// now standardized everywhere a "go back" affordance is needed instead of
// each page rolling its own "← Back to X" .btn-outline button).
export function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="create-eyebrow-row">
      <button type="button" className="create-back-btn" onClick={onClick} aria-label="Back">
        <img src="/icons/board/chevron-back-gray.svg" alt="" width={24} height={24} />
      </button>
      <p className="eyebrow">{label}</p>
    </div>
  );
}
