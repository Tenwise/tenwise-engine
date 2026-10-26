import { HiOutlineSparkles, HiOutlineXMark } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { pluginsOf } from '../../plugins/index.js';
import { PILL, pillState } from './pills.js';

// Pills plugins add after "AI-analyzed only" (src/plugins/index.js), such as
// the analysis dimensions.
const PLUGIN_PILLS = pluginsOf('filterPills');

/**
 * The filter row, shown on demand: "AI-analyzed only", then plugins' pills.
 * `available` holds the values articles have per filter key (from the
 * server's facets); `active` the value picked per key.
 */
export function FilterBar({ available, active, onChange, aiOnly, onToggleAiOnly }) {
  const hasActive = Object.values(active).some(Boolean) || aiOnly;
  const clear = () => { onChange({}); if (aiOnly) onToggleAiOnly(); };
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
      <button type="button" aria-pressed={aiOnly} onClick={onToggleAiOnly} title="Show only articles with an AI summary or analysis" className={cn(PILL, pillState(aiOnly))}>
        <HiOutlineSparkles /> AI-analyzed only
      </button>
      {PLUGIN_PILLS.map(({ id, Pills }) => <Pills key={id} available={available} active={active} onChange={onChange} />)}
      {hasActive && (
        <button type="button" onClick={clear} className="ml-auto inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[11.5px] text-muted-foreground hover:text-foreground">
          <HiOutlineXMark className="size-3" /> Clear
        </button>
      )}
    </div>
  );
}
