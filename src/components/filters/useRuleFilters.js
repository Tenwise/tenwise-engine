// The saved rule filters (PR-13), from the synced setting: read here, saved
// to the server (its views read the rule from settings.json), and shared
// across the sidebar, the list's title and the editor through an app event.
import { useCallback, useEffect, useState } from 'react';
import { emit, on } from '../../lib/appEvents.js';
import { saveSettings } from '../../utils/api.js';
import { readStored, writeStored } from '../../utils/storage.js';
import { parseFilters, RULE_FILTERS_KEY, serializeFilters } from '../../../shared/ruleFilters.js';

const CHANGED = 'rule-filters-changed';
const read = () => parseFilters(readStored(RULE_FILTERS_KEY, ''));

/** The saved filters, kept current. */
export function useRuleFilters() {
  const [filters, setFilters] = useState(read);
  useEffect(() => on(CHANGED, () => setFilters(read())), []);
  return filters;
}

/** Saves the whole list (checked) here and on the server, then the lists reload. */
export async function saveRuleFilters(filters) {
  const value = serializeFilters(filters);
  writeStored(RULE_FILTERS_KEY, value);
  emit(CHANGED);
  await saveSettings({ [RULE_FILTERS_KEY]: value });
  emit('feeds-changed');
}

/** Add or replace one filter (a new one gets an id); resolves to the saved filter. */
export function useSaveFilter() {
  return useCallback(async (filter) => {
    const list = read();
    const saved = { ...filter, id: filter.id ?? Math.max(Date.now(), ...list.map((f) => f.id + 1)) };
    await saveRuleFilters([...list.filter((f) => f.id !== saved.id), saved]);
    return saved;
  }, []);
}

/** Remove one filter by id. */
export const removeRuleFilter = (id) => saveRuleFilters(read().filter((f) => f.id !== id));
