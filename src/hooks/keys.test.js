import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasModifier, isShortcut, isTyping } from './keys.js';

const key = (fields = {}) => ({ target: { tagName: 'DIV' }, metaKey: false, ctrlKey: false, altKey: false, ...fields });

test('typing targets: form fields and editable content', () => {
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) assert.ok(isTyping({ tagName }), tagName);
  assert.ok(isTyping({ tagName: 'DIV', isContentEditable: true }));
  assert.equal(isTyping({ tagName: 'DIV' }), false);
});

test('modified keys belong to the browser', () => {
  assert.ok(hasModifier(key({ metaKey: true })));
  assert.ok(hasModifier(key({ ctrlKey: true })));
  assert.ok(hasModifier(key({ altKey: true })));
  assert.equal(hasModifier(key()), false);
});

test('isShortcut: a plain key outside a field', () => {
  assert.ok(isShortcut(key()));
  assert.equal(isShortcut(key({ metaKey: true })), false);
  assert.equal(isShortcut(key({ target: { tagName: 'INPUT' } })), false);
});
