import {
  HiOutlineCheckCircle, HiOutlineFunnel, HiOutlineMagnifyingGlass, HiOutlineXMark,
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/icon-button';
import { VIEW_MODES } from './viewModes.js';
import { pluginsOf } from '../../plugins/index.js';

// Controls plugins add beside the filter button (src/plugins/index.js), such as the AI queue.
const HEADER_CONTROLS = pluginsOf('listHeaderControls');

// The mode after `id`, wrapping around.
const nextMode = (id) => VIEW_MODES[(VIEW_MODES.findIndex((m) => m.id === id) + 1) % VIEW_MODES.length].id;

// One button per view mode. Clicking the active one moves to the next mode,
// which is how a narrow list (showing only the active button) switches views.
function ViewModeToggle({ viewMode, onChange }) {
  return (
    <div className="flex rounded-md bg-[var(--bg-tertiary)] p-0.5">
      {VIEW_MODES.map(({ id, title, Icon }) => (
        <IconButton
          key={id}
          active={viewMode === id}
          className={cn('size-6', viewMode === id ? 'text-primary' : '@max-[520px]:hidden')}
          onClick={() => onChange(viewMode === id ? nextMode(id) : id)}
          title={viewMode === id ? `${title} (click for the next view)` : title}
        >
          <Icon />
        </IconButton>
      ))}
    </div>
  );
}

function MarkAllReadButton({ unreadCount, confirm }) {
  if (unreadCount === 0) return null;
  if (confirm.armed) {
    return (
      <button type="button" onClick={confirm.trigger} title="Click again to confirm" className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border-0 bg-destructive px-2 text-xs text-destructive-foreground">
        <HiOutlineCheckCircle className="size-3.5" /> Mark {unreadCount.toLocaleString()} read?
      </button>
    );
  }
  return <IconButton onClick={confirm.trigger} title="Mark all as read"><HiOutlineCheckCircle /></IconButton>;
}

// Shows or hides the filter row; the count says how many filters are on.
function FilterButton({ filters }) {
  const label = filters.activeCount > 0 ? `Filters (${filters.activeCount} on)` : 'Filters';
  return (
    <IconButton active={filters.open} onClick={filters.toggle} title={label} aria-expanded={filters.open} className="relative">
      <HiOutlineFunnel />
      {filters.activeCount > 0 && <span className="absolute -top-0.5 -right-0.5 font-mono text-[9.5px] text-primary">{filters.activeCount}</span>}
    </IconButton>
  );
}

/** Title row: view title and count, view modes, filters, plugins' controls, search, mark all read. */
export function ListHeader({ title, count, viewMode, onViewModeChange, filters, search, unreadCount, markAllRead }) {
  return (
    <div className="@container shrink-0 border-b border-border">
      <div className="flex h-[var(--pane-header-height)] items-center gap-2 pr-2 pl-4">
        <h2 className="m-0 min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">
          {title}
          <span className="ml-1.5 font-mono text-[11px] font-normal text-[var(--text-tertiary)] @max-[480px]:hidden">{count.toLocaleString()}</span>
        </h2>
        <ViewModeToggle viewMode={viewMode} onChange={onViewModeChange} />
        <FilterButton filters={filters} />
        {HEADER_CONTROLS.map(({ id, Control }) => <Control key={id} />)}
        <IconButton active={search.visible} onClick={search.toggle} title="Search articles (/)"><HiOutlineMagnifyingGlass /></IconButton>
        <MarkAllReadButton unreadCount={unreadCount} confirm={markAllRead} />
      </div>
    </div>
  );
}

/** Search field under the header, while search is open. */
export function SearchBar({ search, inputRef }) {
  if (!search.visible) return null;
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
      <HiOutlineMagnifyingGlass className="size-4 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        placeholder="Search titles, sources and full text"
        aria-label="Search articles"
        value={search.query}
        onChange={(e) => search.setQuery(e.target.value)}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- search opens on "/" or its button, so focus belongs in it
        autoFocus
        className="h-7 min-w-0 flex-1 border-0 bg-transparent font-sans text-[13.5px] text-foreground shadow-none outline-none placeholder:text-[var(--text-tertiary)]"
      />
      {search.query && <IconButton onClick={() => search.setQuery('')} title="Clear search"><HiOutlineXMark /></IconButton>}
    </div>
  );
}
