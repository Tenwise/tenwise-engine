import { HiOutlineMinusSmall, HiOutlinePlusSmall } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/icon-button';
import { FONTS } from '../../app/fonts.js';
import { emit } from '../../lib/appEvents.js';
import {
  CONTENT_WIDTHS, DEFAULT_READER_SETTINGS, LINE_HEIGHTS, READER_SETTINGS_STORAGE_KEY,
} from '../../utils/readerSettings.js';
import { writeStored } from '../../utils/storage.js';
import Popover from './Popover.jsx';

const FONT_SIZE = { min: 12, max: 28 };

function Section({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--text-tertiary)]">{label}</span>
      {children}
    </div>
  );
}

function Chips({ options, value, onChange, styleFor }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          style={styleFor?.(o)}
          className={cn('h-7 cursor-pointer rounded-md border px-2 text-xs transition-colors', value === o.id ? 'border-primary bg-[var(--accent-muted)] text-foreground' : 'border-border bg-transparent text-muted-foreground hover:text-foreground')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SizeControl({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <IconButton onClick={() => onChange(Math.max(FONT_SIZE.min, value - 1))} disabled={value <= FONT_SIZE.min} title="Smaller"><HiOutlineMinusSmall /></IconButton>
      <span className="w-12 text-center font-mono text-xs text-foreground">{value}px</span>
      <IconButton onClick={() => onChange(Math.min(FONT_SIZE.max, value + 1))} disabled={value >= FONT_SIZE.max} title="Larger"><HiOutlinePlusSmall /></IconButton>
    </div>
  );
}

/** "Aa" menu for reader typography: font, size, spacing, width. Kept in step with Settings. */
export default function ReaderSettingsMenu({ settings, onSettingsChange }) {
  const apply = (next) => {
    onSettingsChange(next);
    writeStored(READER_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    emit('reader-settings', next);
  };
  const set = (key) => (value) => apply({ ...settings, [key]: value });
  return (
    <Popover
      className="flex w-80 flex-col gap-4 p-4"
      trigger={({ open, toggle }) => (
        <IconButton active={open} onClick={toggle} title="Reader typography" className="w-8 font-serif text-[13px] font-semibold">Aa</IconButton>
      )}
    >
      {() => (
        <>
          <Section label="Font"><Chips options={FONTS} value={settings.fontFamily} onChange={set('fontFamily')} styleFor={(f) => ({ fontFamily: f.stack })} /></Section>
          <Section label="Size"><SizeControl value={settings.fontSize} onChange={set('fontSize')} /></Section>
          <Section label="Spacing"><Chips options={LINE_HEIGHTS} value={settings.lineHeight} onChange={set('lineHeight')} /></Section>
          <Section label="Width"><Chips options={CONTENT_WIDTHS} value={settings.contentWidth} onChange={set('contentWidth')} /></Section>
          <button type="button" onClick={() => apply(DEFAULT_READER_SETTINGS)} className="cursor-pointer self-start border-0 bg-transparent p-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Reset to defaults</button>
        </>
      )}
    </Popover>
  );
}
