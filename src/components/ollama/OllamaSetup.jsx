import { AddModels, Checking, NoModels, NotInstalled, NotRunning, Ready } from './OllamaStates.jsx';
import { useOllamaStatus } from './useOllamaStatus.js';

/** Guided Ollama setup: detect, start, and pull a model; optionally show "ready". */
export default function OllamaSetup({ onReady, compact = false, showReady = false }) {
  const ollama = useOllamaStatus(onReady);
  const { status } = ollama;
  if (!status) return <Checking />;
  if (!status.installed) return <NotInstalled compact={compact} ollama={ollama} />;
  if (!status.running) return <NotRunning compact={compact} ollama={ollama} />;
  if (status.models.length === 0) return <NoModels compact={compact} ollama={ollama} />;
  if (!showReady) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Ready count={status.models.length} onRefresh={ollama.check} />
      <AddModels ollama={ollama} />
    </div>
  );
}
