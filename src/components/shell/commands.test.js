import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCommands, commandFilter } from './commands.js';

const noop = () => {};
const actions = { addFeed: noop, refreshAll: noop, openSettings: noop, toggleTheme: noop, toggleSidebar: noop, toggleList: noop, toggleAI: noop };

test('go-to lists the fixed views, then folders, then feeds', () => {
  const went = [];
  const [goTo] = buildCommands({
    folders: [{ id: 3, name: 'AI News' }],
    feeds: [{ id: 7, title: 'Aeon' }],
    go: (view) => went.push(view),
    actions,
    setViewMode: noop,
  });
  assert.equal(goTo.heading, 'Go to');
  assert.deepEqual(goTo.items.slice(-2).map((i) => i.label), ['AI News', 'Aeon']);
  goTo.items.find((i) => i.id === 'feed-7').run();
  assert.deepEqual(went, [{ type: 'feed', id: 7, name: 'Aeon' }]);
});

test('view mode commands pass the mode id', () => {
  const modes = [];
  const groups = buildCommands({ go: noop, actions, setViewMode: (m) => modes.push(m) });
  groups.find((g) => g.heading === 'List view').items.forEach((i) => i.run());
  assert.deepEqual(modes, ['rows', 'magazine', 'excerpt', 'compact']);
});

test('palette filter matches word starts in any order, not subsequences', () => {
  assert.equal(commandFilter('View as Grid view-magazine', 'grid view'), 0.5);
  assert.equal(commandFilter('View as Grid view-magazine', 'view'), 1);
  assert.equal(commandFilter('MIT Technology Review Feed feed-3', 'view'), 0);
  assert.equal(commandFilter('Articles on Smashing Magazine Feed', 'roman'), 0);
});
