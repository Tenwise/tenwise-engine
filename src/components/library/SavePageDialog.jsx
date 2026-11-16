import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '../../app/ToastContext.jsx';
import { bookmarkletFor } from '../../app/deepLink.js';
import { emit } from '../../lib/appEvents.js';
import { savePage } from '../../utils/api.js';
import { useCollections } from './useCollections.js';

const FIELD = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-primary';
const LABEL = 'mb-1 block text-[12px] font-medium text-muted-foreground';

// The bookmarklet: copied, to paste as a new bookmark's address.
function Bookmarklet() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(bookmarkletFor(window.location.origin)).catch(() => {});
    setCopied(true);
  };
  return (
    <p className="m-0 text-[12.5px] text-muted-foreground">
      Save from any page: make a bookmark named Save to Tenwise, and paste this as its address.{' '}
      <button type="button" onClick={copy} className="cursor-pointer rounded-md border border-border bg-transparent px-2 py-0.5 text-[12px] font-medium text-foreground">{copied ? 'Copied' : 'Copy the bookmark'}</button>
    </p>
  );
}

/**
 * Saves a page from a link (BRF-08): the address, a note, and the collection
 * to put it in. start: { url?, collectionId? }.
 */
export default function SavePageDialog({ start, onClose }) {
  const collections = useCollections();
  const showToast = useToast();
  const [url, setUrl] = useState(start.url ?? '');
  const [note, setNote] = useState('');
  const [collectionId, setCollectionId] = useState(start.collectionId ? String(start.collectionId) : '');
  const [state, setState] = useState({ busy: false, error: null });
  const save = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: null });
    try {
      const { article, duplicate } = await savePage({ url: url.trim(), note: note.trim() || undefined, collectionId: collectionId ? Number(collectionId) : undefined });
      const where = collections.find((c) => String(c.id) === collectionId)?.name;
      showToast(`${duplicate ? 'Already in your library; saved' : 'Saved'}${where ? ` to ${where}` : ''}: ${article.title}`);
      emit('feeds-changed');
      onClose();
    } catch (err) {
      setState({ busy: false, error: err.message });
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !state.busy) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={save} className="grid gap-3">
          <DialogHeader>
            <DialogTitle>Save a page</DialogTitle>
            <DialogDescription>Tenwise reads the page and keeps it like a saved article, so you can cite it in a brief.</DialogDescription>
          </DialogHeader>
          <label className="block"><span className={LABEL}>The page's address</span>
            <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={FIELD} />
          </label>
          <label className="block"><span className={LABEL}>Collection</span>
            <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)} className={FIELD}>
              <option value="">Just save it</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block"><span className={LABEL}>Your note (optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} className={FIELD} />
          </label>
          {state.error && <p role="alert" className="m-0 text-[13px] text-[var(--danger)]">{state.error}</p>}
          <Bookmarklet />
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={state.busy}>Cancel</Button>
            <Button type="submit" size="sm" disabled={state.busy || !url.trim()}>{state.busy ? 'Reading the page…' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
