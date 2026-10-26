// Older Ollama versions put a reasoning model's thinking (DeepSeek R1, Qwen 3)
// into the answer itself, between <think> and </think>. Newer ones keep it in
// a separate field, and Tenwise asks for none, so this only matters for
// those versions: it drops the blocks from a stream of text chunks, even when
// a tag is split across chunks, and the blank lines that follow one.

const OPEN = '<think>';
const CLOSE = '</think>';

// How much of the end of `text` could be the start of `tag`, held back until
// the next chunk shows whether it is.
function partialTagLength(text, tag) {
  for (let n = Math.min(tag.length - 1, text.length); n > 0; n--) {
    if (text.endsWith(tag.slice(0, n))) return n;
  }
  return 0;
}

// Keeps only the end of state.pending that could be the start of `tag`;
// returns what came before it.
function holdPartial(state, tag) {
  const cut = state.pending.length - partialTagLength(state.pending, tag);
  const before = state.pending.slice(0, cut);
  state.pending = state.pending.slice(cut);
  return before;
}

// Inside a block: drops text up to </think>, and the blank lines after it.
function skipThinking(state) {
  const end = state.pending.indexOf(CLOSE);
  if (end < 0) {
    holdPartial(state, CLOSE); // the reasoning so far is dropped
    return '';
  }
  state.pending = state.pending.slice(end + CLOSE.length).replace(/^\s+/, '');
  state.thinking = false;
  state.trimNext = state.pending === ''; // the blank lines may come in the next chunk
  return '';
}

// Outside a block: the answer text up to the next <think>.
function takeAnswer(state) {
  if (state.trimNext) {
    state.pending = state.pending.replace(/^\s+/, '');
    state.trimNext = state.pending === '';
  }
  const start = state.pending.indexOf(OPEN);
  if (start < 0) return holdPartial(state, OPEN);
  const text = state.pending.slice(0, start);
  state.pending = state.pending.slice(start + OPEN.length);
  state.thinking = true;
  return text;
}

// Decides as much of the pending text as it can; returns the answer part.
function drain(state) {
  let out = '';
  while (state.pending) {
    const before = state.pending;
    out += state.thinking ? skipThinking(state) : takeAnswer(state);
    if (state.pending === before) break; // waiting for the next chunk
  }
  return out;
}

/** Yields the text of `chunks` without <think>…</think> blocks. */
export async function* withoutThinking(chunks) {
  const state = { pending: '', thinking: false, trimNext: false };
  for await (const chunk of chunks) {
    state.pending += chunk;
    const text = drain(state);
    if (text) yield text;
  }
  if (!state.thinking && state.pending) yield state.pending;
}
