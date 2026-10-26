import {
  HiOutlineArrowPath, HiOutlineCog6Tooth, HiOutlineFolder, HiOutlineListBullet,
  HiOutlinePlus, HiOutlineRss, HiOutlineSparkles, HiOutlineSun, HiOutlineViewColumns,
} from 'react-icons/hi2';
import { VIEW_MODES } from '../article-list/viewModes.js';
import { NAV_ITEMS } from '../sidebar/sidebarModel.js';


function goTo({ folders, feeds }, go) {
  return [
    ...NAV_ITEMS.map(({ type, label, Icon }) => ({ id: `go-${type}`, label, Icon, run: () => go({ type }) })),
    ...folders.map((f) => ({ id: `folder-${f.id}`, label: f.name, hint: 'Folder', Icon: HiOutlineFolder, run: () => go({ type: 'folder', id: f.id, name: f.name }) })),
    ...feeds.map((f) => ({ id: `feed-${f.id}`, label: f.title || f.url, hint: 'Feed', Icon: HiOutlineRss, run: () => go({ type: 'feed', id: f.id, name: f.title }) })),
  ];
}

function actions(a) {
  return [
    { id: 'add-feed', label: 'Add feed', Icon: HiOutlinePlus, run: a.addFeed },
    { id: 'refresh', label: 'Refresh all feeds', Icon: HiOutlineArrowPath, run: a.refreshAll },
    { id: 'settings', label: 'Open settings', Icon: HiOutlineCog6Tooth, run: a.openSettings },
    { id: 'theme', label: 'Toggle light / dark theme', Icon: HiOutlineSun, run: a.toggleTheme },
    { id: 'sidebar', label: 'Cycle sidebar', shortcut: '[', Icon: HiOutlineViewColumns, run: a.toggleSidebar },
    { id: 'list', label: 'Hide / show article list', shortcut: ']', Icon: HiOutlineListBullet, run: a.toggleList },
    { id: 'ai-rail', label: 'Toggle AI side rail', shortcut: 'a', Icon: HiOutlineSparkles, run: a.toggleAI },
  ];
}

function viewModes(setViewMode) {
  return VIEW_MODES.map(({ id, label, Icon }) => ({ id: `view-${id}`, label: `View as ${label}`, Icon, run: () => setViewMode(id) }));
}

/**
 * The command palette's fixed groups: places to go (views, folders, feeds),
 * actions, and list view modes. Each item: { id, label, hint?, shortcut?, Icon, run }.
 */
export function buildCommands({ folders = [], feeds = [], go, actions: a, setViewMode }) {
  return [
    { heading: 'Go to', items: goTo({ folders, feeds }, go) },
    { heading: 'Actions', items: actions(a) },
    { heading: 'List view', items: viewModes(setViewMode) },
  ];
}

/**
 * Palette matching: every word of the search must start a word in the item's
 * text ("view" matches "View as Grid", not "Review"); no fuzzy subsequence
 * matches. Items starting with the first word rank higher. Returns cmdk's
 * score, 0 to hide.
 */
export function commandFilter(value, search) {
  const words = value.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.every((t) => words.some((w) => w.startsWith(t)))) return 0;
  return words[0].startsWith(terms[0] ?? '') ? 1 : 0.5;
}
