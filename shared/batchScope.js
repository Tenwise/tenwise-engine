// Background AI's saved settings (the 'tenwise-batch-ai' setting) and which
// new articles it picks up. Shared by the browser (Settings, the processor) and
// the server, which queues a feed's new articles after refreshing it.

export const DEFAULT_BATCH_SETTINGS = {
  enabled: false,
  scope: 'all',        // 'all' | 'folder:<id>' | 'feed:<id>'
  maxPerCycle: 20,
  model: '',           // empty = auto-pick first available model
  features: 'both',   // 'summary' | 'analysis' | 'both'
};

/** Batch settings from their stored JSON; the defaults fill anything missing or unreadable. */
export function parseBatchSettings(raw) {
  try {
    if (raw) return { ...DEFAULT_BATCH_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_BATCH_SETTINGS };
}

/** Parses a batch scope setting: 'all' | 'folder:<id>' | 'feed:<id>'. */
export function parseScope(scope) {
  const [type, id] = (scope || 'all').split(':');
  return { type, id: id ? parseInt(id, 10) : null };
}

// One check per scope type, given the scope's id and a feed { id, folderId }.
const SCOPE_CHECKS = {
  all: () => true,
  feed: (id, feed) => id === feed.id,
  folder: (id, feed) => id !== null && feed.folderId === id,
};

/** Whether a feed's new articles fall inside the batch scope; unknown scope types never do. */
export function scopeIncludes(scope, feed) {
  const { type, id } = parseScope(scope);
  return Object.hasOwn(SCOPE_CHECKS, type) && SCOPE_CHECKS[type](id, feed);
}

/**
 * How many of a feed's new articles may join the queue now: none while batch
 * AI is off or the feed is out of scope, else what the per-cycle limit leaves.
 */
export function batchSlots(settings, feed, queueCount) {
  if (!settings.enabled || !scopeIncludes(settings.scope, feed)) return 0;
  return Math.max(0, settings.maxPerCycle - queueCount);
}
