import { useEffect, useState } from 'react';
import { HiOutlineInboxArrowDown } from 'react-icons/hi2';
import { useLibrary } from '../../app/LibraryContext.jsx';
import { emit } from '../../lib/appEvents.js';
import { fetchCounts } from '../../utils/api.js';
import { showToFile } from '../sidebar/sidebarModel.js';
import { useCollections } from './useCollections.js';

/**
 * At the top of Saved (UX-10): how many saves are in no collection yet,
 * opening To file. Shown once there's a collection and something to file.
 */
export function ToFileBar() {
  const { countsRefreshKey } = useLibrary();
  const collections = useCollections();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    fetchCounts().then((c) => { if (live) setCount(c.unsortedCount ?? 0); }).catch(() => {});
    return () => { live = false; };
  }, [countsRefreshKey]);
  if (!showToFile(collections.length) || count === 0) return null;
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-1.5 text-[12.5px] text-muted-foreground">
      <HiOutlineInboxArrowDown className="size-3.5" />
      <button type="button" onClick={() => emit('open-view', { type: 'unsorted' })} className="cursor-pointer border-0 bg-transparent p-0 text-foreground underline-offset-2 hover:underline">
        {count} to file
      </button>
      <span>in no collection yet</span>
    </div>
  );
}
