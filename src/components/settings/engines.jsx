import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { capability } from '../../plugins/index.js';
import { isNanoModel } from '../../utils/chromeAI.js';
import { autoLabel, modelLabel, pickDefaultModel } from '../../ai/models.js';
import { useSettingsEnv } from './env.js';
import { NanoStatusLine } from '../ollama/NanoSetup.jsx';
import OllamaSetup from '../ollama/OllamaSetup.jsx';

function EngineLine({ name, children }) {
  return (
    <div className="flex flex-col gap-1.5 py-1.5">
      <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">{name}</div>
      {children}
    </div>
  );
}

// The engines plugins add (an own key, the app's hosted AI: models with a
// label), each saying whether Auto uses it now (AI-5).
function PluginEngines({ models }) {
  const auto = pickDefaultModel(models);
  const added = models.filter((m) => m.label && !isNanoModel(m.name));
  return added.map((m) => (
    <EngineLine key={m.name} name={modelLabel(m)}>
      <span className="text-[13px] text-muted-foreground">{m.name === auto ? 'Ready · Auto uses this now' : 'Ready'}</span>
    </EngineLine>
  ));
}

// What Auto uses now, the engines plugins add, Gemini Nano (built into
// Chrome) and Ollama (optional, checked only when opened; not offered where
// the app turns capability 'ollama' off).
export function EngineControl() {
  const [showOllama, setShowOllama] = useState(false);
  const { availableModels } = useSettingsEnv();
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[13px] text-foreground">{autoLabel(availableModels)}</p>
      <PluginEngines models={availableModels} />
      <EngineLine name="Gemini Nano">
        <NanoStatusLine />
      </EngineLine>
      {capability('ollama') && (
        <EngineLine name="Ollama · optional, for larger local models">
          {showOllama ? <OllamaSetup compact showReady /> : <Button variant="outline" size="sm" className="self-start" onClick={() => setShowOllama(true)}>Set up Ollama</Button>}
        </EngineLine>
      )}
    </div>
  );
}
