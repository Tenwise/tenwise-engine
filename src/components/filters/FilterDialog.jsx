import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLibrary } from '../../app/LibraryContext.jsx';
import { parseRule, RULE_LIMITS } from '../../../shared/ruleFilters.js';
import { removeRuleFilter, useSaveFilter } from './useRuleFilters.js';

const FIELD = 'w-full rounded-md border border-border bg-transparent px-3 py-2 text-[13px] text-foreground';
const LABEL = 'grid gap-1 text-[12.5px] text-muted-foreground';
const EXAMPLE = '("AI Act" OR GPAI) AND NOT opinion';

// The form's fields, the rule's check, and saving.
function useFilterForm(filter, onSaved) {
  const save = useSaveFilter();
  const [form, setForm] = useState(() => ({ name: filter?.name ?? '', rule: filter?.rule ?? '', scope: filter?.scope ?? 'title', folderId: filter?.folderId ?? '' }));
  const [state, setState] = useState({ busy: false, error: null });
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const check = form.rule.trim() ? parseRule(form.rule) : {};
  const ready = Boolean(form.name.trim() && form.rule.trim() && !check.error && !state.busy);
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: null });
    try {
      onSaved(await save({ ...form, id: filter?.id, folderId: form.folderId ? Number(form.folderId) : null }));
    } catch (err) {
      setState({ busy: false, error: err.message });
    }
  };
  return { form, set, check, ready, state, submit };
}

function RuleField({ value, onChange, error }) {
  return (
    <label className={LABEL}>
      Rule
      <textarea className={`${FIELD} font-mono`} rows={2} value={value} maxLength={RULE_LIMITS.ruleLength} onChange={(e) => onChange(e.target.value)} placeholder={EXAMPLE} aria-invalid={Boolean(error)} aria-describedby="rule-check" />
      <span id="rule-check" role="status" className={error ? 'text-[var(--danger)]' : 'text-[var(--text-tertiary)]'}>{error ?? `For example: ${EXAMPLE}`}</span>
    </label>
  );
}

function ScopeField({ value, onChange }) {
  return (
    <fieldset className="m-0 flex gap-4 border-0 p-0 text-[13px] text-foreground">
      <legend className="mb-1 text-[12.5px] text-muted-foreground">Look in</legend>
      <label className="flex items-center gap-1.5"><input type="radio" name="scope" checked={value === 'title'} onChange={() => onChange('title')} /> Titles</label>
      <label className="flex items-center gap-1.5"><input type="radio" name="scope" checked={value === 'all'} onChange={() => onChange('all')} /> Titles and full text</label>
    </fieldset>
  );
}

function FolderField({ value, onChange }) {
  const { folders } = useLibrary();
  return (
    <label className={LABEL}>
      Only in
      <select className={FIELD} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All your feeds</option>
        {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </label>
  );
}

/**
 * Make or change a rule filter (PR-13): a name, the rule, where it looks
 * (titles, or titles and full text) and, optionally, one folder. The rule is
 * checked as it's typed; onSaved(filter) opens it.
 */
export function FilterDialog({ filter, onClose, onSaved, onRemoved }) {
  const { form, set, check, ready, state, submit } = useFilterForm(filter, onSaved);
  const remove = async () => { await removeRuleFilter(filter.id); onRemoved(filter.id); };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !state.busy) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-3">
          <DialogHeader>
            <DialogTitle>{filter ? 'Edit filter' : 'New filter'}</DialogTitle>
            <DialogDescription>Articles from your feeds that match a rule, as they arrive. Words and &quot;phrases&quot;, with AND, OR, NOT and brackets; two words side by side mean AND.</DialogDescription>
          </DialogHeader>
          <label className={LABEL}>
            Name
            <input className={FIELD} value={form.name} maxLength={RULE_LIMITS.nameLength} onChange={(e) => set('name')(e.target.value)} placeholder="EU AI rules" />
          </label>
          <RuleField value={form.rule} onChange={set('rule')} error={check.error} />
          <ScopeField value={form.scope} onChange={set('scope')} />
          <FolderField value={form.folderId} onChange={set('folderId')} />
          {state.error && <p role="alert" className="m-0 text-[13px] text-[var(--danger)]">{state.error}</p>}
          <DialogFooter>
            {filter && <Button type="button" variant="ghost" className="mr-auto text-[var(--danger)]" onClick={remove}>Delete filter</Button>}
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!ready}>{state.busy ? 'Saving…' : 'Save filter'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
