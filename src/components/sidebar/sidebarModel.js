import { useEffect, useState } from 'react';
import {
  HiOutlineBookmark, HiOutlineCalendar, HiOutlineNewspaper, HiOutlinePencilSquare, HiOutlineSparkles,
} from 'react-icons/hi2';
import { pluginsOf } from '../../plugins/index.js';
import { fetchCounts, fetchHighlightsCount } from '../../utils/api.js';

// Views added by plugins (src/plugins/index.js); each brings a useCount hook.
const PLUGIN_NAV = pluginsOf('navItems');

/** Navigation entries, the app's then the plugins'; count(c) reads the badge from the counts object. */
export const NAV_ITEMS = [
  { type: 'all', label: 'All Articles', Icon: HiOutlineNewspaper, count: (c) => c.total },
  { type: 'today', label: 'Today', Icon: HiOutlineCalendar, count: (c) => c.today },
  { type: 'saved', label: 'Saved', Icon: HiOutlineBookmark, count: (c) => c.saved },
  { type: 'highlights', label: 'Highlights', Icon: HiOutlinePencilSquare, count: (c) => c.highlights },
  { type: 'library', label: 'AI Summaries', iconTitle: 'AI Summaries Library', Icon: HiOutlineSparkles, count: (c) => c.library },
  ...PLUGIN_NAV.map((item) => ({ ...item, count: (c) => c[item.type] })),
];

// Where the menu opens: at the pointer, or under the "…" button when it was
// pressed from the keyboard (a keyboard click has detail 0 and no pointer position).
const menuPosition = (e) => {
  if (e.type === 'contextmenu' || e.detail > 0) return { x: e.clientX, y: e.clientY };
  const rect = e.currentTarget.getBoundingClientRect();
  return { x: rect.left, y: rect.bottom };
};

// Opens the context menu (right-click or the "…" button).
export const menuOpener = (openMenu, type, id) => (e) => {
  e.preventDefault();
  e.stopPropagation();
  openMenu({ type, id, ...menuPosition(e) });
};

export const isActive = (activeView, type, id) => activeView.type === type && (id === undefined || activeView.id === id);

/** Feeds grouped by folder id, plus the uncategorized ones. */
export function groupFeeds(feeds) {
  const byFolder = {};
  const uncategorized = [];
  for (const feed of feeds) {
    if (!feed.folderId) uncategorized.push(feed);
    else (byFolder[feed.folderId] ||= []).push(feed);
  }
  return { byFolder, uncategorized };
}

export function folderUnread(folderFeeds = [], byFeed) {
  return folderFeeds.reduce((sum, f) => sum + (byFeed[f.id] || 0), 0);
}

/** Unread/saved/unsorted/today/highlights counts, reloaded when refreshKey changes, and each plugin view's count. */
export function useSidebarCounts(refreshKey, librarySummaryCount) {
  const [counts, setCounts] = useState({ byFeed: {}, total: 0, saved: 0, today: 0, highlights: 0 });

  useEffect(() => {
    fetchCounts()
      .then(({ unreadByFeed, total, savedCount, unsortedCount, todayCount }) =>
        setCounts((c) => ({ ...c, byFeed: unreadByFeed, total, saved: savedCount, unsorted: unsortedCount, today: todayCount })))
      .catch(() => {});
    fetchHighlightsCount()
      .then(({ count }) => setCounts((c) => ({ ...c, highlights: count })))
      .catch(() => {});
  }, [refreshKey]);
  // PLUGIN_NAV is fixed when the bundle loads, so these hooks run in the same order every render.
  const pluginCounts = Object.fromEntries(PLUGIN_NAV.map((item) => [item.type, item.useCount()]));

  return { ...counts, ...pluginCounts, library: librarySummaryCount };
}
