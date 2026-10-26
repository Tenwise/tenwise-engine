import { HiOutlineGlobeAlt, HiOutlineMagnifyingGlass } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FeedAddButton } from './FeedAddButton.jsx';
import { Card, FeedRow, SiteIcon } from './parts.jsx';

function FeedPreview({ preview, adder, onAdd }) {
  return (
    <Card>
      <div className="mb-4 flex items-start gap-3">
        {preview.link && <SiteIcon siteUrl={preview.link} size="size-8" />}
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-foreground">{preview.title}</div>
          {preview.description && <div className="mt-0.5 text-[13px] text-muted-foreground">{preview.description}</div>}
          <div className="mt-1 font-mono text-[11px] text-[var(--text-tertiary)]">{preview.items?.length || 0} articles available</div>
        </div>
      </div>
      <FeedAddButton url={preview.feedUrl} adder={adder} label="Add this feed" wide onAdd={onAdd} />
    </Card>
  );
}

function DiscoveredFeeds({ feeds, adder, onPreview }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">Found {feeds.length} feed{feeds.length > 1 ? 's' : ''}</div>
      {feeds.map((feed) => (
        <FeedRow key={feed.url} title={feed.title || 'RSS feed'} meta={feed.url}>
          <Button variant="outline" size="sm" onClick={() => onPreview(feed.url)}>Preview</Button>
          <FeedAddButton url={feed.url} adder={adder} />
        </FeedRow>
      ))}
    </div>
  );
}

// A previewed feed wins over the discovered list; otherwise a spinner while searching.
function UrlResults({ discovery, loading, adder }) {
  const { preview, discovered } = discovery;
  if (preview) {
    const addFromPreview = async () => {
      await adder.add(preview.feedUrl);
      discovery.clear();
    };
    return <FeedPreview preview={preview} adder={adder} onAdd={addFromPreview} />;
  }
  if (loading) return <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted-foreground"><Spinner /> Looking for feeds…</div>;
  return discovered.length > 0 ? <DiscoveredFeeds feeds={discovered} adder={adder} onPreview={discovery.previewFeed} /> : null;
}

/** URL tab: paste a site or feed URL; preview a direct feed or pick from discovered ones. */
export function UrlTab({ discovery, loading, adder }) {
  const { url, setUrl } = discovery;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Input
          className="flex-1"
          icon={HiOutlineGlobeAlt}
          placeholder="Paste a website or RSS feed URL"
          aria-label="Website or feed URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && discovery.discover()}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the field opens with its Add feed tab, so focus belongs in it
          autoFocus
        />
        <Button className="h-9" onClick={discovery.discover} disabled={loading || !url.trim()}>
          {loading ? <Spinner /> : <HiOutlineMagnifyingGlass />} Find feeds
        </Button>
      </div>
      <UrlResults discovery={discovery} loading={loading} adder={adder} />
    </div>
  );
}
