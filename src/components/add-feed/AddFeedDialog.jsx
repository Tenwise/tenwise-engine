import { useState } from 'react';
import { HiOutlineBell, HiOutlineGlobeAlt, HiOutlineMagnifyingGlass, HiOutlineRss, HiOutlineXMark } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useLibrary } from '../../app/LibraryContext.jsx';
import { AlertsTab } from './AlertsTab.jsx';
import { pluginsOf } from '../../plugins/index.js';
import { useAsyncStatus, useFeedAdder, useFeedDiscovery } from './hooks.js';
import { PopularTab } from './PopularTab.jsx';
import { SearchTab } from './SearchTab.jsx';
import { UrlTab } from './UrlTab.jsx';

// Tabs added by plugins (src/plugins/index.js) sit before Google Alerts.
const PLUGIN_TABS = pluginsOf('addFeedTabs');
const TABS = [
  { id: 'discover', label: 'URL', Icon: HiOutlineGlobeAlt },
  { id: 'search', label: 'Search', Icon: HiOutlineMagnifyingGlass },
  { id: 'popular', label: 'Popular', Icon: HiOutlineRss },
  ...PLUGIN_TABS,
  { id: 'google', label: 'Google Alerts', Icon: HiOutlineBell },
];
const DESCRIPTION = `Add feeds by ${TABS.map((t) => t.label).join(', ')}`;

// Each plugin tab's state, kept while other tabs are shown. PLUGIN_TABS is
// fixed when the bundle loads, so these hooks run in the same order every render.
function usePluginTabs(status) {
  return Object.fromEntries(PLUGIN_TABS.map((t) => [t.id, t.useTab(status)]));
}

function Tabs({ tab, onChange }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto px-5">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => onChange(id)}
          className={cn(
            '-mb-px flex h-10 shrink-0 cursor-pointer items-center gap-1.5 border-0 border-b-2 bg-transparent px-2.5 text-[13px] transition-colors',
            tab === id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="size-4" /> {label}
        </button>
      ))}
    </div>
  );
}

function FolderPicker({ folders, value, onChange }) {
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
      Add to
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded-md border border-border bg-[var(--bg-primary)] px-2 font-sans text-[12.5px] text-foreground outline-none focus:border-primary"
      >
        <option value="">No folder</option>
        {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </label>
  );
}

function TabPanel({ tab, setTab, state }) {
  const { discovery, pluginTabs, status, adder, searchQuery, setSearchQuery, category, setCategory } = state;
  if (tab === 'search') {
    // A search offer opens its plugin tab with a request, e.g. { query }.
    const openTab = (id, request) => {
      setTab(id);
      PLUGIN_TABS.find((t) => t.id === id)?.open?.(pluginTabs[id], request);
    };
    return <SearchTab query={searchQuery} onQueryChange={setSearchQuery} onOpenTab={openTab} adder={adder} />;
  }
  const plugin = PLUGIN_TABS.find((t) => t.id === tab);
  if (plugin) return <plugin.Panel tab={pluginTabs[tab]} loading={status.loading} adder={adder} />;
  if (tab === 'popular') return <PopularTab category={category} onCategoryChange={setCategory} adder={adder} />;
  if (tab === 'google') return <AlertsTab url={discovery.url} onUrlChange={discovery.setUrl} onSubmit={() => { setTab('discover'); discovery.discover(); }} />;
  return <UrlTab discovery={discovery} loading={status.loading} adder={adder} />;
}

/** Add feeds: by URL, catalog search, popular categories, plugin tabs or Google Alerts; into a folder. */
export default function AddFeedDialog({ isOpen, onClose }) {
  const { onAddFeed, existingFeedUrls, folders } = useLibrary();
  const [tab, setTab] = useState('discover');
  const [folderId, setFolderId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const status = useAsyncStatus();
  const discovery = useFeedDiscovery(status);
  const pluginTabs = usePluginTabs(status);
  const adder = useFeedAdder({ onAddFeed, existingFeedUrls, folderId, setError: status.setError });
  const state = { discovery, pluginTabs, status, adder, searchQuery, setSearchQuery, category, setCategory };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent showCloseButton={false} className="flex h-[min(720px,88vh)] w-[min(720px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden border-border bg-[var(--bg-modal)] p-0 sm:max-w-none">
        <div className="flex h-[var(--pane-header-height)] shrink-0 items-center gap-3 pr-2 pl-5">
          <DialogTitle className="m-0 mr-auto text-[15px] font-semibold">Add feeds</DialogTitle>
          <DialogDescription className="sr-only">{DESCRIPTION}</DialogDescription>
          <FolderPicker folders={folders} value={folderId} onChange={setFolderId} />
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground hover:bg-[var(--bg-hover)] hover:text-foreground">
            <HiOutlineXMark className="size-4" />
          </button>
        </div>
        <div className="shrink-0 border-b border-border"><Tabs tab={tab} onChange={setTab} /></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {status.error && <div className="mb-4 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-3 py-2 text-[13px] text-foreground">{status.error}</div>}
          <TabPanel tab={tab} setTab={setTab} state={state} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
