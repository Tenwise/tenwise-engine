import { useCallback, useRef } from 'react';

/**
 * Batches streamed tokens into one state update per animation frame, so
 * fast token streams don't re-render on every token.
 * onFlush(text) receives everything buffered since the last frame.
 */
export function useTokenBuffer(onFlush) {
  const bufferRef = useRef('');
  const frameRef = useRef(null);

  const flush = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const text = bufferRef.current;
    bufferRef.current = '';
    if (text) onFlush(text);
  }, [onFlush]);

  const push = useCallback((token) => {
    bufferRef.current += token;
    if (!frameRef.current) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        flush();
      });
    }
  }, [flush]);

  const reset = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    bufferRef.current = '';
  }, []);

  return { push, flush, reset };
}
