// Keeps the synced settings (shared/settingsKeys.js) in data/settings.json on
// the server, so they follow you to any browser. localStorage stays the
// working copy that the app reads synchronously (and the boot script in
// index.html reads before React loads); this module fills it from the server
// at startup and sends every change back.
import { isSyncedSetting, SYNCED_SETTING_KEYS } from '../../shared/settingsKeys.js';
import { fetchSettings, saveSettings } from '../utils/api.js';
import { onStoredWrite, readStored, writeStored } from '../utils/storage.js';

const BOOT_TIMEOUT_MS = 1500;
const PUSH_DELAY_MS = 300;

/**
 * What to copy at startup. The server wins once it has any settings; before
 * that (first run with the file), this browser's settings seed it.
 */
export function planBoot(serverValues, readLocal) {
  const fromServer = Object.entries(serverValues).filter(([key]) => isSyncedSetting(key));
  if (fromServer.length > 0) {
    return { toLocal: Object.fromEntries(fromServer.filter(([key, value]) => readLocal(key) !== value)), toServer: {} };
  }
  const local = SYNCED_SETTING_KEYS.map((key) => [key, readLocal(key)]).filter(([, value]) => value !== null);
  return { toLocal: {}, toServer: Object.fromEntries(local) };
}

// Batches writes made in quick succession into one save.
function createPusher(save, delay = PUSH_DELAY_MS) {
  let pending = {};
  let timer = null;
  const flush = () => {
    const values = pending;
    pending = {};
    timer = null;
    save(values).catch((err) => console.warn('[settings] not saved to the server:', err.message));
  };
  return (key, value) => {
    pending[key] = value;
    clearTimeout(timer);
    timer = setTimeout(flush, delay);
  };
}

let path = null;
/** Where the settings file lives (once loaded), for the settings screen. */
export const settingsPath = () => path;

/**
 * Loads settings from the server into localStorage, then sends every later
 * change of a synced setting back. If the server doesn't answer quickly, the
 * app starts with this browser's settings and still syncs changes.
 */
export async function loadSettings() {
  const push = createPusher(saveSettings);
  try {
    const { values, path: filePath } = await fetchSettings(AbortSignal.timeout(BOOT_TIMEOUT_MS));
    path = filePath;
    const plan = planBoot(values, (key) => readStored(key));
    Object.entries(plan.toLocal).forEach(([key, value]) => writeStored(key, value));
    if (Object.keys(plan.toServer).length > 0) await saveSettings(plan.toServer);
  } catch (err) {
    console.warn('[settings] using this browser\'s settings:', err.message);
  }
  onStoredWrite((key, value) => { if (isSyncedSetting(key)) push(key, value); });
}
