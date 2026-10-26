import { useMemo } from 'react';
import { HiOutlineMagnifyingGlass } from 'react-icons/hi2';
import { Input } from '@/components/ui/input';
import { getDomain, searchCatalog } from './catalog.js';
import { FeedAddButton } from './FeedAddButton.jsx';
import { pluginsOf } from '../../plugins/index.js';
import { FeedRow, Hint } from './parts.jsx';

// Offers added by plugins (src/plugins/index.js), shown under the results.
const OFFERS = pluginsOf('searchOffers');

function CatalogResults({ results, query, adder }) {
  if (results.length === 0) return <Hint>No curated feeds match “{query}”.</Hint>;
  return (
    <div>
      <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">{results.length} curated feed{results.length !== 1 ? 's' : ''}</div>
      {results.map(({ feed, category, emoji }) => (
        <FeedRow key={feed.url} siteUrl={feed.siteUrl} title={feed.title} description={feed.description} meta={`${getDomain(feed.siteUrl)} · ${emoji} ${category}`}>
          <FeedAddButton url={feed.url} adder={adder} />
        </FeedRow>
      ))}
    </div>
  );
}

/** Search tab: instant search of the curated catalog, then any plugin offers for the query. */
export function SearchTab({ query, onQueryChange, onOpenTab, adder }) {
  const results = useMemo(() => searchCatalog(query), [query]);
  const hasQuery = Boolean(query.trim());
  return (
    <div className="flex flex-col gap-4">
      <Input
        icon={HiOutlineMagnifyingGlass}
        placeholder="Search 150+ curated feeds by name, topic or category"
        aria-label="Search curated feeds"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the field opens with its Add feed tab, so focus belongs in it
        autoFocus
      />
      {!hasQuery && <Hint>Search <strong className="text-foreground">150+ curated feeds</strong> across 24 categories. Try “AI”, “climate”, “design”.</Hint>}
      {hasQuery && <CatalogResults results={results} query={query} adder={adder} />}
      {hasQuery && OFFERS.map(({ id, Offer }) => <Offer key={id} query={query} openTab={onOpenTab} />)}
    </div>
  );
}
