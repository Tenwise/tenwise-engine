import { cn } from '@/lib/utils';
import { POPULAR_FEEDS } from '../../utils/constants.js';
import { categoriesFor, getDomain } from './catalog.js';
import { FeedAddButton } from './FeedAddButton.jsx';
import { FeedRow } from './parts.jsx';

function CategoryPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('h-7 shrink-0 cursor-pointer rounded-full border px-3 text-xs transition-colors', active ? 'border-primary bg-[var(--accent-muted)] text-foreground' : 'border-border bg-transparent text-muted-foreground hover:text-foreground')}
    >
      {children}
    </button>
  );
}

/** Popular tab: curated feeds by category. */
export function PopularTab({ category, onCategoryChange, adder }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        <CategoryPill active={category === 'all'} onClick={() => onCategoryChange('all')}>All</CategoryPill>
        {POPULAR_FEEDS.map((cat) => (
          <CategoryPill key={cat.category} active={category === cat.category} onClick={() => onCategoryChange(cat.category)}>{cat.emoji} {cat.category}</CategoryPill>
        ))}
      </div>
      {categoriesFor(category).map((cat) => (
        <section key={cat.category}>
          <h3 className="m-0 flex items-baseline gap-2 text-[14px] font-semibold text-foreground">
            {cat.emoji} {cat.category}
            <span className="text-xs font-normal text-muted-foreground">{cat.description}</span>
          </h3>
          {cat.feeds.map((feed) => (
            <FeedRow key={feed.url} siteUrl={feed.siteUrl} title={feed.title} description={feed.description} meta={getDomain(feed.siteUrl)} dim={adder.isAdded(feed.url)}>
              <FeedAddButton url={feed.url} adder={adder} />
            </FeedRow>
          ))}
        </section>
      ))}
    </div>
  );
}
