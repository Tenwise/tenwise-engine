import { useState } from 'react';
import { HiOutlineCheck, HiOutlinePlus, HiOutlineRectangleStack } from 'react-icons/hi2';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { useArticleCollections, useCollectionActions, useCollections } from './useCollections.js';

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Membership to show: one article's collections, or (for several articles)
// the collections they were added to while the picker is open.
function useMembership(articleIds) {
  const single = articleIds.length === 1 ? articleIds[0] : null;
  const stored = useArticleCollections(single);
  const [addedNow, setAddedNow] = useState(() => new Set());
  const members = single ? new Set(stored) : addedNow;
  const noteAdded = (id) => setAddedNow((prev) => new Set(prev).add(id));
  return { single, members, noteAdded };
}

function CollectionRow({ collection, member, onSelect }) {
  return (
    <CommandItem value={`${collection.name} ${collection.id}`} onSelect={onSelect}>
      <HiOutlineRectangleStack />
      <span className="truncate">{collection.name}</span>
      <span className="ml-auto flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
        {collection.count}
        <HiOutlineCheck className={member ? 'text-primary' : 'invisible'} />
      </span>
    </CommandItem>
  );
}

// Add or remove (one article), add (several), and create-then-add.
function usePickerActions(articleIds, query, setQuery) {
  const collections = useCollections();
  const actions = useCollectionActions();
  const membership = useMembership(articleIds);
  const { single, members, noteAdded } = membership;
  const toggle = async (collection) => {
    if (single && members.has(collection.id)) return actions.take(collection.id, articleIds);
    const added = await actions.add(collection.id, articleIds);
    if (added) noteAdded(collection.id);
    return added;
  };
  const createAndAdd = async () => {
    const created = await actions.create(query.trim());
    if (!created) return;
    setQuery('');
    await toggle(created);
  };
  const canCreate = Boolean(query.trim()) && !collections.some((c) => sameName(c.name, query));
  return { collections, single, members, toggle, createAndAdd, canCreate };
}

function CreateRow({ query, onCreate }) {
  return (
    <CommandItem value={`create ${query}`} forceMount onSelect={onCreate}>
      <HiOutlinePlus />
      <span className="truncate">Create “{query.trim()}”</span>
    </CommandItem>
  );
}

function PickerList({ picker, query }) {
  const { collections, members, toggle, createAndAdd, canCreate } = picker;
  if (collections.length === 0 && !canCreate) return <CommandEmpty>No collections yet. Type a name to create one.</CommandEmpty>;
  return (
    <CommandGroup heading="Collections">
      {collections.map((c) => <CollectionRow key={c.id} collection={c} member={members.has(c.id)} onSelect={() => toggle(c)} />)}
      {canCreate && <CreateRow query={query} onCreate={createAndAdd} />}
    </CommandGroup>
  );
}

/**
 * Adds articles to collections, or takes one out: type to filter, Enter to
 * add or remove (one article) or add (several), and "Create" for a new
 * name. It stays open, so one article can go into several; Esc closes it.
 */
export default function CollectionPicker({ open, articleIds, onClose }) {
  const [query, setQuery] = useState('');
  const picker = usePickerActions(articleIds, query, setQuery);
  const close = () => { setQuery(''); onClose(); };
  const what = picker.single ? 'this article' : `${articleIds.length} articles`;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => { if (!next) close(); }}
      title="Collections"
      description={`Add ${what} to collections`}
      className="top-[18%] translate-y-0 border-border bg-[var(--bg-modal)] sm:max-w-md"
      showCloseButton={false}
    >
      <CommandInput placeholder={`Add ${what} to… (type to find or create)`} value={query} onValueChange={setQuery} />
      <CommandList className="max-h-[min(380px,55vh)]">
        <PickerList picker={picker} query={query} />
      </CommandList>
      <div className="flex justify-between border-t border-border px-3 py-2 font-mono text-[11px] text-muted-foreground">
        <span>↵ {picker.single ? 'add or remove' : 'add'}</span>
        <span>Esc done</span>
      </div>
    </CommandDialog>
  );
}
