import { useState } from 'react';
import { allLimits, getLimit, saveLimit } from '../../ai/limits.js';
import { allPrompts, getPrompt, promptEdits, savePrompt } from '../../ai/promptRegistry.js';
import { EditedBadge } from './ui.jsx';

const PROMPTS = allPrompts();
const GROUPS = [...new Set(PROMPTS.map((p) => p.group))];

// One prompt: its text (the edit or the default), saved as you type.
function PromptField({ prompt }) {
  const [text, setText] = useState(() => getPrompt(prompt.id));
  const [edited, setEdited] = useState(() => Boolean(promptEdits()[prompt.id]));
  const change = (value) => {
    setText(value);
    savePrompt(prompt.id, value);
    setEdited(Boolean(promptEdits()[prompt.id]));
  };
  const reset = () => change(prompt.defaultText);
  return (
    <div className="flex flex-col gap-1.5 border-b border-border py-4 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[13.5px] font-medium text-foreground">{prompt.label}</span>
        <EditedBadge edited={edited} onReset={reset} />
      </div>
      {prompt.note && <span className="text-xs text-muted-foreground">{prompt.note}</span>}
      <textarea
        aria-label={`${prompt.label} prompt`}
        value={text}
        onChange={(e) => change(e.target.value)}
        rows={Math.min(14, Math.max(3, Math.ceil(text.length / 90) + text.split('\n').length))}
        spellCheck={false}
        className="w-full resize-y rounded-md border border-border bg-[var(--bg-primary)] p-2.5 font-mono text-[12px] leading-relaxed text-foreground outline-none focus:border-primary"
      />
    </div>
  );
}

/** Every prompt the app sends, grouped, each editable with a reset to its default. */
export function PromptsEditor() {
  return (
    <div className="flex flex-col gap-6">
      {GROUPS.map((group) => (
        <section key={group}>
          <h3 className="m-0 mb-1 font-mono text-[11px] font-normal uppercase tracking-wider text-[var(--text-tertiary)]">{group}</h3>
          {PROMPTS.filter((p) => p.group === group).map((p) => <PromptField key={p.id} prompt={p} />)}
        </section>
      ))}
    </div>
  );
}

function LimitField({ limit }) {
  const [value, setValue] = useState(() => getLimit(limit.id));
  const change = (next) => {
    setValue(next);
    if (Number.isFinite(next)) saveLimit(limit.id, next);
  };
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-[13px] text-foreground">{limit.label}</span>
      <span className="flex items-center gap-3">
        <EditedBadge edited={value !== limit.defaultValue} onReset={() => change(limit.defaultValue)} />
        <input
          type="number"
          aria-label={limit.label}
          min={limit.min}
          max={limit.max}
          step={100}
          value={value}
          onChange={(e) => change(e.target.valueAsNumber)}
          onBlur={() => setValue(getLimit(limit.id))}
          className="h-8 w-24 rounded-md border border-border bg-[var(--bg-primary)] px-2 text-right font-mono text-[12.5px] text-foreground outline-none focus:border-primary"
        />
      </span>
    </div>
  );
}

/** Character budgets for article text sent to the model. */
export function LimitsEditor() {
  return <div className="flex flex-col">{allLimits().map((l) => <LimitField key={l.id} limit={l} />)}</div>;
}
