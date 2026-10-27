import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './db/connection.js';
import { isSyncedSetting, MAX_SETTING_LENGTH, SYNCED_SETTING_KEYS } from '../shared/settingsKeys.js';

// Settings live in one JSON file beside the databases: readable, hand-editable
// and easy to back up. Values are the strings the browser stores.
export const SETTINGS_PATH = join(DATA_DIR, 'settings.json');

const isObject = (v) => typeof v === 'object' && v !== null;
const isPlainObject = (v) => isObject(v) && !Array.isArray(v);

/** All saved settings ({} before the first save, or if the file is unreadable). */
export function readSettings(path = SETTINGS_PATH) {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// Why a change can't be saved, or null if it can.
function problemWith(key, value) {
  if (!isSyncedSetting(key)) return `Unknown setting: ${key}`;
  if (value === null) return null; // null removes the setting
  if (typeof value !== 'string') return `${key} must be a string`;
  return value.length > MAX_SETTING_LENGTH ? `${key} is too long` : null;
}

/** Checks a { key: string | null } change set; throws a 400-style error on the first bad entry. */
export function validateChanges(changes) {
  if (!isPlainObject(changes)) throw Object.assign(new Error('values must be an object'), { status: 400 });
  for (const [key, value] of Object.entries(changes)) {
    const problem = problemWith(key, value);
    if (problem) throw Object.assign(new Error(problem), { status: 400 });
  }
}

// The value a key ends up with: its change if there is one (null removes it), else its current value.
const valueAfter = (key, changes, current) => (Object.hasOwn(changes, key) ? changes[key] : current[key]);

/**
 * Applies a change set (null deletes) and writes the file atomically. The
 * file is rebuilt from the known keys only, so it never holds anything else.
 * Returns all settings.
 */
export function updateSettings(changes, path = SETTINGS_PATH) {
  validateChanges(changes);
  const current = readSettings(path);
  const next = {};
  for (const key of SYNCED_SETTING_KEYS) {
    const value = valueAfter(key, changes, current);
    if (typeof value === 'string') next[key] = value;
  }
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
  renameSync(tmp, path);
  return next;
}
