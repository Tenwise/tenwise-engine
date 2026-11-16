import { readStoredNumber, writeStored } from './storage.js';

export const DEFAULT_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes (legacy, kept for fallback)

export const AUTO_REFRESH_OPTIONS = [
  { label: 'Off',        value: 0   },
  { label: '15 minutes', value: 15  },
  { label: '30 minutes', value: 30  },
  { label: '1 hour',     value: 60  },
  { label: '2 hours',    value: 120 },
];

export function getAutoRefreshMinutes() {
  return readStoredNumber('tenwise-auto-refresh', 30);
}

export function saveAutoRefreshMinutes(minutes) {
  writeStored('tenwise-auto-refresh', minutes);
}

export const HIGHLIGHT_COLORS = {
  yellow: '#fef08a',
  green:  '#bbf7d0',
  blue:   '#bfdbfe',
  pink:   '#fecdd3',
};

export const VIEW_TYPES = {
  ALL: 'all',
  TODAY: 'today',
  SAVED: 'saved',
  FEED: 'feed',
  FOLDER: 'folder',
  LIBRARY: 'library',
};
