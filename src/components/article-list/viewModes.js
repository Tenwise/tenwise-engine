import { HiOutlineBars3, HiOutlineBars3BottomLeft, HiOutlineRectangleStack } from 'react-icons/hi2';

/**
 * The list's view modes, in toolbar order: Rows (two-line rows under day
 * headings, with a small picture when the article has one; the default),
 * Compact (one line per article, the densest; UX-12) and Grid (big pictures).
 */
export const VIEW_MODES = [
  { id: 'rows', label: 'Rows', title: 'Rows view — two-line rows with day headings and small pictures', Icon: HiOutlineBars3BottomLeft },
  { id: 'compact', label: 'Compact', title: 'Compact view — one line per article, the densest', Icon: HiOutlineBars3 },
  { id: 'magazine', label: 'Grid', title: 'Grid view — cards with big pictures', Icon: HiOutlineRectangleStack },
];

export const DEFAULT_VIEW_MODE = 'rows';

/** A stored or asked-for view mode as one there is: List (and anything unknown) is Rows. */
export const viewModeOf = (mode) => (VIEW_MODES.some((m) => m.id === mode) ? mode : DEFAULT_VIEW_MODE);
