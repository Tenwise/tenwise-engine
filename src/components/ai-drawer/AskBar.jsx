import { HiOutlineArrowUp, HiOutlineStop } from 'react-icons/hi2';

const PLACEHOLDER = { ready: 'Ask AI about this article…', disabled: 'Choose an AI model to ask questions' };

// Ask while idle, Stop while an answer streams.
function SendButton({ loading, canAsk, onAsk, onStop }) {
  const Icon = loading ? HiOutlineStop : HiOutlineArrowUp;
  return (
    <button
      type="button"
      onClick={loading ? onStop : onAsk}
      disabled={!loading && !canAsk}
      title={loading ? 'Stop' : 'Ask (Enter)'}
      aria-label={loading ? 'Stop' : 'Ask'}
      className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-primary text-primary-foreground disabled:cursor-default disabled:bg-[var(--bg-active)] disabled:text-[var(--text-tertiary)]"
    >
      <Icon className="size-3.5" />
    </button>
  );
}

/**
 * "Ask AI about this article", pinned to the foot of the rail on every tab.
 * Sending switches to the Chat tab, where the answer streams in.
 * chat = useArticleChat().
 */
export default function AskBar({ chat, disabled, onAsk, inputRef }) {
  const { input, setInput, loading, stop } = chat;
  const canAsk = !disabled && Boolean(input.trim());
  const ask = () => { if (canAsk) onAsk(); };
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    ask();
  };
  return (
    <div className="shrink-0 border-t border-border p-3">
      <div className="flex items-end gap-2 rounded-lg border border-border bg-[var(--bg-primary)] py-1.5 pr-1.5 pl-3 focus-within:border-primary">
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          disabled={disabled}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={PLACEHOLDER[disabled ? 'disabled' : 'ready']}
          aria-label="Ask AI about this article"
          className="max-h-32 min-h-6 flex-1 resize-none border-0 bg-transparent py-1 font-sans text-[13px] leading-snug text-foreground shadow-none outline-none field-sizing-content"
        />
        <SendButton loading={loading} canAsk={canAsk} onAsk={ask} onStop={stop} />
      </div>
    </div>
  );
}
