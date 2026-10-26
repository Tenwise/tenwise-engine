import {
  HiOutlineBars3BottomLeft, HiOutlineDocumentText, HiOutlineQueueList, HiOutlineRectangleStack,
} from 'react-icons/hi2';

/** The list's view modes, in toolbar order. */
export const VIEW_MODES = [
  { id: 'rows', label: 'Rows', title: 'Rows view — dense two-line rows with day headings', Icon: HiOutlineBars3BottomLeft },
  { id: 'magazine', label: 'Grid', title: 'Grid view — portrait thumbnail cards', Icon: HiOutlineRectangleStack },
  { id: 'excerpt', label: 'List', title: 'List view — title with excerpt and thumbnail', Icon: HiOutlineDocumentText },
  { id: 'compact', label: 'Compact', title: 'Compact view — dense single-line rows', Icon: HiOutlineQueueList },
];
