import { useMemo, useState } from 'react';
import { HiOutlineMagnifyingGlass, HiOutlineXMark } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { usePersistedChoice } from '../../app/useLayout.js';
import { useToast } from '../../app/ToastContext.jsx';
import { SettingsEnv } from './env.js';
import { searchSettings, sectionsWith, visibleIn } from './registry.js';
import { Row, Segmented } from './ui.jsx';

const MODE_KEY = 'tenwise-settings-mode';
const MODES = [{ value: 'simple', label: 'Simple' }, { value: 'power', label: 'Power' }];

function SettingRows({ settings }) {
  return settings.map(({ id, label, hint, stacked, Control }) => (
    <Row key={id} label={label} hint={hint} stacked={stacked}>{Control && <Control />}</Row>
  ));
}

function SectionNav({ sections, current, onSelect }) {
  return (
    <nav aria-label="Settings sections" className="flex flex-col gap-0.5 border-r border-border p-2">
      {sections.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          aria-current={current === id ? 'page' : undefined}
          className={cn(
            'flex cursor-pointer items-center gap-2.5 rounded-md border-0 px-2.5 py-1.5 text-left text-[13px] transition-colors',
            current === id ? 'bg-[var(--bg-active)] text-foreground' : 'bg-transparent text-muted-foreground hover:bg-[var(--bg-hover)] hover:text-foreground',
          )}
        >
          <Icon className={cn('size-4', current === id && 'text-primary')} />
          {label}
        </button>
      ))}
    </nav>
  );
}

// Search results grouped under their section names.
function SearchResults({ settings }) {
  if (settings.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No setting matches.</p>;
  return sectionsWith(settings).map((section) => (
    <section key={section.id} className="mb-4">
      <h3 className="m-0 font-mono text-[11px] font-normal uppercase tracking-wider text-[var(--text-tertiary)]">{section.label}</h3>
      <SettingRows settings={settings.filter((s) => s.section === section.id)} />
    </section>
  ));
}

// The open section's settings, or the ones matching a search. The pane scrolls
// when the window is short or zoomed, so it takes keyboard focus itself: a
// section with nothing to tab to (About) could not be scrolled otherwise.
function SettingsPane({ query, visible, sections, section, mode }) {
  const label = query ? 'Matching settings' : sections.find((s) => s.id === section).label;
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling region has to be focusable to scroll from the keyboard, and About has nothing else to focus
    <section tabIndex={0} aria-label={label} className="min-h-0 overflow-y-auto px-6 py-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      {query
        ? <SearchResults settings={searchSettings(visible, query)} />
        : <SettingRows settings={visible.filter((s) => s.section === section)} />}
      {mode === 'simple' && !query && <p className="mt-4 text-xs text-muted-foreground">More settings, including every AI prompt, are in Power mode.</p>}
    </section>
  );
}

function Header({ mode, onMode, query, onQuery, onClose }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
      <DialogTitle className="m-0 mr-auto text-[15px] font-semibold">Settings</DialogTitle>
      <DialogDescription className="sr-only">Appearance, reading, AI and data settings</DialogDescription>
      <label className="flex h-8 items-center gap-2 rounded-md border border-border bg-[var(--bg-primary)] px-2.5 text-muted-foreground focus-within:border-primary">
        <HiOutlineMagnifyingGlass className="size-4" />
        <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Find a setting" aria-label="Find a setting" className="w-40 border-0 bg-transparent text-[13px] text-foreground shadow-none outline-none" />
      </label>
      <span title="Simple shows the essentials; Power shows every setting, including prompts.">
        <Segmented label="Settings mode" value={mode} onChange={onMode} options={MODES} />
      </span>
      <button type="button" onClick={onClose} aria-label="Close settings" className="flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground hover:bg-[var(--bg-hover)] hover:text-foreground">
        <HiOutlineXMark className="size-4" />
      </button>
    </div>
  );
}

/**
 * Settings, generated from the registry: a section list on the left, the
 * section's settings on the right, a search across all of them, and the
 * Simple / Power switch that hides or shows the advanced ones.
 */
export default function SettingsScreen({ isOpen, onClose, availableModels = [], section: startSection }) {
  const showToast = useToast();
  const [mode, setMode] = usePersistedChoice(MODE_KEY, 'power');
  const [current, setCurrent] = useState(startSection || 'appearance');
  const [query, setQuery] = useState('');
  const visible = useMemo(() => visibleIn(mode), [mode]);
  const sections = sectionsWith(visible);
  const section = sections.some((s) => s.id === current) ? current : sections[0].id;
  const env = useMemo(() => ({ availableModels: availableModels || [], onClose, showToast }), [availableModels, onClose, showToast]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent showCloseButton={false} onOpenAutoFocus={(e) => e.preventDefault()} className="flex h-[min(780px,90vh)] w-[min(980px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden border-border bg-[var(--bg-modal)] p-0 sm:max-w-none">
        <SettingsEnv.Provider value={env}>
          <Header mode={mode} onMode={setMode} query={query} onQuery={setQuery} onClose={onClose} />
          <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr]">
            <SectionNav sections={sections} current={query ? null : section} onSelect={(id) => { setQuery(''); setCurrent(id); }} />
            <SettingsPane query={query} visible={visible} sections={sections} section={section} mode={mode} />
          </div>
        </SettingsEnv.Provider>
      </DialogContent>
    </Dialog>
  );
}

