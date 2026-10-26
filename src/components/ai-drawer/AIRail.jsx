import { useRef, useState } from 'react';
import { HiOutlineSparkles, HiOutlineXMark } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { nanoNeedsDownload } from '../../ai/models.js';
import { pluginsOf } from '../../plugins/index.js';
import { fetchAIModels } from '../../utils/api.js';
import { NanoDownloadNotice } from '../ollama/NanoSetup.jsx';
import { NoAIEngine } from '../ollama/NoAIEngine.jsx';
import ResizableHandle from '../shell/ResizableHandle.jsx';
import VoiceStrips from './VoiceStrips.jsx';
import AskBar from './AskBar.jsx';
import ChatTab from './ChatTab.jsx';
import HighlightsTab from './HighlightsTab.jsx';
import ModelPicker from './ModelPicker.jsx';
import SummaryTab from './SummaryTab.jsx';
import { useAIModels } from './useAIModels.js';
import { useArticleChat } from './useArticleChat.js';
import { useArticleSummary } from './useArticleSummary.js';
import { Spinner } from '@/components/ui/spinner';

// Tabs plugins add (src/plugins/index.js), such as Analysis, go after Summary.
const PLUGIN_TABS = pluginsOf('railTabs');
const TABS = [
  { id: 'summary', label: 'Summary' },
  ...PLUGIN_TABS.map(({ id, label }) => ({ id, label })),
  { id: 'chat', label: 'Chat' },
  { id: 'highlights', label: 'Highlights' },
];

function Header({ ai, onClose }) {
  return (
    <div className="flex h-[var(--pane-header-height)] shrink-0 items-center gap-2 border-b border-border pr-2 pl-4">
      <HiOutlineSparkles className="size-4 text-primary" />
      <h2 className="m-0 mr-auto text-[13.5px] font-semibold text-foreground">AI</h2>
      {!ai.checked && <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Spinner className="size-3 border-[1.5px]" /> checking</span>}
      {ai.ready && <ModelPicker models={ai.models} selectedModel={ai.selectedModel} onSelect={ai.setSelectedModel} />}
      <button type="button" onClick={onClose} title="Close AI rail (a)" aria-label="Close AI rail" className="flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground hover:bg-[var(--bg-hover)] hover:text-foreground">
        <HiOutlineXMark className="size-4" />
      </button>
    </div>
  );
}

function TabBar({ tab, onChange, highlightCount }) {
  return (
    <div role="tablist" className="flex shrink-0 border-b border-border px-2">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => onChange(id)}
          className={cn(
            '-mb-px flex h-10 cursor-pointer items-center gap-1.5 border-0 border-b-2 bg-transparent px-2.5 text-[13px] transition-colors',
            tab === id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
          {id === 'highlights' && highlightCount > 0 && <span className="font-mono text-[10.5px] text-primary">{highlightCount}</span>}
        </button>
      ))}
    </div>
  );
}

// The closed rail: a narrow strip that keeps the way back in view.
function RailStrip({ onOpen }) {
  return (
    <div className="flex h-full w-11 shrink-0 flex-col items-center border-l border-border bg-[var(--bg-secondary)] pt-2">
      <button type="button" onClick={onOpen} title="Open AI rail (a)" aria-label="Open AI rail" className="flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-primary hover:bg-[var(--bg-hover)]">
        <HiOutlineSparkles className="size-4" />
      </button>
    </div>
  );
}

// Each plugin tab's state, kept while other tabs are shown. PLUGIN_TABS is
// fixed when the bundle loads, so these hooks run in the same order every render.
function usePluginTabs(input) {
  return Object.fromEntries(PLUGIN_TABS.map((t) => [t.id, t.useTab(input)]));
}

// One AI run at a time: a tab may start one only while no other tab is running.
const busyTabs = (summary, pluginTabs) => [
  ...(summary.summarizing ? ['summary'] : []),
  ...PLUGIN_TABS.filter((t) => t.busy(pluginTabs[t.id])).map((t) => t.id),
];

function TabPanel({ tab, ctx }) {
  const { ai, article, summary, pluginTabs, chat, highlights, onHighlightDeleted, suggest } = ctx;
  const busy = busyTabs(summary, pluginTabs);
  const canRun = (id) => Boolean(ai.selectedModel) && busy.every((b) => b === id);
  const plugin = PLUGIN_TABS.find((t) => t.id === tab);
  if (plugin) return <plugin.Panel tab={pluginTabs[tab]} canRun={canRun(tab)} />;
  if (tab === 'chat') return <ChatTab chat={chat} onSuggest={suggest} />;
  if (tab === 'highlights') return <HighlightsTab highlights={highlights} onDelete={onHighlightDeleted} />;
  return <SummaryTab article={article} s={summary} canGenerate={canRun('summary')} />;
}

// What the rail shows under its header: nothing while models load, setup
// when there is no engine or Gemini Nano still has to be downloaded, else the tabs.
function railStage(ai) {
  if (!ai.checked) return 'checking';
  if (!ai.ready) return 'no-engine';
  return nanoNeedsDownload(ai.models.find((m) => m.name === ai.selectedModel)) ? 'nano-download' : 'tabs';
}

function SetupNotice({ stage, ai }) {
  if (stage === 'no-engine') return <div className="border-b border-border p-4"><NoAIEngine onReady={ai.loadModels} /></div>;
  if (stage !== 'nano-download') return null;
  const reloadModels = () => fetchAIModels().then(({ models }) => ai.loadModels(models)).catch(() => {});
  return <div className="border-b border-border p-4"><NanoDownloadNotice onDone={reloadModels} /></div>;
}

/**
 * The AI rail beside the open article: Summary, plugins' tabs, Chat and
 * Highlights, the voice it answers in, and an "Ask AI" box on every tab.
 * Resizable from its left edge; closed, it leaves a thin strip. Tab state
 * lives in hooks here (not in the tabs) so it survives tab switches.
 */
export default function AIRail({ isOpen, onClose, width, onResize, article, extractedContent, feedTitle, onSummarySaved, highlights = [], onHighlightDeleted }) {
  const [tab, setTab] = useState('summary');
  const askRef = useRef(null);
  const ai = useAIModels();
  const model = ai.selectedModel;
  const summary = useArticleSummary({ article, extractedContent, model, feedTitle, onSummarySaved });
  const pluginTabs = usePluginTabs({ article, extractedContent, model });
  const chat = useArticleChat({ article, extractedContent, model });

  if (!isOpen) return <RailStrip onOpen={onClose} />;
  const stage = railStage(ai);
  const ask = () => { setTab('chat'); chat.send(); };
  const suggest = (text) => { chat.setInput(text); askRef.current?.focus(); };
  const ctx = { ai, article, summary, pluginTabs, chat, highlights, onHighlightDeleted, suggest };

  return (
    <aside className="ai-drawer flex h-full shrink-0 flex-col overflow-hidden border-l border-border bg-[var(--bg-secondary)]" aria-label="AI assistant" style={{ width: `${width}px` }}>
      <ResizableHandle overlay className="left-0" onResize={onResize} />
      <Header ai={ai} onClose={onClose} />
      <SetupNotice stage={stage} ai={ai} />
      {stage === 'tabs' && (
        <>
          <TabBar tab={tab} onChange={setTab} highlightCount={highlights.length} />
          <VoiceStrips />
          <div className="min-h-0 flex-1 overflow-y-auto"><TabPanel tab={tab} ctx={ctx} /></div>
          <AskBar chat={chat} disabled={!model} onAsk={ask} inputRef={askRef} />
        </>
      )}
    </aside>
  );
}
