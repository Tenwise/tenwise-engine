// The settings screen, as data: its sections, and every setting in them with
// the control that edits it. SettingsScreen renders this list, so a new
// setting is one entry here. level 'simple' settings show in both modes;
// 'power' ones only in Power mode. Plugins add whole sections (the
// `settingsSections` slot, src/plugins/index.js) and settings in the app's
// sections (the `settings` slot), after the app's own.
import {
  HiOutlineBookOpen, HiOutlineCircleStack, HiOutlineCommandLine, HiOutlineCpuChip, HiOutlineInformationCircle,
  HiOutlineSwatch,
} from 'react-icons/hi2';
import { pluginsOf } from '../../plugins/index.js';
import { AccentControl, FontControl, TextColorControl, ThemeControl } from './appearance.jsx';
import { EngineControl } from './engines.jsx';
import { ClearAllControl, ExportOPMLControl, ImportOPMLControl, SettingsFileControl } from './data.jsx';
import { LimitsEditor, PromptsEditor } from './prompts.jsx';
import {
  AutoRefreshControl, ContentWidthControl, LineHeightControl, ReaderFontControl, ReaderSizeControl, ViewModeControl,
} from './reading.jsx';

// Each plugin section goes right after the section it names in `after`.
const PLUGIN_SECTIONS = pluginsOf('settingsSections');
const withPluginSections = (sections) => sections.flatMap((section) => [
  section,
  ...PLUGIN_SECTIONS.filter((p) => p.after === section.id).map(({ id, label, Icon }) => ({ id, label, Icon })),
]);

export const SECTIONS = withPluginSections([
  { id: 'appearance', label: 'Appearance', Icon: HiOutlineSwatch },
  { id: 'reading', label: 'Reading', Icon: HiOutlineBookOpen },
  { id: 'engines', label: 'AI engines', Icon: HiOutlineCpuChip },
  { id: 'prompts', label: 'Prompts', Icon: HiOutlineCommandLine },
  { id: 'data', label: 'Data', Icon: HiOutlineCircleStack },
  { id: 'about', label: 'About', Icon: HiOutlineInformationCircle },
]);

const S = 'simple';
const P = 'power';

export const SETTINGS = [
  { id: 'theme', section: 'appearance', level: S, label: 'Theme', Control: ThemeControl },
  { id: 'font', section: 'appearance', level: S, label: 'Interface font', stacked: true, Control: FontControl },
  { id: 'accent', section: 'appearance', level: S, label: 'Accent color', Control: AccentControl },
  { id: 'text-color', section: 'appearance', level: P, label: 'Text color', Control: TextColorControl },

  { id: 'view-mode', section: 'reading', level: S, label: 'List view', hint: 'Rows is the dense default; Grid, List and Compact are alternatives.', Control: ViewModeControl },
  { id: 'reader-size', section: 'reading', level: S, label: 'Reader text size', hint: 'Also in the reader’s Aa menu.', Control: ReaderSizeControl },
  { id: 'reader-font', section: 'reading', level: P, label: 'Reader font', Control: ReaderFontControl },
  { id: 'line-height', section: 'reading', level: P, label: 'Line spacing', Control: LineHeightControl },
  { id: 'content-width', section: 'reading', level: P, label: 'Reading column width', Control: ContentWidthControl },
  { id: 'auto-refresh', section: 'reading', level: S, label: 'Auto-refresh feeds', Control: AutoRefreshControl },

  { id: 'engines', section: 'engines', level: S, label: 'Engines', hint: 'Gemini Nano runs inside Chrome; Ollama runs larger models on your machine.', stacked: true, Control: EngineControl },

  { id: 'prompts', section: 'prompts', level: P, label: 'Prompts', hint: 'Every instruction the app sends to the model. Edits apply immediately; reset returns a prompt to its default.', stacked: true, Control: PromptsEditor },
  { id: 'limits', section: 'prompts', level: P, label: 'Text sent to the model (characters)', hint: 'More text gives the model more to work with, but is slower; Gemini Nano shortens anything that doesn’t fit.', stacked: true, Control: LimitsEditor },

  { id: 'export-opml', section: 'data', level: S, label: 'Export feeds and folders', hint: 'As OPML, for another reader or a backup.', Control: ExportOPMLControl },
  { id: 'import-opml', section: 'data', level: S, label: 'Import feeds', hint: 'From an OPML file.', Control: ImportOPMLControl },
  { id: 'settings-file', section: 'data', level: P, label: 'Settings file', hint: 'Plain JSON beside your databases: back it up, edit it, or copy it to another machine.', stacked: true, Control: SettingsFileControl },
  { id: 'clear-all', section: 'data', level: S, label: 'Delete all feeds, articles and folders', hint: 'Your saves and their notes are deleted too, and collections are emptied. The AI Summaries library, highlights and anything you made from your articles are kept.', Control: ClearAllControl },

  { id: 'about', section: 'about', level: S, label: 'Tenwise', hint: 'Fast scanning, calm reading, and cited AI summaries of the sources that matter to you. A product of CodeStrata, Inc.' },
  ...pluginsOf('settings'),
  ...PLUGIN_SECTIONS.flatMap((p) => p.settings.map((setting) => ({ ...setting, section: p.id }))),
];

/** The settings shown in a mode: Simple shows only 'simple' ones, Power shows all. */
export const visibleIn = (mode) => (mode === 'simple' ? SETTINGS.filter((s) => s.level === S) : SETTINGS);

/** Sections that have at least one of the given settings. */
export const sectionsWith = (settings) => SECTIONS.filter((sec) => settings.some((s) => s.section === sec.id));

/** Settings whose label, hint or section match every word of the query. */
export function searchSettings(settings, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const sectionLabel = new Map(SECTIONS.map((s) => [s.id, s.label]));
  return settings.filter((s) => {
    const text = `${s.label} ${s.hint ?? ''} ${sectionLabel.get(s.section)}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}
