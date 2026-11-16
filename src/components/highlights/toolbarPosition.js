// Toolbar intrinsic size (one row, no note).
export const TOOLBAR_HEIGHT = 40;
export const TOOLBAR_WIDTH = 210;
const GAP = 8;

// A phone's own selection menu (Copy, Look Up) sits just above the selection.
const TOUCH_GAP = 28;

/**
 * Where to place the highlight toolbar: centred over the selection and
 * clamped inside the reader panel; above the selection unless that would
 * cross the panel top, then below. On a touch screen it goes below, clear of
 * the phone's own menu and the selection handles (CON-4).
 */
export function toolbarPosition(selRect, containerRect, { touch = false } = {}) {
  const centred = selRect.left + selRect.width / 2 - TOOLBAR_WIDTH / 2;
  const left = Math.min(containerRect.right - TOOLBAR_WIDTH - GAP, Math.max(containerRect.left + GAP, centred));
  if (touch) return { top: selRect.bottom + TOUCH_GAP, left };
  const above = selRect.top - TOOLBAR_HEIGHT - GAP;
  const top = above >= containerRect.top + GAP ? above : selRect.bottom + GAP;
  return { top, left };
}
