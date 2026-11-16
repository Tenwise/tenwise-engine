import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let reader;
let collections;
let exporter;
before(async () => {
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-export-'));
  reader = await import('./reader.js');
  collections = await import('./collections.js');
  exporter = await import('./collectionExport.js');
});

test('htmlToParagraphs keeps paragraph breaks and cuts long text', () => {
  assert.equal(exporter.htmlToParagraphs('<p>One &amp; two</p><p>Three<br>four</p>'), 'One & two\n\nThree\n\nfour');
  assert.equal(exporter.htmlToParagraphs('<p>abcdefghij</p>', 4), 'abcd…');
  assert.equal(exporter.htmlToParagraphs(null), '');
});

test('a collection exports as Markdown: header, then each article with its note and text', async () => {
  const feed = reader.createFeed({ title: 'Field Notes', url: 'https://notes.example/rss' });
  reader.bulkInsertArticles(feed.id, [
    { guid: 'x', title: 'PGlite in the browser', link: 'https://notes.example/pglite', author: 'Ann Lee', content: `<p>Postgres, embedded.</p><p>${'Full feed text. '.repeat(40)}</p>`, publishedAt: '2026-10-01T00:00:00Z' },
    { guid: 'y', title: 'No body', link: 'https://notes.example/empty', content: '' },
  ]);
  const ids = reader.findArticleByLink('https://notes.example/pglite').id;
  const empty = reader.findArticleByLink('https://notes.example/empty').id;
  const c = collections.createCollection({ name: 'Local-first stack', description: 'Databases that ship inside the app' });
  collections.addToCollection(c.id, [ids, empty]);
  reader.updateArticle(ids, { note: 'could replace our SQLite server' });

  const fetched = [];
  const extract = async (url) => { fetched.push(url); throw new Error('offline'); };
  const { name, markdown, linkOnly } = await exporter.collectionMarkdown(c.id, { now: new Date('2026-10-19T12:00:00Z'), extract });
  assert.deepEqual(fetched, ['https://notes.example/empty'], 'only the stub is fetched');
  assert.equal(linkOnly, 1);
  assert.equal(name, 'Local-first stack');
  assert.match(markdown, /^# Local-first stack\n\nDatabases that ship inside the app\n\nCollected in Tenwise: 2 articles, exported 2026-10-19\./);
  assert.match(markdown, /## PGlite in the browser\n\n- Source: Field Notes \(https:\/\/notes\.example\/pglite\)\n- Published 2026-10-01 · saved \d{4}-\d\d-\d\d\n- Cite \(APA 7\): Lee, A\. \(2026, October 1\)\. PGlite in the browser\. \*Field Notes\*\. https:\/\/notes\.example\/pglite\n- My note: could replace our SQLite server\n\nPostgres, embedded\./);
  const noBody = markdown.split('\n\n---\n\n').find((section) => section.startsWith('## No body'));
  assert.ok(noBody.trimEnd().endsWith(exporter.LINK_ONLY), noBody);
  assert.equal(await exporter.collectionMarkdown(99999), null);
});

test('a stub article exports its page text, or is marked link only after what it has (PR-16)', async () => {
  const page = `<p>${'The whole article. '.repeat(40)}</p>`;
  const rows = [
    { title: 'Lobsters item', link: 'https://lobste.rs/s/a', content: 'Comments' },
    { title: 'Another', link: 'https://lobste.rs/s/b', content: 'Comments' },
    { title: 'Short page', link: 'https://lobste.rs/s/c', content: '' },
    { title: 'No link', link: null, content: 'Comments' },
  ];
  const extract = async (url) => {
    if (url.endsWith('/a')) return { content: page };
    if (url.endsWith('/c')) return { content: '<p>Too short.</p>' };
    throw new Error('blocked');
  };
  const bodies = await exporter.bodiesOf(rows, extract);
  assert.match(bodies[0].text, /^The whole article\./);
  assert.equal(bodies[0].linkOnly, false);
  assert.deepEqual(bodies[1], { text: 'Comments', linkOnly: true });
  assert.deepEqual(bodies[2], { text: '', linkOnly: true });
  assert.deepEqual(bodies[3], { text: 'Comments', linkOnly: false }, 'nothing to fetch without a link');
});

test('the export fetches at most 12 pages, 4 at a time', async () => {
  let running = 0;
  let most = 0;
  let calls = 0;
  const extract = async () => {
    calls += 1; running += 1; most = Math.max(most, running);
    await new Promise((resolve) => { setTimeout(resolve, 2); });
    running -= 1;
    return { content: `<p>${'Page text. '.repeat(60)}</p>` };
  };
  const rows = Array.from({ length: 50 }, (_, i) => ({ title: `Item ${i}`, link: `https://lobste.rs/s/${i}`, content: 'Comments' }));
  const bodies = await exporter.bodiesOf(rows, extract);
  assert.equal(calls, 12);
  assert.equal(most, 4);
  assert.equal(bodies.filter((b) => b.linkOnly).length, 38);
});
