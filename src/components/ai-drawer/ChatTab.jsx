import { Fragment, useEffect, useRef } from 'react';
import { HiOutlineChatBubbleLeftRight } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { chatBlocks } from './chatMarkdown.js';
import { RailEmpty, RailError, TypingCursor } from './parts.jsx';

const SUGGESTIONS = ['What are the key takeaways?', 'Explain this in simple terms', "What's the author's main argument?"];

function Spans({ spans }) {
  return spans.map((s, i) => {
    let el = s.code ? <code className="rounded bg-[var(--bg-active)] px-1 font-mono text-[0.9em]">{s.text}</code> : s.text;
    if (s.italic) el = <em>{el}</em>;
    if (s.bold) el = <strong className="font-semibold">{el}</strong>;
    return <Fragment key={i}>{el}</Fragment>;
  });
}

const LIST_CLASS = { ul: 'list-disc', ol: 'list-decimal' };

// One block of an answer (chatMarkdown.js); `tail` (the typing cursor) goes at its end.
function Block({ block, tail }) {
  if (block.type === 'h') return <p className="font-semibold"><Spans spans={block.spans} />{tail}</p>;
  if (block.type === 'p') return <p>{block.lines.map((spans, i) => <Fragment key={i}>{i > 0 && <br />}<Spans spans={spans} /></Fragment>)}{tail}</p>;
  const List = block.type;
  return (
    <List start={block.start} className={cn('flex flex-col gap-1 pl-5', LIST_CLASS[List])}>
      {block.items.map((spans, i) => <li key={i}><Spans spans={spans} />{i === block.items.length - 1 && tail}</li>)}
    </List>
  );
}

// The model's answer: its Markdown as text, lists and emphasis, never as HTML.
function Answer({ text, typing }) {
  const blocks = chatBlocks(text);
  const cursor = typing && <TypingCursor />;
  if (blocks.length === 0) return cursor || null;
  return blocks.map((block, i) => <Block key={i} block={block} tail={i === blocks.length - 1 && cursor} />);
}

function ChatMessage({ msg, typing }) {
  const user = msg.role === 'user';
  return (
    <div className={cn('flex', user && 'justify-end')}>
      {user ? (
        <div className="max-w-[88%] whitespace-pre-wrap rounded-lg bg-[var(--bg-active)] px-3 py-2 text-[13.5px] leading-relaxed text-foreground">
          {msg.content}
          {typing && <TypingCursor />}
        </div>
      ) : (
        <div className="flex max-w-[88%] flex-col gap-2 leading-relaxed text-foreground" style={{ fontFamily: 'var(--reader-font-family)', fontSize: 15 }}>
          <Answer text={msg.content} typing={typing} />
        </div>
      )}
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
