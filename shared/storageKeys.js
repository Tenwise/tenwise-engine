// Saved settings and browser state are keyed `tenwise-…`. Before the project
// was named Tenwise they were keyed with the prefix below; settings saved
// under it are carried over once, so nobody loses their theme, fonts or AI
// settings. Shared by the browser (index.html keeps a copy of the loop) and
// the server (settings.js).

export const KEY_PREFIX = 'tenwise-';
export const LEGACY_KEY_PREFIX = 'atlas-pulse-';

/** The current name of a key saved under the old prefix, or the key itself. */
export const currentKey = (key) => (key.startsWith(LEGACY_KEY_PREFIX) ? KEY_PREFIX + key.slice(LEGACY_KEY_PREFIX.length) : key);

/**
 * An object's entries under their current names. A value already saved under
 * the current name wins over one under the old name.
 */
export function withCurrentKeys(values) {
  const out = {};
  for (const [key, value] of Object.entries(values)) if (!key.startsWith(LEGACY_KEY_PREFIX)) out[key] = value;
  for (const [key, value] of Object.entries(values)) {
    if (key.startsWith(LEGACY_KEY_PREFIX) && !Object.hasOwn(out, currentKey(key))) out[currentKey(key)] = value;
  }
  return out;
}
