import { useState } from 'react';
import { Button } from '@/components/ui/button';
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

// Gemini Nano (built into Chrome) and Ollama (optional, checked only when opened).
export function EngineControl() {
  const [showOllama, setShowOllama] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <EngineLine name="Gemini Nano">
        <NanoStatusLine />
      </EngineLine>
      <EngineLine name="Ollama · optional, for larger local models">
        {showOllama ? <OllamaSetup compact showReady /> : <Button variant="outline" size="sm" className="self-start" onClick={() => setShowOllama(true)}>Set up Ollama</Button>}
      </EngineLine>
    </div>
  );
}
