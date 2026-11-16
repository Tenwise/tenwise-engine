import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedsInFolders, folderUnread, groupFeeds, isActive, menuOpener } from './sidebarModel.js';

test('groupFeeds keeps feed order within folders and collects uncategorized feeds', () => {
  const feeds = [{ id: 1, folderId: 7 }, { id: 2 }, { id: 3, folderId: 7 }, { id: 4, folderId: 8 }];
  const { byFolder, uncategorized } = groupFeeds(feeds);
  assert.deepEqual(byFolder[7].map((f) => f.id), [1, 3]);
  assert.deepEqual(byFolder[8].map((f) => f.id), [4]);
  assert.deepEqual(uncategorized.map((f) => f.id), [2]);
});

test('folderUnread, isActive', () => {
  assert.equal(folderUnread([{ id: 1 }, { id: 3 }], { 1: 5, 3: 2, 9: 100 }), 7);
  assert.equal(folderUnread(undefined, {}), 0);
  assert.equal(isActive({ type: 'folder', id: 7 }, 'folder', 7), true);
  assert.equal(isActive({ type: 'folder', id: 7 }, 'folder', 8), false);
  assert.equal(isActive({ type: 'all' }, 'all'), true);
});

// A click event as React hands it over; `detail` is 0 for a keyboard click.
const clickEvent = (overrides) => ({
  type: 'click', detail: 1, clientX: 0, clientY: 0,
  currentTarget: { getBoundingClientRect: () => ({ left: 200, bottom: 340 }) },
  preventDefault() {}, stopPropagation() {},
  ...overrides,
});

const openedWith = (event) => {
  let menu;
  menuOpener((m) => { menu = m; }, 'feed', 7)(event);
  return menu;
};

test('a right-click or mouse click opens the menu at the pointer', () => {
  assert.deepEqual(openedWith(clickEvent({ type: 'contextmenu', clientX: 40, clientY: 90 })), { type: 'feed', id: 7, x: 40, y: 90 });
  assert.deepEqual(openedWith(clickEvent({ clientX: 210, clientY: 330 })), { type: 'feed', id: 7, x: 210, y: 330 });
});

test('a keyboard click on "…" opens the menu under the button, not at the window corner', () => {
  assert.deepEqual(openedWith(clickEvent({ detail: 0 })), { type: 'feed', id: 7, x: 200, y: 340 });
});

test('To file shows once there is a collection (UX-10)', async () => {
  const { showToFile } = await import('./sidebarModel.js');
  assert.equal(showToFile(0), false);
  assert.equal(showToFile(1), true);
});

test('feedsInFolders: a feed a sidebar section shows leaves Folders', () => {
  const feeds = [{ id: 1, url: 'https://a.example/rss' }, { id: 2, url: 'https://app.example/inbox/x.atom' }];
  const sections = [{ id: 'plain' }, { id: 'inbox', hidesFeed: (f) => f.url.includes('/inbox/') }];
  assert.deepEqual(feedsInFolders(feeds, sections).map((f) => f.id), [1]);
  assert.deepEqual(feedsInFolders(feeds, []).map((f) => f.id), [1, 2]);
});
