import { HiOutlineArrowDownTray, HiOutlineExclamationCircle, HiOutlineMagnifyingGlass, HiOutlineXMark } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/** Header: title with count, a search field, and CSV export. */
export function LibraryHeader({ Icon, title, collection, exportUrl, exportTitle, placeholder }) {
  const count = collection.rows.length;
  return (
    <header className="flex h-[var(--pane-header-height)] shrink-0 items-center gap-3 border-b border-border px-5">
      <Icon className="size-[18px] shrink-0 text-primary" />
      <h2 className="m-0 mr-auto truncate text-base font-semibold text-foreground">
        {title}
        {count > 0 && <span className="ml-1.5 font-mono text-xs font-normal text-[var(--text-tertiary)]">{count}</span>}
      </h2>
      <label className="flex h-8 w-64 items-center gap-2 rounded-md border border-border bg-[var(--bg-primary)] px-2.5 text-muted-foreground focus-within:border-primary">
        <HiOutlineMagnifyingGlass className="size-4 shrink-0" />
        <input
          value={collection.search}
          onChange={(e) => collection.setSearch(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-foreground shadow-none outline-none"
        />
        {collection.search && (
          <button type="button" aria-label="Clear search" onClick={() => collection.setSearch('')} className="cursor-pointer border-0 bg-transparent p-0 text-muted-foreground hover:text-foreground">
            <HiOutlineXMark className="size-3.5" />
          </button>
        )}
      </label>
      {count > 0 && (
        <a href={exportUrl} download title={exportTitle} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[13px] text-foreground no-underline hover:bg-[var(--bg-hover)]">
          <HiOutlineArrowDownTray className="size-4" /> CSV
        </a>
      )}
    </header>
  );
}

/** Where the collection is stored (power users back it up or query it). */
export function DbPath({ path }) {
  if (!path) return null;
  return (
    <p className="m-0 mt-10 border-t border-border pt-4 font-mono text-[11px] break-all text-[var(--text-tertiary)]">
      Stored in {path}
    </p>
  );
}

function EmptyState({ empty, search }) {
  return (
    <div className="flex flex-col items-center gap-2 py-24 text-center">
      <empty.Icon className="size-9 text-[var(--text-tertiary)]" />
      <h3 className="m-0 mt-2 text-[15px] font-medium text-foreground">{search ? empty.noMatchTitle : empty.title}</h3>
      <p className="m-0 max-w-sm text-[13px] text-muted-foreground">{search ? `${empty.noMatchPrefix} “${search}”.` : empty.body}</p>
    </div>
  );
}

// Which of loading, error, empty or list to show.
function bodyState({ loading, error, filtered }) {
  if (loading) return 'loading';
  if (error) return 'error';
  return filtered.length === 0 ? 'empty' : 'list';
}

function ErrorNotice({ error, onRetry }) {
  return (
    <div className="my-6 flex items-center gap-3 rounded-md border border-[var(--danger)] px-4 py-3 text-[13px] text-foreground">
      <HiOutlineExclamationCircle className="size-4 text-[var(--danger)]" />
      <span className="mr-auto">{error}</span>
      <Button variant="ghost" size="sm" onClick={onRetry}>Retry</Button>
    </div>
  );
}

/** Loading, error with retry, or the empty state; the list otherwise. Content sits in a reading column. */
export function LibraryBody({ collection, empty, children }) {
  const state = bodyState(collection);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[820px] px-6 pt-4 pb-16">
        {state === 'loading' && <div className="flex justify-center py-24"><Spinner className="size-6" /></div>}
        {state === 'error' && <ErrorNotice error={collection.error} onRetry={collection.retry} />}
        {state === 'empty' && <EmptyState empty={empty} search={collection.search} />}
        {state === 'list' && children}
        {state !== 'loading' && <DbPath path={collection.dbPath} />}
      </div>
    </div>
  );
}

/** The screen frame shared by Summaries and Highlights. */
export function LibraryScreen({ children }) {
  return <div className="flex h-screen min-w-0 flex-1 flex-col bg-background">{children}</div>;
}
