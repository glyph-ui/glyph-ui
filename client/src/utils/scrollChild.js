/**
 * Scroll a child inside `scroller` without moving the page.
 * iOS scrollIntoView() often shifts the visual viewport to the bottom.
 *
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */

/**
 * @param {HTMLElement | null | undefined} scroller
 * @param {HTMLElement | null | undefined} child
 * @param {{ block?: "nearest" | "start", pad?: number }} [opts]
 */
export function scrollChildIntoView(scroller, child, opts = {}) {
  if (!scroller || !child) return;
  const block = opts.block === "start" ? "start" : "nearest";
  const pad = opts.pad ?? 8;
  const s = scroller.getBoundingClientRect();
  const c = child.getBoundingClientRect();
  let next = scroller.scrollTop;
  if (block === "start") {
    next += c.top - s.top - pad;
  } else if (c.top < s.top + pad) {
    next += c.top - s.top - pad;
  } else if (c.bottom > s.bottom - pad) {
    next += c.bottom - s.bottom + pad;
  } else {
    return;
  }
  scroller.scrollTop = Math.max(0, next);
}
