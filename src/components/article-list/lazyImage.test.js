import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { imageFor, resetImages } from './lazyImage.js';

beforeEach(resetImages);

test('imageFor asks a few at a time and once per article (UX-8)', async () => {
  let inFlight = 0;
  let most = 0;
  const asked = [];
  const fetchImage = async (id) => {
    asked.push(id);
    inFlight += 1; most = Math.max(most, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
    return { imageUrl: id % 2 ? `https://img.example/${id}.jpg` : null };
  };
  const urls = await Promise.all([1, 2, 3, 4, 5, 6, 7].map((id) => imageFor(id, fetchImage)));
  assert.deepEqual(urls, ['https://img.example/1.jpg', null, 'https://img.example/3.jpg', null, 'https://img.example/5.jpg', null, 'https://img.example/7.jpg']);
  assert.equal(most, 3);
  assert.equal(await imageFor(3, fetchImage), 'https://img.example/3.jpg');
  assert.equal(await imageFor(2, fetchImage), null, 'none found is remembered too');
  assert.equal(asked.length, 7);
});

test('a failed request counts as no picture', async () => {
  assert.equal(await imageFor(9, async () => { throw new Error('offline'); }), null);
});
