import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let reader;
let collections;
let highlights;
let notes;
let collectionExport;
let shelf;
before(async () => {
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-notes-'));
  reader = await import('./reader.js');
  collections = await import('./collections.js');
  highlights = await import('./highlights.js');
  notes = await import('./notesExport.js');
  collectionExport = await import('./collectionExport.js');
  const feed = reader.createFeed({ title: 'Field <Notes>', url: 'https://notes.example/rss' });
  reader.bulkInsertArticles(feed.id, [
    { guid: 'a', title: 'AI Act & GPAI', link: 'https://notes.example/a', author: 'Ann Lee', content: '<p>Long body that is not exported.</p>', publishedAt: '2026-10-01T00:00:00Z' },
    { guid: 'b', title: 'Not saved', link: 'https://notes.example/b', content: '' },
  ]);
  const a = reader.findArticleByLink('https://notes.example/a').id;
  reader.updateArticle(a, { isBookmarked: true, note: 'Check <script>alert(1)</script> before the vote' });
  highlights.saveHighlight({ article_id: a, article_url: 'https://notes.example/a', highlighted_text: 'moved to August 2027', note: 'key date' });
  shelf = collections.createCollection({ name: 'EU AI' });
  collections.addToCollection(shelf.id, [a]);
});

test('notesOf: saves or one collection, each with its highlights (PR-14)', () => {
  const saves = notes.notesOf();
  assert.deepEqual(saves.rows.map((r) => r.title), ['AI Act & GPAI'], 'only saves');
  assert.deepEqual(saves.rows[0].highlights, [{ text: 'moved to August 2027', note: 'key date' }]);
  assert.equal(notes.notesOf({ collectionId: shelf.id }).title, 'EU AI');
  assert.equal(notes.notesOf({ collectionId: 9999 }), null);
});

test('Markdown has the note, highlights and citation, not the article text', () => {
  const md = notes.notesMarkdown(notes.notesOf(), new Date('2026-10-30T00:00:00Z'));
  assert.match(md, /^# Your saves\n/);
  assert.match(md, /Exported from Tenwise 2026-10-30: 1 article/);
  assert.match(md, /\*\*My note:\*\* Check <script>/);
  assert.match(md, /> moved to August 2027\n\n— key date/);
  assert.match(md, /Cite \(APA 7\): Lee, A\./);
  assert.doesNotMatch(md, /Long body/);
});

test('HTML escapes everything from the database', () => {
  const html = notes.notesHtml(notes.notesOf({ collectionId: shelf.id }));
  assert.match(html, /<h2>AI Act &amp; GPAI<\/h2>/);
  assert.match(html, /Check &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Field &lt;Notes&gt;/);
  assert.match(html, /<blockquote>moved to August 2027<\/blockquote>/);
  assert.match(html, /<a href="https:\/\/notes.example\/a">/);
  assert.doesNotMatch(html, /<script>/);
});

test('the collection Markdown for NotebookLM now has the highlights too', async () => {
  const { markdown } = await collectionExport.collectionMarkdown(shelf.id, { extract: async () => null });
  assert.match(markdown, /- Highlight: “moved to August 2027” \(my note: key date\)/);
});

test('GET /notes.md|html downloads it; a bad format or collection is refused', async () => {
  const { serveRouter } = await import('../routes/testServer.js');
  const { default: router } = await import('../routes/notesExport.js');
  const api = await serveRouter(router);
  try {
    const md = await api.get('/notes.md');
    assert.equal(md.status, 200);
    assert.match(md.headers.get('content-disposition'), /attachment; filename="your-saves-notes.md"/);
    const html = await api.get(`/notes.html?collection=${shelf.id}`);
    assert.match(html.headers.get('content-type'), /text\/html/);
    assert.match(html.headers.get('content-security-policy'), /default-src 'none'/);
    assert.match(html.headers.get('content-disposition'), /eu-ai-notes.html/);
    assert.equal((await api.get('/notes.exe')).status, 404);
    assert.equal((await api.get('/notes.md?collection=abc')).status, 400);
    assert.equal((await api.get('/notes.md?collection=9999')).status, 404);
  } finally {
    await api.close();
  }
});
