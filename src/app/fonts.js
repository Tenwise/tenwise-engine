// The one font list, shared by the app font (Settings → Appearance) and the
// reader font (the "Aa" menu). Faces are self-hosted in src/styles/fonts.css.

export const FONTS = [
  { id: 'plex',         label: 'IBM Plex Sans', stack: "'IBM Plex Sans Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { id: 'newsreader',   label: 'Newsreader',   stack: "'Newsreader Variable', Georgia, serif" },
  { id: 'sans',         label: 'Inter',        stack: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { id: 'poppins',      label: 'Poppins',      stack: "'Poppins', sans-serif" },
  { id: 'lato',         label: 'Lato',         stack: "'Lato', sans-serif" },
  { id: 'nunito',       label: 'Nunito',       stack: "'Nunito Variable', sans-serif" },
  { id: 'merriweather', label: 'Merriweather', stack: "'Merriweather Variable', Georgia, serif" },
  { id: 'garamond',     label: 'Garamond',     stack: "'EB Garamond Variable', Garamond, serif" },
  { id: 'playfair',     label: 'Playfair',     stack: "'Playfair Display Variable', Georgia, serif" },
  { id: 'source-serif', label: 'Source Serif', stack: "'Source Serif 4 Variable', Georgia, serif" },
  { id: 'georgia',      label: 'Georgia',      stack: "Georgia, 'Times New Roman', serif" },
  { id: 'times',        label: 'Times',        stack: "'Times New Roman', Times, serif" },
  { id: 'plex-mono',    label: 'Plex Mono',    stack: "'IBM Plex Mono', 'Courier New', monospace", sample: '01' },
  { id: 'mono',         label: 'JetBrains Mono', stack: "'JetBrains Mono Variable', 'Fira Code', 'Courier New', monospace", sample: '01' },
  { id: 'system',       label: 'System',       stack: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' },
];

// The app font list used to call Merriweather 'serif'; saved settings may still say so.
const LEGACY_IDS = { serif: 'merriweather' };

/** The font for a saved id, falling back to the default (IBM Plex Sans) for unknown ids. */
export function fontById(id) {
  const key = LEGACY_IDS[id] || id;
  return FONTS.find((f) => f.id === key) || FONTS[0]; // FONTS[0] is IBM Plex Sans
}
