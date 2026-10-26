// App-wide commands for components that own their own state (the list's view
// mode, the reader's AI rail), so the command palette can reach them without
// lifting that state up.

const PREFIX = 'tenwise:';

/** Sends a command, e.g. emit('view-mode', 'rows'). */
export function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(PREFIX + name, { detail }));
}

/** Subscribes to a command; returns the unsubscribe function. */
export function on(name, handler) {
  const listener = (e) => handler(e.detail);
  window.addEventListener(PREFIX + name, listener);
  return () => window.removeEventListener(PREFIX + name, listener);
}
