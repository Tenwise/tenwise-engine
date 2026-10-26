import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFromHtml } from '@extractus/article-extractor';
import { extractArticle, largestInSrcset, prepareForExtraction } from './articleExtractor.js';
import { setPlugins } from '../plugins.js';

const IMAGE = 'https://miro.medium.com/v2/resize:fit:1400/1*abc.png';

// A Medium figure, trimmed: the URLs are only on the <source> tags, and the
// "view full size" hint is marked speechify-ignore.
const MEDIUM_FIGURE = `<figure><div role="button" tabindex="0"><span class="dr speechify-ignore">Press enter or click to view image in full size</span>
<div><picture><source srcSet="https://miro.medium.com/v2/resize:fit:640/format:webp/1*abc.png 640w, https://miro.medium.com/v2/resize:fit:1400/format:webp/1*abc.png 1400w" type="image/webp"/>
<source srcSet="https://miro.medium.com/v2/resize:fit:640/1*abc.png 640w, ${IMAGE} 1400w"/>
<img alt="" width="700" height="394" loading="lazy" role="presentation"/></picture></div></div>
<figcaption>Figure 1: a chart</figcaption></figure>`;

// Medium's byline, trimmed: author photo, read time, date and the clap count.
const MEDIUM_BYLINE = `<div class="speechify-ignore ab cp"><img alt="Sean Moran" src="https://miro.medium.com/a.png" data-testid="authorPhoto"/>
<span data-testid="storyReadTime">15 min read</span><span data-testid="storyPublishDate">Oct 11, 2026</span>
<div class="pw-multi-vote-count"><p><span>--</span></p></div></div>`;

const PARAGRAPH = `<p>${'The article body runs long enough for the extractor to keep it as content. '.repeat(6)}</p>`;
const page = (...parts) => `<html><head><title>A post</title></head><body><article>${parts.join('')}${PARAGRAPH}</article></body></html>`;

test('largestInSrcset picks the widest or densest candidate', () => {
  assert.equal(largestInSrcset('a.png 640w, b.png 1400w, c.png 720w'), 'b.png');
  assert.equal(largestInSrcset('a.png 1x, b.png 2x'), 'b.png');
  assert.equal(largestInSrcset('https://e.com/w_640,c_fill/a.png 640w'), 'https://e.com/w_640,c_fill/a.png');
  assert.equal(largestInSrcset('only.png'), 'only.png');
  assert.equal(largestInSrcset(''), '');
  assert.equal(largestInSrcset(undefined), '');
});

test('prepareForExtraction gives a <picture> image with no src its first source', () => {
  const html = prepareForExtraction(page(PARAGRAPH, MEDIUM_FIGURE));
  assert.match(html, /<img [^>]*src="https:\/\/miro\.medium\.com\/v2\/resize:fit:1400\/format:webp\/1\*abc\.png"/);
});

test('prepareForExtraction drops page furniture: figure hints, read time, date, claps', () => {
  const html = prepareForExtraction(page(MEDIUM_BYLINE, PARAGRAPH, MEDIUM_FIGURE));
  for (const clutter of ['Press enter or click', '15 min read', 'Oct 11, 2026', 'pw-multi-vote-count']) {
    assert.ok(!html.includes(clutter), clutter);
  }
  // The author photo stays: without it Readability drops Medium's subtitle.
  assert.match(html, /data-testid="authorPhoto"/);
  assert.match(html, /Figure 1: a chart/);
  assert.match(html, /The article body runs long enough/);
});

test('prepareForExtraction keeps speechify-ignore text outside figures', () => {
  const html = prepareForExtraction(page(PARAGRAPH, '<p class="speechify-ignore">Kept aside</p>', MEDIUM_FIGURE));
  assert.match(html, /Kept aside/);
});

test('prepareForExtraction leaves pages with nothing to change as they were', () => {
  const noPicture = page(PARAGRAPH, `<figure><img src="${IMAGE}" alt=""></figure>`);
  assert.equal(prepareForExtraction(noPicture), noPicture);
  const alreadySet = page(PARAGRAPH, `<picture><source srcset="${IMAGE} 1400w"><img src="https://e.com/own.png" alt=""></picture>`);
  assert.equal(prepareForExtraction(alreadySet), alreadySet);
});

test('a Medium article keeps its images and loses the page clutter through extraction', async () => {
  const article = await extractFromHtml(prepareForExtraction(page(MEDIUM_BYLINE, PARAGRAPH, MEDIUM_FIGURE)), 'https://pub.example.com/a-post');
  assert.match(article.content, /<img [^>]*src="https:\/\/miro\.medium\.com\/v2\/resize:fit:1400/);
  assert.match(article.content, /Figure 1: a chart/);
  assert.doesNotMatch(article.content, /Press enter or click|min read|Oct 11, 2026/);
});

const failureOf = (promise) => promise.then(() => assert.fail('expected a failure'), (error) => ({ reason: error.reason, site: error.site, message: error.message }));

test('a site that turns apps away is reported as blocked, by status or by its bot check page', async () => {
  const awsWaf = async () => { throw Object.assign(new Error('Status code 405'), { status: 405 }); };
  assert.deepEqual(await failureOf(extractArticle('https://arstechnica.com/culture/a/', awsWaf)), {
    reason: 'blocked', site: 'arstechnica.com', message: 'Article extraction failed: Status code 405',
  });
  // SiteGround answers 202 with a page that refreshes into its captcha.
  const siteGround = async (url) => ({ url, text: '<html><head><meta http-equiv="refresh" content="0;/.well-known/sgcaptcha/?r=%2Fa%2F"></meta></head></html>' });
  assert.deepEqual(await failureOf(extractArticle('https://www.cphpost.dk/a/', siteGround)), {
    reason: 'blocked', site: 'cphpost.dk', message: 'Article extraction failed: The site asked for a browser check',
  });
});

// Plugins (server/plugins.js) may point a link at another page, or refuse it with a reason.
test('a plugin can rewrite the link to extract, or say why it cannot be read', async (t) => {
  t.after(() => setPlugins([]));
  setPlugins([{
    resolveArticleUrl: async (url) => {
      if (url.includes('/refuse')) throw Object.assign(new Error('No link to follow'), { reason: 'aggregator', site: 'agg.example' });
      return url.startsWith('https://agg.example/') ? 'https://pub.example.com/a-post' : '';
    },
  }]);
  const requested = [];
  const fetchPage = async (url) => { requested.push(url); return { url, text: page() }; };
  const article = await extractArticle('https://agg.example/item/1', fetchPage);
  assert.equal(article.url, 'https://pub.example.com/a-post');
  assert.deepEqual(requested, ['https://pub.example.com/a-post']);
  assert.deepEqual(await failureOf(extractArticle('https://agg.example/refuse', fetchPage)), {
    reason: 'aggregator', site: 'agg.example', message: 'Article extraction failed: No link to follow',
  });
  await extractArticle('https://e.com/plain', fetchPage);
  assert.equal(requested.at(-1), 'https://e.com/plain');
});

test('a page without an article, and any other failure, say so', async () => {
  const empty = async (url) => ({ url, text: '<html><body><nav>Home</nav></body></html>' });
  assert.equal((await failureOf(extractArticle('https://e.com/a', empty))).reason, 'no-article');
  const notFound = async () => { throw Object.assign(new Error('Status code 404'), { status: 404 }); };
  assert.deepEqual(await failureOf(extractArticle('https://e.com/gone', notFound)), {
    reason: 'failed', site: 'e.com', message: 'Article extraction failed: Status code 404',
  });
});

