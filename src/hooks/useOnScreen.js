import { useLayoutEffect, useRef } from 'react';

const MARGIN = 8;

/**
 * Where a popup opened at (x, y) goes so all of it stays inside the view,
 * `margin` px from its edges: moved left or up as far as it has to be, never
 * past the top-left corner.
 */
export function onScreen({ x, y }, size, view, margin = MARGIN) {
  const fit = (at, length, room) => Math.max(margin, Math.min(at, room - length - margin));
  return { left: fit(x, size.width, view.width), top: fit(y, size.height, view.height) };
}

/**
 * A fixed popup (a "…" or right-click menu) opened at `at` = { x, y }, kept on
 * screen: on a phone the "…" button sits by the right edge, and a menu opened
 * there would run past it. Put the returned ref on the element styled
 * { left: at.x, top: at.y }; it is moved before the browser paints it.
 */
export function useOnScreen(at) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!at || !el) return;
    // Measured at the corner: squeezed against the right edge, a fixed box
    // shrinks to its min-width and would measure narrower than it is.
    el.style.left = '0px';
    el.style.top = '0px';
    const { width, height } = el.getBoundingClientRect();
    const { left, top } = onScreen(at, { width, height }, { width: window.innerWidth, height: window.innerHeight });
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [at]);
  return ref;
}
