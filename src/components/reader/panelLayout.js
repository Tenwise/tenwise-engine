const RAIL_STRIP_WIDTH = 44; // the closed rail's strip, see AIDrawer

// Space-separated names of the flags that are on, e.g. { visible: true, zen: false } → 'visible'.
const classList = (flags) => Object.keys(flags).filter((name) => flags[name]).join(' ');

/**
 * Reader panel classes and width: the article column plus the AI rail (or
 * its strip when closed). Focus mode sizes itself (full window), so it gets no width.
 */
export function panelLayout({ visible, zen, rail, width }) {
  const stateClasses = classList({ visible, zen: zen.on });
  const railWidth = rail.open ? rail.width : RAIL_STRIP_WIDTH;
  return {
    stateClasses,
    className: `article-reader-panel ${stateClasses} ${classList({ 'has-rail': rail.open })}`,
    style: zen.on ? undefined : { width: `${width + railWidth}px` },
  };
}

/** The saved AI summary, from the live copy once it belongs to this article. */
export function briefOf(current, article) {
  const latest = current?.id === article.id ? current : article;
  return latest.aiSummary;
}
