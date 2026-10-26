import { fontById } from '../app/fonts.js';
import { readStored } from './storage.js';

export const LINE_HEIGHTS = [
  { id: 'compact', label: 'Compact', value: 1.5 },
  { id: 'normal', label: 'Normal', value: 1.8 },
  { id: 'relaxed', label: 'Relaxed', value: 2.1 },
];

export const CONTENT_WIDTHS = [
  { id: 'narrow', label: 'Narrow', value: 600 },
  { id: 'normal', label: 'Normal', value: 700 },
  { id: 'wide', label: 'Wide', value: 880 },
];

export const READER_SETTINGS_STORAGE_KEY = 'tenwise-reader-settings';

export const DEFAULT_READER_SETTINGS = {
  fontFamily: 'newsreader',
  fontSize: 18,
  lineHeight: 'normal',
  contentWidth: 'normal',
};

export function getReaderSettings() {
  try {
    const stored = readStored(READER_SETTINGS_STORAGE_KEY);
    if (stored) return { ...DEFAULT_READER_SETTINGS, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return DEFAULT_READER_SETTINGS;
}

export function getReaderCSSVars(settings) {
  const lh = LINE_HEIGHTS.find(l => l.id === settings.lineHeight) || LINE_HEIGHTS[1];
  const cw = CONTENT_WIDTHS.find(w => w.id === settings.contentWidth) || CONTENT_WIDTHS[1];

  return {
    '--reader-font-family': fontById(settings.fontFamily).stack,
    '--reader-font-size': `${settings.fontSize}px`,
    '--reader-line-height': lh.value,
    '--reader-max-width': `${cw.value}px`,
  };
}
