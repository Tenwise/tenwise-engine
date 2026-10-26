// Toolbar intrinsic size (one row, no note).
export const TOOLBAR_HEIGHT = 40;
export const TOOLBAR_WIDTH = 210;
const GAP = 8;

/**
 * Where to place the highlight toolbar: centred over the selection and
 * clamped inside the reader panel; above the selection unless that would
 * cross the panel top, then below.
 */
export function toolbarPosition(selRect, containerRect) {
  const centred = selRect.left + selRect.width / 2 - TOOLBAR_WIDTH / 2;
  const left = Math.min(containerRect.right - TOOLBAR_WIDTH - GAP, Math.max(containerRect.left + GAP, centred));
  const above = selRect.top - TOOLBAR_HEIGHT - GAP;
  const top = above >= containerRect.top + GAP ? above : selRect.bottom + GAP;
  return { top, left };
}
