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

test('a collection exports as Markdown: header, then each article with its note and text', () => {
  const feed = reader.createFeed({ title: 'Field Notes', url: 'https://notes.example/rss' });
  reader.bulkInsertArticles(feed.id, [
    { guid: 'x', title: 'PGlite in the browser', link: 'https://notes.example/pglite', author: 'Ann Lee', content: '<p>Postgres, embedded.</p>', publishedAt: '2026-10-01T00:00:00Z' },
    { guid: 'y', title: 'No body', link: 'https://notes.example/empty', content: '' },
  ]);
  const ids = reader.findArticleByLink('https://notes.example/pglite').id;
  const empty = reader.findArticleByLink('https://notes.example/empty').id;
  const c = collections.createCollection({ name: 'Local-first stack', description: 'Databases that ship inside the app' });
  collections.addToCollection(c.id, [ids, empty]);
  reader.updateArticle(ids, { note: 'could replace our SQLite server' });

  const { name, markdown } = exporter.collectionMarkdown(c.id, new Date('2026-10-19T12:00:00Z'));
  assert.equal(name, 'Local-first stack');
  assert.match(markdown, /^# Local-first stack\n\nDatabases that ship inside the app\n\nCollected in Tenwise: 2 articles, exported 2026-10-19\./);
  assert.match(markdown, /## PGlite in the browser\n\n- Source: Field Notes \(https:\/\/notes\.example\/pglite\)\n- Published 2026-10-01 · saved \d{4}-\d\d-\d\d\n- Cite \(APA 7\): Lee, A\. \(2026, October 1\)\. PGlite in the browser\. \*Field Notes\*\. https:\/\/notes\.example\/pglite\n- My note: could replace our SQLite server\n\nPostgres, embedded\./);
  assert.match(markdown, /## No body[\s\S]*_No text was stored for this article; see the link above\._/);
  assert.equal(exporter.collectionMarkdown(99999), null);
});
