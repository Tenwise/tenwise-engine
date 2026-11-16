import { useState } from 'react';
import { useLibrary } from '../../app/LibraryContext.jsx';
import { emit } from '../../lib/appEvents.js';
import { saveSettings } from '../../utils/api.js';
import { readStored, writeStored } from '../../utils/storage.js';
import { cleanWord, LIMITS, parseRules, RULES_KEY, serializeRules } from '../../../shared/rules.js';

const FIELD = 'w-full rounded-md border border-border bg-[var(--bg-primary)] p-2 text-[13px] text-foreground outline-none focus:border-primary';
const lines = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean);

// One word per line in, the words that are valid out; the rest are reported.
function splitWords(text) {
  const all = lines(text);
  return { words: all.map(cleanWord).filter(Boolean), bad: all.filter((l) => !cleanWord(l)) };
}

/**
 * Settings → Reading → Mute and alert rules (PR-5): words and sources to hide
 * everywhere, and words that mark an article. Saved to the server at once,
 * then the lists and counts reload.
 */
export function RulesControl() {
  const { feeds } = useLibrary();
  const [rules, setRules] = useState(() => parseRules(readStored(RULES_KEY, '')));
  const [mute, setMute] = useState(rules.muteWords.join('\n'));
  const [alert, setAlert] = useState(rules.alertWords.join('\n'));
  const [message, setMessage] = useState('');
  const toggleFeed = (id) => setRules((r) => ({ ...r, muteFeeds: r.muteFeeds.includes(id) ? r.muteFeeds.filter((f) => f !== id) : [...r.muteFeeds, id] }));
  const save = async () => {
    const m = splitWords(mute);
    const a = splitWords(alert);
    const value = serializeRules({ muteWords: m.words, muteFeeds: rules.muteFeeds, alertWords: a.words });
    writeStored(RULES_KEY, value);
    try {
      await saveSettings({ [RULES_KEY]: value });
      emit('feeds-changed');
      const bad = [...m.bad, ...a.bad];
      setMessage(bad.length ? `Saved. Left out (letters, digits, spaces, - and ' only): ${bad.join(', ')}` : 'Saved. Lists and counts now follow these rules.');
    } catch (err) {
      setMessage(err.message);
    }
  };
  const active = feeds.filter((f) => !f.removedAt);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Mute these words: articles with any of them are hidden everywhere but your saves. One per line, up to {LIMITS.words}.
        <textarea rows={4} value={mute} onChange={(e) => setMute(e.target.value)} className={FIELD} placeholder={'crypto\nsponsored'} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Alert words: articles with any of them are marked in the list. One per line.
        <textarea rows={3} value={alert} onChange={(e) => setAlert(e.target.value)} className={FIELD} placeholder={'our company\nmy topic'} />
      </label>
      {active.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Mute feeds ({rules.muteFeeds.length})</summary>
          <div className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
            {active.map((f) => (
              <label key={f.id} className="flex items-center gap-2 text-[13px] text-foreground">
                <input type="checkbox" checked={rules.muteFeeds.includes(f.id)} onChange={() => toggleFeed(f.id)} /> {f.title}
              </label>
            ))}
          </div>
        </details>
      )}
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} className="h-8 cursor-pointer rounded-md border border-border bg-transparent px-3 text-[13px] text-foreground hover:bg-[var(--bg-hover)]">Save rules</button>
        {message && <span role="status" className="text-xs text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}
