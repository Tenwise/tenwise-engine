import { useState } from 'react';
import { HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { serverStatus } from '../../app/serverStatus.js';
import { useServerDown } from '../../app/useServerDown.js';

const Command = ({ children }) => <code className="font-mono text-[12px] text-foreground">{children}</code>;

/**
 * Shown while the local server isn't answering, so the app doesn't just look
 * empty. It goes away by itself when the server is back (serverStatus keeps
 * checking); Try again checks now.
 */
export default function ServerBanner() {
  const down = useServerDown();
  const [checking, setChecking] = useState(false);
  if (!down) return null;
  const retry = async () => {
    setChecking(true);
    await serverStatus.check();
    setChecking(false);
  };
  return (
    <div role="alert" className="fixed left-1/2 top-3 z-[1900] flex w-[min(600px,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 rounded-lg border border-border bg-[var(--bg-modal)] px-4 py-3 text-[13px] shadow-2xl">
      <HiOutlineExclamationTriangle className="mt-0.5 size-5 shrink-0 text-[var(--warning)]" />
      <div className="min-w-0 flex-1">
        <p className="m-0 font-medium text-foreground">Can&apos;t reach the Tenwise server</p>
        <p className="m-0 mt-1 leading-[1.5] text-muted-foreground">
          Your articles are safe on disk. Start it again in the engine's folder with <Command>npm run dev</Command> or <Command>npm start</Command>, or <Command>npm run service restart</Command> for the background service. This page reconnects on its own.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={retry} disabled={checking}>{checking ? 'Checking…' : 'Try again'}</Button>
    </div>
  );
}
