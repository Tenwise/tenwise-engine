import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLineKind, markdownToDocxBlob } from './docx.js';

test('markdownLineKind classifies lines in the documented order', () => {
  const cases = {
    '': 'blank', '   ': 'blank',
    '# Title': 'h1', '## Section': 'h2', '### Sub': 'h3', '#### Deeper': 'text',
    '- item': 'bullet', '* item': 'bullet', '*emphasis*': 'text',
    '1. first': 'numbered', '12. twelfth': 'numbered',
    '---': 'rule', '-----': 'rule', '--- not a rule': 'text',
    'Plain **bold** text': 'text',
  };
  for (const [line, kind] of Object.entries(cases)) assert.equal(markdownLineKind(line), kind, JSON.stringify(line));
});

test('markdown becomes a real .docx (the library loads on demand)', async () => {
  const blob = await markdownToDocxBlob('# Title\n\nSome **bold** text.\n\n- one\n1. two\n---');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.ok(bytes.length > 1000);
  assert.deepEqual([...bytes.slice(0, 2)], [0x50, 0x4b]); // a zip ("PK"), as .docx files are
});
