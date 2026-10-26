import { useState } from 'react';
import { HiOutlineChevronDoubleLeft, HiOutlineFolderPlus, HiOutlineMagnifyingGlass, HiOutlinePlus } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { emit } from '../../lib/appEvents.js';
import Logotype from '../shell/Logotype.jsx';
import { CollectionList } from './CollectionList.jsx';
import { ContextMenu } from './ContextMenu.jsx';
import { FolderTree } from './FolderTree.jsx';
import { InlineInput, NavRow } from './NavRow.jsx';
import { isActive, NAV_ITEMS } from './sidebarModel.js';

function NewFolderInput({ onAdd, onCancel }) {
  const [name, setName] = useState('');
  const submit = () => { if (name.trim()) onAdd(name.trim()); };
  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      <InlineInput
        placeholder="Folder name"
        aria-label="New folder name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the field opens from the New folder button, so focus belongs in it
        autoFocus
      />
      <Button size="sm" onClick={submit}>Add</Button>
    </div>
  );
}

function MainNav({ activeView, onViewChange, counts }) {
  return (
    <div className="flex flex-col gap-px">
      {NAV_ITEMS.map(({ type, label, Icon, count }) => (
        <NavRow key={type} active={isActive(activeView, type)} onClick={() => onViewChange({ type })} icon={<Icon />} label={label} count={count(counts)} />
      ))}
    </div>
  );
}

// Wordmark and the hide button; theme, settings and refresh live in the app rail.
function SidebarHeader({ actions }) {
  return (
    <div className="flex h-[var(--pane-header-height)] shrink-0 items-center justify-between border-b border-border pr-2 pl-4">
      <h1 className="m-0 flex items-center text-[var(--brand-ink)]"><Logotype className="h-[17px] w-auto" /></h1>
      <IconButton onClick={actions.onToggleMode} title="Hide sidebar ([)"><HiOutlineChevronDoubleLeft /></IconButton>
    </div>
  );
}

// The ⌘K bar (opens the palette) and the Add feed button.
function CommandBar({ onAddFeed }) {
  return (
    <div className="flex shrink-0 items-center gap-1 px-2 pt-2.5 pb-1.5">
      <button
        type="button"
        onClick={() => emit('open-palette')}
        title="Search, jump to a feed, run a command (⌘K)"
        className="flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border border-border bg-[var(--bg-primary)] pr-2 pl-2.5 text-[12.5px] text-[var(--text-tertiary)] transition-colors hover:border-[var(--border-light)] hover:text-muted-foreground"
      >
        <HiOutlineMagnifyingGlass className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">Search or jump to…</span>
        <kbd className="rounded border border-[var(--border-light)] px-1.5 font-mono text-[11px]">⌘K</kbd>
      </button>
      <IconButton onClick={onAddFeed} title="Add feed" className="size-8"><HiOutlinePlus /></IconButton>
    </div>
  );
}

// Folder UI state: open folders, inline rename, context menu.
function useFolderTreeState(actions) {
  const [openFolders, setOpenFolders] = useState(() => new Set());
  const [renamingId, setRenamingId] = useState(null);
  const [menu, setMenu] = useState(null);
  return {
    openFolders, renamingId, menu,
    openMenu: setMenu,
    closeMenu: () => setMenu(null),
    toggleFolder: (id) => setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    }),
    startRename: setRenamingId,
    cancelRename: () => setRenamingId(null),
    finishRename: (id, name) => { actions.onRenameFolder(id, name); setRenamingId(null); },
  };
}

/** Full sidebar: header, the ⌘K bar and Add Feed, navigation, collections, folders and feeds. */
export function ExpandedSidebar({ style, activeView, onViewChange, counts, folders, feeds, grouped, actions }) {
  const [addingFolder, setAddingFolder] = useState(false);
  const tree = { ...useFolderTreeState(actions), activeView, onViewChange };
  const addFolder = (name) => { actions.onAddFolder(name); setAddingFolder(false); };

  return (
    <aside aria-label="Feeds" className="sidebar-panel flex h-screen shrink-0 flex-col overflow-hidden bg-[var(--bg-secondary)]" style={style}>
      <SidebarHeader actions={actions} />
      <CommandBar onAddFeed={actions.onAddFeed} />
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pt-1.5 pb-4">
        <MainNav activeView={activeView} onViewChange={onViewChange} counts={counts} />
        <CollectionList activeView={activeView} onViewChange={onViewChange} unsorted={counts.unsorted} />
        <div className="mt-4">
          <div className="flex items-center justify-between px-2.5 pb-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Folders</span>
            <IconButton onClick={() => setAddingFolder(true)} title="New folder" className="size-6"><HiOutlineFolderPlus /></IconButton>
          </div>
          {addingFolder && <NewFolderInput onAdd={addFolder} onCancel={() => setAddingFolder(false)} />}
          <FolderTree folders={folders} grouped={grouped} counts={counts} tree={tree} />
        </div>
      </nav>
      <ContextMenu
        menu={tree.menu}
        feeds={feeds}
        folders={folders}
        actions={{ ...actions, startRename: tree.startRename }}
        onClose={tree.closeMenu}
      />
    </aside>
  );
}
