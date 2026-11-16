import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatBlocks, inlineSpans } from './chatMarkdown.js';

test('inlineSpans: bold, italics and code as marks, the rest as written', () => {
  assert.deepEqual(inlineSpans('plain'), [{ text: 'plain' }]);
  assert.deepEqual(inlineSpans('**Sony:** a dog'), [{ text: 'Sony:', bold: true }, { text: ' a dog' }]);
  assert.deepEqual(inlineSpans('the *Version History* show'), [{ text: 'the ' }, { text: 'Version History', italic: true }, { text: ' show' }]);
  assert.deepEqual(inlineSpans('__a__ and _b_'), [{ text: 'a', bold: true }, { text: ' and ' }, { text: 'b', italic: true }]);
  assert.deepEqual(inlineSpans('run `npm **ci**`'), [{ text: 'run ' }, { text: 'npm **ci**', code: true }]);
  assert.deepEqual(inlineSpans('**the *Aibo* dog**'), [{ text: 'the ', bold: true }, { text: 'Aibo', bold: true, italic: true }, { text: ' dog', bold: true }]);
});

test('inlineSpans leaves what is not emphasis alone: snake_case, arithmetic, an unclosed mark', () => {
  assert.deepEqual(inlineSpans('snake_case_name'), [{ text: 'snake_case_name' }]);
  assert.deepEqual(inlineSpans('2 * 3 * 4'), [{ text: '2 * 3 * 4' }]);
  assert.deepEqual(inlineSpans('**Sony'), [{ text: '**Sony' }], 'mid-stream, before the closing mark arrives');
});

test('a link shows only its text; an image or a tag stays text', () => {
  assert.deepEqual(inlineSpans('see [the **site**](https://example.com/x)'), [{ text: 'see ' }, { text: 'the ' }, { text: 'site', bold: true }]);
  assert.deepEqual(inlineSpans('![pixel](https://evil.example/p.gif)'), [{ text: '!' }, { text: 'pixel' }]);
  assert.deepEqual(inlineSpans('<img src=x onerror=alert(1)>'), [{ text: '<img src=x onerror=alert(1)>' }]);
});

test('chatBlocks: a key-takeaways answer as a paragraph and a bullet list', () => {
  const answer = 'Based on the text, the key takeaways are:\n\n* **Vision:** robots everywhere.\n* **Aibo:** a pet.\n- *Context:* a podcast.';
  assert.deepEqual(chatBlocks(answer), [
    { type: 'p', lines: [[{ text: 'Based on the text, the key takeaways are:' }]] },
    { type: 'ul', items: [
      [{ text: 'Vision:', bold: true }, { text: ' robots everywhere.' }],
      [{ text: 'Aibo:', bold: true }, { text: ' a pet.' }],
      [{ text: 'Context:', italic: true }, { text: ' a podcast.' }],
    ] },
  ]);
});

test('chatBlocks: numbered lists keep their start, headings stand alone, rules and blanks split paragraphs', () => {
  assert.deepEqual(chatBlocks('## Steps\n3. three\n4) four\n\nOne\ntwo\n---\nThree'), [
    { type: 'h', spans: [{ text: 'Steps' }] },
    { type: 'ol', start: 3, items: [[{ text: 'three' }], [{ text: 'four' }]] },
    { type: 'p', lines: [[{ text: 'One' }], [{ text: 'two' }]] },
    { type: 'p', lines: [[{ text: 'Three' }]] },
  ]);
  assert.deepEqual(chatBlocks(''), []);
  assert.deepEqual(chatBlocks(undefined), []);
  assert.deepEqual(chatBlocks('**Bold** start'), [{ type: 'p', lines: [[{ text: 'Bold', bold: true }, { text: ' start' }]] }], 'bold at the start is not a bullet');
});
