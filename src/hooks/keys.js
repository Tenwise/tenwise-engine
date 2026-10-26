// Shared checks for the app's single-key shortcuts.

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** True while the user is typing into a field, where shortcuts must not fire. */
export function isTyping(target) {
  return TYPING_TAGS.has(target.tagName) || Boolean(target.isContentEditable);
}

/** True for ⌘/Ctrl/Alt combinations, which belong to the browser (⌘F, Ctrl+K…). */
export function hasModifier(event) {
  return [event.metaKey, event.ctrlKey, event.altKey].some(Boolean);
}

/** Whether a plain shortcut key should be handled: not typing, no modifier. */
export function isShortcut(event) {
  return !isTyping(event.target) && !hasModifier(event);
}
