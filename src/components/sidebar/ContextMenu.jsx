import { useId } from 'react';
import {
  HiOutlineArrowPath, HiOutlineArrowRightCircle, HiOutlineCheck, HiOutlineExclamationTriangle, HiOutlineFolderOpen, HiOutlinePencil, HiOutlineTrash,
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { useMenuKeys } from '../../hooks/useMenuKeys.js';

// A menu item; with `checked` it is one choice of a set (menuitemradio).
function Item({ onClick, danger, checked, children }) {
  const radio = checked !== undefined;
  return (
    <button
      type="button"
      role={radio ? 'menuitemradio' : 'menuitem'}
      aria-checked={radio ? checked : undefined}
      onClick={onClick}
      className={cn('flex w-full cursor-pointer items-center gap-2 rounded border-0 bg-transparent px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] [&_svg]:size-3.5', danger ? 'text-[var(--danger)]' : 'text-foreground')}
    >
      {children}
      {checked && <HiOutlineCheck className="ml-auto text-primary" />}
    </button>
  );
}

const Divider = () => <div role="separator" className="my-1 h-px bg-border" />;

function FolderMenu({ id, actions, done }) {
  return (
    <>
      <Item onClick={() => done(() => actions.startRename(id))}><HiOutlinePencil /> Rename</Item>
      <Divider />
      <Item danger onClick={() => done(() => actions.onDeleteFolder(id))}><HiOutlineTrash /> Delete folder (keep feeds)</Item>
      <Item danger onClick={() => done(() => actions.onDeleteFolderAndFeeds(id))}><HiOutlineTrash /> Delete folder and its feeds</Item>
    </>
  );
}

// Why the feed's last refresh failed, above its menu.
function RefreshError({ feed }) {
  if (!feed?.lastError) return null;
  return (
    <div className="mb-1 flex max-w-72 gap-2 border-b border-border px-2.5 pt-1 pb-2 text-[11.5px] leading-snug text-muted-foreground">
      <HiOutlineExclamationTriangle className="mt-px size-3.5 shrink-0 text-primary" />
      <span><span className="text-foreground">Last refresh failed.</span> {feed.lastError}</span>
    </div>
  );
}

function MoveToGroup({ id, currentFolder, folders, actions, done }) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId}>
      <div id={labelId} className="flex items-center gap-2 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wider text-[var(--text-tertiary)]"><HiOutlineArrowRightCircle className="size-3.5" /> Move to</div>
      <Item checked={!currentFolder} onClick={() => done(() => actions.onMoveFeed(id, null))}>No folder</Item>
      {folders.map((folder) => (
        <Item key={folder.id} checked={currentFolder === folder.id} onClick={() => done(() => actions.onMoveFeed(id, folder.id))}>
          <HiOutlineFolderOpen /> {folder.name}
        </Item>
      ))}
    </div>
  );
}

function FeedMenu({ id, feeds, folders, actions, done }) {
  const feed = feeds.find((f) => f.id === id);
  return (
    <>
      <Item onClick={() => done(() => actions.onRefreshFeed(id))}><HiOutlineArrowPath /> Refresh feed</Item>
      <Divider />
      <MoveToGroup id={id} currentFolder={feed?.folderId} folders={folders} actions={actions} done={done} />
      <Divider />
      <Item danger onClick={() => done(() => actions.onRemoveFeed(id))}><HiOutlineTrash /> Remove feed</Item>
    </>
  );
}

function CollectionMenu({ id, actions, done }) {
  return (
    <>
      <Item onClick={() => done(() => actions.startRename(id))}><HiOutlinePencil /> Rename</Item>
      <Divider />
      <Item danger onClick={() => done(() => actions.onDeleteCollection(id))}><HiOutlineTrash /> Delete collection (keep the saves)</Item>
    </>
  );
}

const MENUS = {
  folder: { Menu: FolderMenu, label: 'Folder options' },
  feed: { Menu: FeedMenu, label: 'Feed options' },
  collection: { Menu: CollectionMenu, label: 'Collection options' },
};

/** Right-click / "…" menu for a folder, feed or collection. menu = { type, id, x, y }. */
export function ContextMenu({ menu, feeds, folders, actions, onClose }) {
  const [menuRef, onMenuKeyDown] = useMenuKeys(Boolean(menu), onClose);
  if (!menu) return null;
  const done = (fn) => { fn(); onClose(); };
  const { Menu, label } = MENUS[menu.type];
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pointer-only backdrop; the keyboard closes the menu with Escape (useMenuKeys) */}
      <div className="fixed inset-0 z-[499]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="fixed z-[500] min-w-52 rounded-lg border border-border bg-[var(--bg-modal)] p-1 shadow-xl" style={{ left: menu.x, top: menu.y }}>
        {menu.type === 'feed' && <RefreshError feed={feeds.find((f) => f.id === menu.id)} />}
        <div role="menu" aria-label={label} tabIndex={-1} ref={menuRef} onKeyDown={onMenuKeyDown}>
          <Menu id={menu.id} feeds={feeds} folders={folders} actions={actions} done={done} />
        </div>
      </div>
    </>
  );
}
