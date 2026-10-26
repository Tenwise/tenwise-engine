import { useState } from 'react';
import { HiOutlineArrowPath } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { fitsMemory, RECOMMENDED_MODELS, recommendedModel } from '../../ai/recommendedModels.js';

/** A setup step: emoji, title, explanation and actions. */
export function SetupCard({ emoji, title, compact, children }) {
  return (
    <div className={cn('flex gap-3 rounded-lg border border-border bg-[var(--bg-primary)]', compact ? 'p-3' : 'p-4')}>
      <div className="text-xl leading-none">{emoji}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-[13px] leading-relaxed text-muted-foreground [&_p]:m-0">
        <h3 className="m-0 text-[13.5px] font-semibold text-foreground">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export const SetupActions = ({ children }) => <div className="flex flex-wrap gap-1.5">{children}</div>;

const ErrorLine = ({ error }) => (error ? <p className="text-[var(--danger)]">{error}</p> : null);

export function Checking() {
  return <div className="flex items-center gap-2 py-2 text-[13px] text-muted-foreground"><Spinner /> Checking Ollama…</div>;
}

export function NotInstalled({ compact, ollama }) {
  return (
    <SetupCard emoji="🦙" title="Ollama not found" compact={compact}>
      <p>Ollama is a free, local AI runtime. It runs models privately on your machine: no cloud, no data sent anywhere.</p>
      <SetupActions>
        <Button size="sm" onClick={() => window.open('https://ollama.com/download', '_blank', 'noopener')}>Download Ollama</Button>
        <Button variant="ghost" size="sm" onClick={ollama.check}><HiOutlineArrowPath /> Check again</Button>
      </SetupActions>
    </SetupCard>
  );
}

export function NotRunning({ compact, ollama }) {
  return (
    <SetupCard emoji="😴" title="Ollama is not running" compact={compact}>
      <p>Ollama is installed but not running.</p>
      <ErrorLine error={ollama.error} />
      <SetupActions>
        <Button size="sm" onClick={ollama.start} disabled={ollama.starting}>{ollama.starting ? <><Spinner /> Starting…</> : 'Start Ollama'}</Button>
        <Button variant="ghost" size="sm" onClick={ollama.check}><HiOutlineArrowPath /> Refresh</Button>
      </SetupActions>
    </SetupCard>
  );
}

function PullProgress({ entry }) {
  const percent = entry?.percent || 0;
  return (
    <div className="flex w-32 flex-col gap-1">
      <div className="h-1 overflow-hidden rounded-full bg-[var(--bg-tertiary)]"><div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} /></div>
      <span className="truncate font-mono text-[10.5px] text-[var(--text-tertiary)]">{entry?.status} {percent > 0 ? `${percent}%` : ''}</span>
    </div>
  );
}

// What a suggestion means for this computer: the pick for it, or too big for its memory.
function FitNote({ model, recommended, memoryGB }) {
  if (model.name === recommended) return <span className="text-[11px] font-medium text-primary">Recommended for this computer</span>;
  if (!fitsMemory(model, memoryGB)) return <span className="text-[11px] text-[var(--text-tertiary)]">Slow below {model.minMemoryGB} GB of memory</span>;
  return null;
}

function ModelRow({ model, ollama, recommended, memoryGB }) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-2 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        <span className="text-[13px] font-medium text-foreground">{model.label}</span>
        <span className="font-mono text-[11px] text-[var(--text-tertiary)]">{model.size}</span>
        <span className="text-[11px] text-muted-foreground">{model.note}</span>
        <FitNote model={model} recommended={recommended} memoryGB={memoryGB} />
      </div>
      {ollama.pulling === model.name
        ? <PullProgress entry={ollama.progress[model.name]} />
        : <Button size="sm" onClick={() => ollama.pull(model.name)} disabled={Boolean(ollama.pulling)}>Pull</Button>}
    </div>
  );
}

/** The suggested models not installed yet, with this computer's pick marked. */
function SuggestedModels({ ollama }) {
  const { memoryGB, models: installed = [] } = ollama.status;
  const recommended = recommendedModel(memoryGB).name;
  const missing = RECOMMENDED_MODELS.filter((m) => !installed.some((i) => i.name === m.name));
  return <div>{missing.map((m) => <ModelRow key={m.name} model={m} ollama={ollama} recommended={recommended} memoryGB={memoryGB} />)}</div>;
}

const memoryLine = (memoryGB) => (memoryGB ? ` This computer has ${memoryGB} GB of memory.` : '');

export function NoModels({ compact, ollama }) {
  return (
    <SetupCard emoji="📦" title="No models installed" compact={compact}>
      <p>Pull a model to enable AI features. Smaller models are faster; larger ones write better summaries but need more memory.{memoryLine(ollama.status.memoryGB)}</p>
      <ErrorLine error={ollama.error} />
      <SuggestedModels ollama={ollama} />
    </SetupCard>
  );
}

/** Settings, once Ollama has models: the suggestions, a click away. */
export function AddModels({ ollama }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button variant="ghost" size="sm" className="self-start" onClick={() => setOpen(true)}>Suggested models</Button>;
  return (
    <div className="flex flex-col gap-1">
      <p className="m-0 text-[12.5px] text-muted-foreground">Suggested models for summaries and analysis.{memoryLine(ollama.status.memoryGB)}</p>
      <ErrorLine error={ollama.error} />
      <SuggestedModels ollama={ollama} />
    </div>
  );
}

export function Ready({ count, onRefresh }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
      <span className="size-2 rounded-full bg-[#3fb950]" />
      Running · {count} model{count !== 1 ? 's' : ''} available
      <Button variant="ghost" size="sm" onClick={onRefresh} title="Refresh"><HiOutlineArrowPath /></Button>
    </div>
  );
}
