import { useState } from 'react';
import { HiOutlineFunnel, HiOutlinePlus } from 'react-icons/hi2';
import { IconButton } from '@/components/ui/icon-button';
import { FilterDialog } from '../filters/FilterDialog.jsx';
import { useRuleFilters } from '../filters/useRuleFilters.js';
import { NavRow } from './NavRow.jsx';
import { isActive } from './sidebarModel.js';

const openView = (filter) => ({ type: 'filter', id: filter.id, name: filter.name });

/**
 * The sidebar's Filters (PR-13): one row per saved rule filter (opens its
 * articles), its menu edits or deletes it, and + makes one.
 */
export function FilterList({ activeView, onViewChange }) {
  const filters = useRuleFilters();
  const [editing, setEditing] = useState(null); // null, 'new', or a filter
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between px-2.5 pb-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Filters</span>
        <IconButton onClick={() => setEditing('new')} title="New filter" className="size-6"><HiOutlinePlus /></IconButton>
      </div>
      {filters.map((f) => (
        <NavRow
          key={f.id}
          active={isActive(activeView, 'filter', f.id)}
          onClick={() => onViewChange(openView(f))}
          onMenu={() => setEditing(f)}
          menuTitle="Edit filter"
          icon={<HiOutlineFunnel />}
          label={f.name}
        />
      ))}
      {filters.length === 0 && <p className="m-0 px-2.5 py-1 text-[12px] leading-snug text-[var(--text-tertiary)]">Words and phrases with AND, OR, NOT: press +.</p>}
      {editing && (
        <FilterDialog
          filter={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(f) => { setEditing(null); onViewChange(openView(f)); }}
          onRemoved={(id) => { setEditing(null); if (isActive(activeView, 'filter', id)) onViewChange({ type: 'all' }); }}
        />
      )}
    </div>
  );
}
