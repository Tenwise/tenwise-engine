import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NANO_TEXT, useNanoState } from './nanoState.js';
import OllamaSetup from './OllamaSetup.jsx';
import { SetupActions, SetupCard } from './OllamaStates.jsx';

/**
 * Shown in the AI rail when no engine is available: says why Gemini Nano
 * isn't (not Chrome, an old Chrome, or a computer Chrome can't run it on),
 * and offers the optional Ollama setup on request.
 */
export function NoAIEngine({ onReady }) {
  const [showOllama, setShowOllama] = useState(false);
  const [nano] = useNanoState();
  if (showOllama) return <OllamaSetup compact onReady={onReady} />;
  const reason = nano && nano !== 'ready' ? NANO_TEXT[nano] : NANO_TEXT['not-chrome'];
  return (
    <SetupCard emoji="✨" title="No AI model available" compact>
      <p>{reason}</p>
      <SetupActions><Button variant="outline" size="sm" onClick={() => setShowOllama(true)}>Use Ollama instead</Button></SetupActions>
    </SetupCard>
  );
}
