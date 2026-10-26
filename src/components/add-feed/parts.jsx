import { cn } from '@/lib/utils';
import { getFaviconUrl } from '../../utils/helpers.js';

const hideOnError = (e) => { e.currentTarget.style.display = 'none'; };

/** Site icon from the favicon service; hidden if it fails to load. */
export const SiteIcon = ({ siteUrl, size = 'size-5' }) => (
  <img src={getFaviconUrl(siteUrl)} alt="" onError={hideOnError} className={cn('mt-0.5 shrink-0 rounded', size)} />
);

/**
 * One feed in a list: icon, title, description, meta line, action. `dim`
 * (already added) fades the icon and mutes the title's color; text is never
 * faded with opacity, so it keeps 4.5:1 contrast.
 */
export function FeedRow({ siteUrl, title, description, meta, children, dim }) {
  return (
    <div className="flex items-start gap-3 border-b border-border py-3 last:border-b-0">
      {siteUrl && <SiteIcon siteUrl={siteUrl} size={cn('size-5', dim && 'opacity-50')} />}
      <div className="min-w-0 flex-1">
        <div className={cn('truncate text-[13.5px] font-medium', dim ? 'text-muted-foreground' : 'text-foreground')}>{title}</div>
        {description && <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{description}</div>}
        {meta && <div className="mt-1 font-mono text-[11px] text-[var(--text-tertiary)]">{meta}</div>}
      </div>
      <div className="flex shrink-0 gap-1.5">{children}</div>
    </div>
  );
}

/** Quiet centered hint. */
export function Hint({ children }) {
  return <div className="py-10 text-center text-[13px] leading-relaxed text-muted-foreground">{children}</div>;
}

/** A bordered card. */
export function Card({ children, className }) {
  return <div className={cn('rounded-lg border border-border bg-[var(--bg-primary)] p-4', className)}>{children}</div>;
}
