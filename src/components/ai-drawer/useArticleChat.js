import { useCallback, useState } from 'react';
import { chatMessages, streamTokens } from '../../ai/tasks.js';
import { useStreamRun, whileCurrent } from '../../hooks/useStreamRun.js';
import { useTokenBuffer } from '../../hooks/useTokenBuffer.js';

const MAX_CHAT_MESSAGES = 40; // ~20 exchanges

// Appends streamed text to the last (assistant) message, capping history.
// A conversation that was reset meanwhile has nothing to append to.
export const appendToLast = (text) => (prev) => {
  if (prev.length === 0) return prev;
  const updated = [...prev];
  const last = updated[updated.length - 1];
  updated[updated.length - 1] = { role: 'assistant', content: last.content + text };
  return updated.length > MAX_CHAT_MESSAGES ? updated.slice(-MAX_CHAT_MESSAGES) : updated;
};

/** Chat tab state: conversation about the current article. */
export function useArticleChat({ article, extractedContent, model }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const streamRun = useStreamRun();
  const onFlush = useCallback((text) => setMessages(appendToLast(text)), []);
  const tokens = useTokenBuffer(onFlush);

  // Reset the conversation when the article changes, stopping any answer in progress.
  const [prevId, setPrevId] = useState(article?.id);
  if (prevId !== article?.id) {
    setPrevId(article?.id);
    setMessages([]);
    setError(null);
    setLoading(false);
    streamRun.cancel();
    tokens.reset();
  }

  const fail = useCallback((err) => {
    setError(err.message);
    setMessages((prev) => prev.slice(0, -1));
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (loading) return;
    if (!text || !model) return;
    const history = [...messages, { role: 'user', content: text }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);
    setError(null);
    tokens.reset();
    const signal = streamRun.start();
    const prompt = chatMessages(article, extractedContent, history);
    await streamTokens(model, prompt, whileCurrent(signal, tokens.push), signal).then(tokens.flush, fail);
    whileCurrent(signal, setLoading)(false);
  }, [input, messages, model, loading, article, extractedContent, tokens, fail, streamRun]);

  const stop = useCallback(() => {
    streamRun.cancel();
    tokens.flush();
    setLoading(false);
  }, [streamRun, tokens]);

  return { messages, input, setInput, loading, error, send, stop };
}
