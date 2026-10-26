/** A day group heading in the Rows view: TODAY, YESTERDAY… */
export default function DayHeading({ label }) {
  return (
    <div role="heading" aria-level={3} className="list-day-heading px-4 pb-1 pt-3 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
      {label}
    </div>
  );
}
