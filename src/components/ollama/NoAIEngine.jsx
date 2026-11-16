import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { emit } from '../../lib/appEvents.js';
import { capability, pluginsOf } from '../../plugins/index.js';
import { nanoText, useNanoState } from './nanoState.js';
import OllamaSetup from './OllamaSetup.jsx';
import { SetupActions, SetupCard } from './OllamaStates.jsx';

// Where the app has no Ollama (capability 'ollama' off), the card points at
// Settings → AI engines instead, when a plugin adds an engine to set up there.
function OtherEngines() {
  if (pluginsOf('aiEngines').length === 0) return null;
  return <SetupActions><Button variant="outline" size="sm" onClick={() => emit('open-settings', 'engines')}>Open AI settings</Button></SetupActions>;
}

/**
 * Shown in the AI rail when no engine is available: says why Gemini Nano
 * isn't (not Chrome, an old Chrome, or a computer Chrome can't run it on),
 * and offers the optional Ollama setup on request.
 */
export function NoAIEngine({ onReady }) {
  const [showOllama, setShowOllama] = useState(false);
  const [nano] = useNanoState();
  if (showOllama) return <OllamaSetup compact onReady={onReady} />;
  const reason = nanoText(nano && nano !== 'ready' ? nano : 'not-chrome');
  return (
    <SetupCard emoji="✨" title="No AI model available" compact>
      <p>{reason}</p>
      {capability('ollama')
        ? <SetupActions><Button variant="outline" size="sm" onClick={() => setShowOllama(true)}>Use Ollama instead</Button></SetupActions>
        : <OtherEngines />}
    </SetupCard>
  );
}
