import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { downloadNano } from '../../utils/chromeAI.js';
import { NANO_TEXT, useNanoState } from './nanoState.js';
import { SetupActions, SetupCard } from './OllamaStates.jsx';

const NEEDS_DOWNLOAD = new Set(['downloadable', 'downloading']);

function NanoProgress({ value }) {
  const percent = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Downloading Gemini Nano">
      <div className="h-1 w-40 overflow-hidden rounded-full bg-[var(--bg-tertiary)]"><div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} /></div>
      <span className="font-mono text-[11px] text-[var(--text-tertiary)]">{percent}%</span>
    </div>
  );
}

/**
 * Starts (or follows) Chrome's download of Gemini Nano with a progress bar.
 * The download starts in the click handler itself: Chrome requires a click.
 */
export function DownloadNano({ state, onDone }) {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const start = () => {
    setError('');
    setProgress(0);
    downloadNano(setProgress)
      .then(() => onDone?.())
      .catch((err) => { setError(err.message); setProgress(null); });
  };
  if (progress !== null) return <NanoProgress value={progress} />;
  return (
    <SetupActions>
      <Button size="sm" onClick={start}>{state === 'downloading' ? 'Show progress' : 'Download Gemini Nano'}</Button>
      {error && <p className="text-[var(--danger)]">{error}</p>}
    </SetupActions>
  );
}

/** Settings → AI engines: Gemini Nano's state, with the download when it's needed. */
export function NanoStatusLine({ onChange }) {
  const [state, refresh] = useNanoState();
  if (!state) return null;
  const done = () => { refresh(); onChange?.(); };
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-start gap-2 text-[13px] text-muted-foreground">
        <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', state === 'ready' ? 'bg-[var(--success,#3fb950)]' : 'bg-[var(--text-tertiary)]')} />
        {NANO_TEXT[state]}
      </span>
      {NEEDS_DOWNLOAD.has(state) && <DownloadNano state={state} onDone={done} />}
    </div>
  );
}

/** AI rail: Gemini Nano is the model, but Chrome still has to download it. */
export function NanoDownloadNotice({ onDone }) {
  const [state] = useNanoState();
  return (
    <SetupCard emoji="✨" title="Gemini Nano needs a one-time download" compact>
      <p>{NANO_TEXT[state === 'downloading' ? 'downloading' : 'downloadable']}</p>
      <DownloadNano state={state} onDone={onDone} />
    </SetupCard>
  );
}
