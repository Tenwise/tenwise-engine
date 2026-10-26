import { useState } from 'react';
import { emit } from '../../lib/appEvents.js';
import { VIEW_MODES } from '../article-list/viewModes.js';
import { AUTO_REFRESH_OPTIONS, getAutoRefreshMinutes, saveAutoRefreshMinutes } from '../../utils/constants.js';
import {
  CONTENT_WIDTHS, getReaderSettings, LINE_HEIGHTS, READER_SETTINGS_STORAGE_KEY,
} from '../../utils/readerSettings.js';
import { FONTS } from '../../app/fonts.js';
import { readStored, writeStored } from '../../utils/storage.js';
import { Segmented, Select } from './ui.jsx';

const VIEW_MODE_KEY = 'tenwise-view-mode';
const FONT_SIZES = [15, 16, 17, 18, 19, 20, 22].map((n) => ({ value: n, label: `${n}` }));

export function ViewModeControl() {
  const [mode, setMode] = useState(() => readStored(VIEW_MODE_KEY, 'rows'));
  const change = (next) => {
    setMode(next);
    writeStored(VIEW_MODE_KEY, next); // for when the list isn't on screen
    emit('view-mode', next);
  };
  return <Segmented label="List view" value={mode} onChange={change} options={VIEW_MODES.map((m) => ({ value: m.id, label: m.label }))} />;
}

// The server reads this setting from settings.json and refreshes on its own.
export function AutoRefreshControl() {
  const [minutes, setMinutes] = useState(getAutoRefreshMinutes);
  const change = (value) => {
    saveAutoRefreshMinutes(value);
    setMinutes(value);
  };
  return <Segmented label="Auto-refresh" value={minutes} onChange={change} options={AUTO_REFRESH_OPTIONS} />;
}

// Reader typography, shared with the reader's "Aa" menu (and the open reader, via an event).
function useReaderSetting(key) {
  const [settings, setSettings] = useState(getReaderSettings);
  const change = (value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    writeStored(READER_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    emit('reader-settings', next);
  };
  return [settings[key], change];
}

export function ReaderSizeControl() {
  const [size, change] = useReaderSetting('fontSize');
  return <Segmented label="Reader text size" value={size} onChange={change} options={FONT_SIZES} />;
}

export function ReaderFontControl() {
  const [font, change] = useReaderSetting('fontFamily');
  return (
    <Select label="Reader font" value={font} onChange={change}>
      {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
    </Select>
  );
}

export function LineHeightControl() {
  const [lineHeight, change] = useReaderSetting('lineHeight');
  return <Segmented label="Line spacing" value={lineHeight} onChange={change} options={LINE_HEIGHTS.map((l) => ({ value: l.id, label: l.label }))} />;
}

export function ContentWidthControl() {
  const [width, change] = useReaderSetting('contentWidth');
  return <Segmented label="Column width" value={width} onChange={change} options={CONTENT_WIDTHS.map((w) => ({ value: w.id, label: `${w.label} · ${w.value}px` }))} />;
}
