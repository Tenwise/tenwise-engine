// Pure helpers for theming: custom color math and how a choice is parsed.

export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function adjustHexBrightness(hex, amount) {
  const channel = (i) => Math.min(255, Math.max(0, parseInt(hex.slice(i, i + 2), 16) + amount));
  return `#${[1, 3, 5].map((i) => channel(i).toString(16).padStart(2, '0')).join('')}`;
}

/** CSS custom properties for a custom accent color. */
export function accentVars(hex) {
  return {
    '--accent': hex,
    '--accent-hover': adjustHexBrightness(hex, 20),
    '--accent-muted': hexToRgba(hex, 0.15),
    '--accent-border': hexToRgba(hex, 0.3),
    '--shadow-glow': `0 0 20px ${hexToRgba(hex, 0.1)}`,
  };
}

/** A color choice is either a preset id or a '#rrggbb' custom value. */
export function parseColorChoice(choice) {
  return choice.startsWith('#') ? { preset: 'custom', hex: choice } : { preset: choice, hex: null };
}
