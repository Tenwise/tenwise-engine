import { useState } from 'react';
import { HiOutlineCheck } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { useAppearance } from '../../app/AppearanceContext.jsx';
import { FONTS } from '../../app/fonts.js';
import { PRESET_COLORS, textColorsFor } from './settingsModel.js';
import { Segmented } from './ui.jsx';

const RAINBOW = 'conic-gradient(red,yellow,lime,aqua,blue,magenta,red)';

export function ThemeControl() {
  const { theme, onToggleTheme } = useAppearance();
  const choose = (next) => { if (next !== theme) onToggleTheme(); };
  return <Segmented label="Theme" value={theme} onChange={choose} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />;
}

export function FontControl() {
  const { appFont, onChangeFont } = useAppearance();
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1.5">
      {FONTS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onChangeFont(f.id)}
          aria-pressed={appFont === f.id}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-0.5 rounded-md border bg-transparent px-2 py-2 text-foreground transition-colors hover:bg-[var(--bg-hover)]',
            appFont === f.id ? 'border-primary bg-[var(--accent-muted)]' : 'border-border',
          )}
        >
          <span className="text-xl leading-tight" style={{ fontFamily: f.stack }}>{f.sample || 'Ag'}</span>
          <span className="truncate text-[11px] text-muted-foreground">{f.label}</span>
        </button>
      ))}
    </div>
  );
}

function Swatch({ hex, label, selected, onClick }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={cn('flex size-7 cursor-pointer items-center justify-center rounded-full border-2 p-0', selected ? 'border-foreground' : 'border-transparent')}
      style={{ background: hex }}
    >
      {selected && <HiOutlineCheck className="size-3.5 text-[var(--bg-primary)] mix-blend-difference" />}
    </button>
  );
}

// Preset swatches plus a native picker for a custom color, which it remembers.
function Swatches({ presets, selected, customHex, fallbackHex, onChange, customLabel }) {
  const [picker, setPicker] = useState(customHex || fallbackHex);
  const isCustom = selected === 'custom';
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((c) => <Swatch key={c.id} hex={c.hex} label={c.label} selected={selected === c.id} onClick={() => onChange(c.id)} />)}
      <label className="relative" title={customLabel}>
        <Swatch hex={isCustom ? customHex : RAINBOW} label={customLabel} selected={isCustom} />
        <input
          type="color"
          aria-label={customLabel}
          value={picker}
          onChange={(e) => { setPicker(e.target.value); onChange(e.target.value); }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

export function AccentControl() {
  const { appColor, customAccentHex, onChangeColor } = useAppearance();
  return <Swatches presets={PRESET_COLORS} selected={appColor} customHex={customAccentHex} fallbackHex="#f59e0b" onChange={onChangeColor} customLabel="Custom accent color" />;
}

export function TextColorControl() {
  const { theme, appTextColor, customTextColorHex, onChangeTextColor } = useAppearance();
  const presets = textColorsFor(theme);
  return <Swatches presets={presets} selected={appTextColor} customHex={customTextColorHex} fallbackHex={presets[0].hex} onChange={onChangeTextColor} customLabel="Custom text color" />;
}
