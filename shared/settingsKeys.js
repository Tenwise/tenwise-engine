// Settings kept in data/settings.json on the server (so they follow you to any
// browser), as opposed to per-device layout state (sidebar and pane widths,
// list/rail visibility, scroll positions) that stays in this browser only.
// Shared by the browser (src/) and the server (server/).

export const SYNCED_SETTING_KEYS = [
  'tenwise-settings-mode',      // 'simple' | 'power'
  'tenwise-theme',
  'tenwise-font',
  'tenwise-color',
  'tenwise-custom-color',
  'tenwise-text',
  'tenwise-custom-text',
  'tenwise-appearance-version',
  'tenwise-view-mode',
  'tenwise-reader-settings',
  'tenwise-auto-refresh',
  'tenwise-ai-settings',
  'tenwise-batch-ai',
  'tenwise-prompts',            // edited prompt texts, by prompt id
  'tenwise-ai-limits',          // edited AI size limits
];

const SYNCED = new Set(SYNCED_SETTING_KEYS);

/** Whether a storage key is a synced setting. */
export const isSyncedSetting = (key) => SYNCED.has(key);

/** Longest value accepted for one setting (prompts are the long ones). */
export const MAX_SETTING_LENGTH = 64 * 1024;
