import { HiOutlinePlus } from 'react-icons/hi2';
import { emit } from '../../lib/appEvents.js';
import { useArticleCollections, useCollections } from '../library/useCollections.js';

const CHIP = 'inline-flex h-6 items-center gap-1 rounded-full border border-border px-2.5 font-mono text-[11px] text-muted-foreground';

/** The collections a saved article is in, and a button (or c) to file it in more. */
export default function InCollections({ articleId }) {
  const ids = useArticleCollections(articleId);
  const collections = useCollections();
  const names = collections.filter((c) => ids.includes(c.id)).map((c) => c.name);
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      {names.map((name) => <span key={name} className={CHIP}>{name}</span>)}
      <button
        type="button"
        onClick={() => emit('open-collections', [articleId])}
        title="Add to a collection (c)"
        className={`${CHIP} cursor-pointer border-dashed bg-transparent hover:border-primary hover:text-foreground`}
      >
        <HiOutlinePlus className="size-3" /> {names.length ? 'Collection' : 'Add to a collection'} <kbd className="text-[var(--text-tertiary)]">c</kbd>
      </button>
    </div>
  );
}
