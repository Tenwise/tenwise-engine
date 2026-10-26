import { useState } from 'react';
import { HiOutlineInboxArrowDown, HiOutlinePlus, HiOutlineRectangleStack } from 'react-icons/hi2';
import { IconButton } from '@/components/ui/icon-button';
import { useCollectionActions, useCollections } from '../library/useCollections.js';
import { ContextMenu } from './ContextMenu.jsx';
import { RenameInput } from './FolderTree.jsx';
import { NavRow } from './NavRow.jsx';
import { isActive, menuOpener } from './sidebarModel.js';

const openView = (collection) => ({ type: 'collection', id: collection.id, name: collection.name });

function CollectionRow({ collection, renaming, state }) {
  if (renaming) {
    return (
      <div className="flex h-8 items-center gap-2 pl-2">
        <RenameInput initial={collection.name} label="Collection name" onSubmit={(name) => state.finishRename(collection.id, name)} onCancel={state.cancelRename} />
      </div>
    );
  }
  return (
    <NavRow
      active={isActive(state.activeView, 'collection', collection.id)}
      onClick={() => state.onViewChange(openView(collection))}
      onMenu={menuOpener(state.openMenu, 'collection', collection.id)}
      menuTitle="Collection options"
      icon={<HiOutlineRectangleStack />}
      label={collection.name}
      count={collection.count}
    />
  );
}

// New collection, rename, delete and the menu; leaving the view of a deleted collection.
function useCollectionListState(activeView, onViewChange) {
  const actions = useCollectionActions();
  const [adding, setAdding] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [menu, setMenu] = useState(null);
  return {
    activeView, onViewChange, adding, renamingId, menu,
    startAdding: () => setAdding(true),
    cancelAdding: () => setAdding(false),
    finishAdding: async (name) => {
      setAdding(false);
      const created = await actions.create(name);
      if (created) onViewChange(openView(created));
    },
    openMenu: setMenu,
    closeMenu: () => setMenu(null),
    startRename: setRenamingId,
    cancelRename: () => setRenamingId(null),
    finishRename: (id, name) => { setRenamingId(null); actions.rename(id, name); },
    onDeleteCollection: async (id) => {
      if (isActive(activeView, 'collection', id)) onViewChange({ type: 'saved' });
      await actions.remove(id);
    },
  };
}

/**
 * The sidebar's Collections: Unsorted (saves in no collection yet, the
 * filing queue), one row per collection (opens its articles), plus new,
 * rename and delete.
 */
export function CollectionList({ activeView, onViewChange, unsorted }) {
  const collections = useCollections();
  const state = useCollectionListState(activeView, onViewChange);
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between px-2.5 pb-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Collections</span>
        <IconButton onClick={state.startAdding} title="New collection" className="size-6"><HiOutlinePlus /></IconButton>
      </div>
      <NavRow
        active={isActive(activeView, 'unsorted')}
        onClick={() => onViewChange({ type: 'unsorted' })}
        icon={<HiOutlineInboxArrowDown />}
        label="Unsorted"
        count={unsorted}
      />
      {state.adding && (
        <div className="flex h-8 items-center px-2">
          <RenameInput initial="" label="New collection name" onSubmit={state.finishAdding} onCancel={state.cancelAdding} />
        </div>
      )}
      {collections.map((c) => <CollectionRow key={c.id} collection={c} renaming={state.renamingId === c.id} state={state} />)}
      {collections.length === 0 && !state.adding && (
        <p className="m-0 px-2.5 py-1 text-[12px] leading-snug text-[var(--text-tertiary)]">Group your saves: press c on an article.</p>
      )}
      <ContextMenu menu={state.menu} actions={state} onClose={state.closeMenu} />
    </div>
  );
}
