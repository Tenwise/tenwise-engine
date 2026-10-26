const READING = [
  ['⌘K', 'commands'],
  ['j/k', 'next'],
  ['o', 'original'],
  ['b', 'save'],
  ['f', 'focus'],
  ['/', 'search'],
];

// In lists of saves: filing them.
const FILING = [
  ['j/k', 'next'],
  ['c', 'collect'],
  ['n', 'note'],
  ['b', 'unsave'],
  ['/', 'search'],
];

/** Footer of the list: the main shortcuts (for filing, in lists of saves), always in view. */
export default function ListKeyHints({ filing = false }) {
  const HINTS = filing ? FILING : READING;
  return (
    <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 border-t border-border bg-[var(--bg-secondary)] px-4 py-2 font-mono text-[11.5px] text-[var(--text-tertiary)]" aria-label="Keyboard shortcuts">
      {HINTS.map(([key, action]) => (
        <span key={key}>
          <kbd className="font-mono text-foreground">{key}</kbd> {action}
        </span>
      ))}
    </div>
  );
}
