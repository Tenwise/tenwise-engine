// localStorage that never throws. Reading or writing it fails when storage is
// blocked (privacy settings, some embedded views); preferences then fall back
// to their defaults instead of crashing the app on its first render.

export function readStored(key, fallback = null, storage = globalThis.localStorage) {
  try {
    return storage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/** A stored number, or `fallback` when missing or not a finite number. */
export function readStoredNumber(key, fallback, storage = globalThis.localStorage) {
  const value = Number.parseInt(readStored(key, '', storage), 10);
  return Number.isFinite(value) ? value : fallback;
}

/** A stored JSON object, or `fallback` when missing, unreadable or not an object. */
export function readStoredObject(key, fallback = {}, storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(readStored(key, 'null', storage));
    return typeof value === 'object' && value !== null ? value : fallback;
  } catch {
    return fallback;
  }
}

const writeListeners = new Set();

/** Calls fn(key, value) after each writeStored to the browser's localStorage; returns the unsubscribe. */
export function onStoredWrite(fn) {
  writeListeners.add(fn);
  return () => writeListeners.delete(fn);
}

export function writeStored(key, value, storage = globalThis.localStorage) {
  try {
    storage.setItem(key, String(value));
  } catch { /* storage full or blocked: the preference just isn't remembered */ }
  if (storage === globalThis.localStorage) writeListeners.forEach((fn) => fn(key, String(value)));
}
