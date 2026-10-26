import { useEffect, useRef } from 'react';
import { HiOutlineChatBubbleLeftRight } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { RailEmpty, RailError, TypingCursor } from './parts.jsx';

const SUGGESTIONS = ['What are the key takeaways?', 'Explain this in simple terms', "What's the author's main argument?"];

function ChatMessage({ msg, typing }) {
  const user = msg.role === 'user';
  return (
    <div className={cn('flex', user && 'justify-end')}>
      <div
        className={cn('max-w-[88%] whitespace-pre-wrap text-[13.5px] leading-relaxed', user ? 'rounded-lg bg-[var(--bg-active)] px-3 py-2 text-foreground' : 'text-foreground')}
        style={user ? undefined : { fontFamily: 'var(--reader-font-family)', fontSize: 15 }}
      >
        {msg.content}
        {typing && <TypingCursor />}
      </div>
    </div>
  );
}

/** Chat tab: the conversation about the article (the question box is the rail's Ask bar). */
export default function ChatTab({ chat, onSuggest }) {
  const endRef = useRef(null);
  const { messages, loading, error } = chat;
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);
  return (
    <div className="flex flex-col gap-4 p-4">
      {messages.length === 0 && (
        <RailEmpty Icon={HiOutlineChatBubbleLeftRight} text="Ask anything about this article.">
          <div className="flex flex-col items-center gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => onSuggest(s)} className="cursor-pointer rounded-full border border-border bg-transparent px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground">{s}</button>
            ))}
          </div>
        </RailEmpty>
      )}
      {messages.map((msg, i) => <ChatMessage key={i} msg={msg} typing={loading && i === messages.length - 1} />)}
      {error && <RailError message={error} />}
      <div ref={endRef} />
    </div>
  );
}
