import { HiOutlineBell, HiOutlinePlus } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from './parts.jsx';

const STEPS = [
  <>Go to <a className="text-primary" href="https://www.google.com/alerts" target="_blank" rel="noopener noreferrer">google.com/alerts</a></>,
  <>Enter a search term and click “Show options”</>,
  <>Change “Deliver to” from Email to <strong className="text-foreground">RSS feed</strong></>,
  <>Click “Create Alert”</>,
  <>Click the RSS icon next to the alert and copy its URL</>,
  <>Paste it below</>,
];

/** Google Alerts tab: how to get an alert's RSS URL, and a box for it (added via the URL tab). */
export function AlertsTab({ url, onUrlChange, onSubmit }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="m-0 mb-2 flex items-center gap-2 text-[13.5px] font-semibold text-foreground"><HiOutlineBell className="size-4 text-primary" /> Google Alerts as RSS</h3>
        <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-[13px] leading-relaxed text-muted-foreground">
          {STEPS.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
      </Card>
      <div className="flex gap-2">
        <Input
          className="flex-1"
          placeholder="Paste the Google Alerts RSS URL"
          aria-label="Google Alerts RSS URL"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
        />
        <Button className="h-9" onClick={onSubmit} disabled={!url.trim()}><HiOutlinePlus /> Add</Button>
      </div>
    </div>
  );
}
