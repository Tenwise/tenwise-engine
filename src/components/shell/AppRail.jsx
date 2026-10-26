import {
  HiOutlineArrowPath, HiOutlineCog6Tooth, HiOutlineMoon, HiOutlinePlus, HiOutlineSun, HiOutlineViewColumns,
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { pluginsOf } from '../../plugins/index.js';
import { isActive, NAV_ITEMS } from '../sidebar/sidebarModel.js';

// Controls plugins add at the foot of the rail, below Settings (src/plugins/index.js).
const RAIL_ACTIONS = pluginsOf('railActions');

// A rail button: icon only, label as tooltip; an accent dot when `dot`.
function RailButton({ label, active, dot, onClick, disabled, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative flex size-9 cursor-pointer items-center justify-center rounded-lg border-0 transition-colors disabled:cursor-default [&_svg]:size-[18px]',
        active ? 'bg-[var(--rail-active)] text-primary' : 'bg-transparent text-[var(--rail-icon)] hover:bg-[var(--rail-active)] hover:text-[var(--rail-icon-hover)]',
      )}
    >
      {children}
      {dot && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />}
    </button>
  );
}

// The views that show a dot when they have something new.
const DOT_FOR = { all: (c) => c.total > 0, today: (c) => c.today > 0 };

/**
 * The far-left rail: the main views as icons, and the app-wide actions
 * (add feed, refresh, theme, settings, show/hide the sidebar), then plugins'
 * rail actions. Always dark.
 */
export default function AppRail({ activeView, onViewChange, counts, actions }) {
  return (
    <nav aria-label="Main" className="flex h-screen w-[52px] shrink-0 flex-col items-center justify-between border-r border-[var(--rail-border)] bg-[var(--rail-bg)] pb-3">
      <div className="flex flex-col items-center gap-1.5">
        <button type="button" onClick={actions.onToggleSidebar} title="Show or hide the sidebar ([)" aria-label="Show or hide the sidebar" className="mb-2 flex h-[var(--pane-header-height)] cursor-pointer items-center border-0 bg-transparent p-0">
          <img src="/tenwise-icon.svg" alt="" className="size-8 rounded-lg" />
        </button>
        {NAV_ITEMS.map(({ type, label, iconTitle, Icon }) => (
          <RailButton key={type} label={iconTitle || label} active={isActive(activeView, type)} dot={DOT_FOR[type]?.(counts)} onClick={() => onViewChange({ type })}>
            <Icon />
          </RailButton>
        ))}
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <RailButton label="Add feed" onClick={actions.onAddFeed}><HiOutlinePlus /></RailButton>
        <RailButton label={actions.refreshing ? 'Refreshing…' : 'Refresh all feeds'} onClick={actions.onRefreshAll} disabled={actions.refreshing}>
          <HiOutlineArrowPath className={cn(actions.refreshing && 'animate-spin')} />
        </RailButton>
        <RailButton label={actions.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={actions.onToggleTheme}>
          {actions.theme === 'dark' ? <HiOutlineSun /> : <HiOutlineMoon />}
        </RailButton>
        <RailButton label="Show or hide the sidebar ([)" active={actions.sidebarOpen} onClick={actions.onToggleSidebar}><HiOutlineViewColumns /></RailButton>
        <RailButton label="Settings" onClick={actions.onSettings}><HiOutlineCog6Tooth /></RailButton>
        {RAIL_ACTIONS.map(({ id, Control }) => <Control key={id} />)}
      </div>
    </nav>
  );
}
