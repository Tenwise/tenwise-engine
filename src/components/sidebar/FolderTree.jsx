import { useState } from 'react';
import { HiChevronRight, HiOutlineFolderOpen } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import FeedFavicon from '../FeedFavicon.jsx';
import { InlineInput, NavRow } from './NavRow.jsx';
import { folderUnread, isActive, menuOpener } from './sidebarModel.js';


// Tooltip for a feed whose last refresh failed, or undefined.
const refreshAlert = (feed) => (feed.lastError ? `Last refresh failed: ${feed.lastError}` : undefined);

const feedIcon = (feed) => <FeedFavicon src={feed.favicon} imgClass="size-4 rounded-sm object-contain" iconClass="flex size-4 [&_svg]:size-4" />;

function FeedRow({ feed, unread, active, onViewChange, openMenu, nested }) {
  return (
    <NavRow
      active={active}
      onClick={() => onViewChange({ type: 'feed', id: feed.id, name: feed.title })}
      onMenu={menuOpener(openMenu, 'feed', feed.id)}
      menuTitle="Feed options"
      icon={feedIcon(feed)}
      label={feed.title}
      count={unread}
      alert={refreshAlert(feed)}
      className={cn(nested && 'pl-9 text-[12.5px]')}
    />
  );
}

export function RenameInput({ initial, label = 'Folder name', onSubmit, onCancel }) {
  const [value, setValue] = useState(initial);
  const submit = () => { if (value.trim()) onSubmit(value.trim()); };
  return (
    <InlineInput
      value={value}
      aria-label={label}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
      onClick={(e) => e.stopPropagation()}
      // eslint-disable-next-line jsx-a11y/no-autofocus -- the field opens from Rename or New collection, so focus belongs in it
      autoFocus
    />
  );
}

function FolderRow({ folder, feeds, counts, open, renaming, tree }) {
  const toggle = (
    <button
      type="button"
      aria-label={`${open ? 'Collapse' : 'Expand'} folder ${folder.name}`}
      aria-expanded={open}
      onClick={() => tree.toggleFolder(folder.id)}
      className={cn('flex size-6 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-[var(--text-tertiary)] outline-none transition-transform focus-visible:ring-1 focus-visible:ring-ring', open && 'rotate-90')}
    >
      <HiChevronRight className="size-3" />
    </button>
  );
  return (
    <div>
      {renaming ? (
        <div className="flex h-8 items-center gap-2 pl-6"><RenameInput initial={folder.name} onSubmit={(name) => tree.finishRename(folder.id, name)} onCancel={tree.cancelRename} /></div>
      ) : (
        <NavRow
          active={isActive(tree.activeView, 'folder', folder.id)}
          onClick={() => tree.onViewChange({ type: 'folder', id: folder.id, name: folder.name })}
          onMenu={menuOpener(tree.openMenu, 'folder', folder.id)}
          menuTitle="Folder options"
          icon={<HiOutlineFolderOpen />}
          label={folder.name}
          count={folderUnread(feeds, counts.byFeed)}
          className="pl-0"
        >
          {toggle}
        </NavRow>
      )}
      {open && feeds.map((feed) => (
        <FeedRow key={feed.id} feed={feed} unread={counts.byFeed[feed.id]} active={isActive(tree.activeView, 'feed', feed.id)} onViewChange={tree.onViewChange} openMenu={tree.openMenu} nested />
      ))}
    </div>
  );
}

/** Folders (collapsible, with their feeds) followed by uncategorized feeds. */
export function FolderTree({ folders, grouped, counts, tree }) {
  return (
    <>
      {folders.map((folder) => (
        <FolderRow
          key={folder.id}
          folder={folder}
          feeds={grouped.byFolder[folder.id] || []}
          counts={counts}
          open={tree.openFolders.has(folder.id)}
          renaming={tree.renamingId === folder.id}
          tree={tree}
        />
      ))}
      {grouped.uncategorized.map((feed) => (
        <FeedRow key={feed.id} feed={feed} unread={counts.byFeed[feed.id]} active={isActive(tree.activeView, 'feed', feed.id)} onViewChange={tree.onViewChange} openMenu={tree.openMenu} />
      ))}
    </>
  );
}
