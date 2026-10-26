import { useCallback } from 'react';
import { HiOutlineArrowDownTray, HiOutlineClipboardDocumentList } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { useLibrary } from '../../app/LibraryContext.jsx';
import { useToast } from '../../app/ToastContext.jsx';
import { pluginsOf } from '../../plugins/index.js';
import { fetchArticlePage, getCollectionExportURL } from '../../utils/api.js';
import { downloadUrl } from '../../utils/download.js';
import { copyReferences } from './citationClipboard.js';
import { articleReferences } from './citationModel.js';
import { useCollections } from './useCollections.js';

// Actions plugins add to a collection (src/plugins/index.js), e.g. NotebookLM
// or a Studio draft; each gets { collection, loadArticles, feedOf }.
const PLUGIN_ACTIONS = pluginsOf('collectionActions');

// Every article in the collection (list rows, newest save first).
const collectionArticles = async (id) => (await fetchArticlePage('collection', id, { limit: 500 })).articles;

// Each article's feed (removed feeds included: their saves stay).
function useFeedOf() {
  const { sourceFeeds: feeds } = useLibrary();
  return useCallback((article) => feeds.find((f) => f.id === article.feedId), [feeds]);
}

// Copies every article in the collection as an APA reference list.
function useCopyCitations(id) {
  const feedOf = useFeedOf();
  const showToast = useToast();
  return async () => {
    try {
      const articles = await collectionArticles(id);
      await copyReferences(articleReferences(articles, feedOf));
      showToast(`Copied ${articles.length} APA citation${articles.length === 1 ? '' : 's'}, in reference-list order.`, 'info');
    } catch (err) {
      showToast(`Couldn't copy the citations: ${err.message}`, 'error');
    }
  };
}

/** Under a collection's list header: plugin actions, then download its articles as Markdown or copy its citations. */
export default function CollectionOutBar({ id }) {
  const collection = useCollections().find((c) => c.id === id);
  const feedOf = useFeedOf();
  const copyCitations = useCopyCitations(id);
  if (!collection || collection.count === 0) return null;
  const loadArticles = () => collectionArticles(id);
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
      {PLUGIN_ACTIONS.map(({ id: actionId, Action }) => <Action key={actionId} collection={collection} loadArticles={loadArticles} feedOf={feedOf} />)}
      <Button size="sm" variant="ghost" onClick={() => downloadUrl(getCollectionExportURL(id))} title="Every article as one Markdown file: its title, link, your note and its text">
        <HiOutlineArrowDownTray /> Download Markdown
      </Button>
      <Button size="sm" variant="ghost" onClick={copyCitations} title="Every article as an APA 7 reference, A to Z, ready to paste into a document">
        <HiOutlineClipboardDocumentList /> Copy citations
      </Button>
    </div>
  );
}
