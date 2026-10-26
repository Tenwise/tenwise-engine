import { useRef, useState } from 'react';
import { HiOutlineArrowDownTray, HiOutlineArrowUpTray, HiOutlineTrash } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { useLibrary } from '../../app/LibraryContext.jsx';
import { useConfirmAction } from '../../hooks/useConfirmAction.js';
import { settingsPath } from '../../settings/sync.js';
import { generateOPML, parseOPML } from '../../utils/opml.js';
import { useSettingsEnv } from './env.js';
import { importResultMessage } from './settingsModel.js';

function download(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportOPMLControl() {
  const { feeds, folders } = useLibrary();
  return (
    <Button variant="outline" size="sm" onClick={() => download(generateOPML(feeds, folders), 'tenwise-feeds.opml', 'text/xml')}>
      <HiOutlineArrowDownTray /> Export OPML
    </Button>
  );
}

export function ImportOPMLControl() {
  const { importFeedsFromOPML } = useLibrary();
  const { showToast, onClose } = useSettingsEnv();
  const inputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const importFile = async (file) => {
    setImporting(true);
    try {
      const { text, type } = importResultMessage(await importFeedsFromOPML(parseOPML(await file.text())));
      showToast(text, type === 'success' ? undefined : type);
      onClose();
    } catch (err) {
      showToast(`Failed to import OPML: ${err.message}`, 'error');
    }
    setImporting(false);
  };
  return (
    <>
      <input ref={inputRef} type="file" accept=".opml,.xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
      <Button variant="outline" size="sm" disabled={importing} onClick={() => inputRef.current?.click()}>
        <HiOutlineArrowUpTray /> {importing ? 'Importing…' : 'Import OPML'}
      </Button>
    </>
  );
}

export function SettingsFileControl() {
  const path = settingsPath();
  return <code className="block max-w-full break-all rounded-md bg-[var(--bg-primary)] px-2.5 py-2 font-mono text-[12px] text-muted-foreground">{path || 'Not connected to the server: settings are kept in this browser only.'}</code>;
}

export function ClearAllControl() {
  const { onClearAll } = useLibrary();
  const { onClose } = useSettingsEnv();
  const confirm = useConfirmAction(async () => { await onClearAll(); onClose(); }, 3000);
  return (
    <Button variant="destructive" size="sm" onClick={confirm.trigger}>
      <HiOutlineTrash /> {confirm.armed ? 'Click again to confirm' : 'Clear all data'}
    </Button>
  );
}
