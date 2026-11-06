export interface ScrollRange {
  start: number;
  end: number;
  viewport: number;
  loop: boolean;
}

/** Largest scrollTop at which the range still fills the window, never before its start. */
function lastTop(range: ScrollRange): number {
  return Math.max(range.start, range.end - range.viewport);
}

/**
 * Next scroll position for one auto-scroll tick.
 * A whole song stops at its end. A loop jumps in from outside, wraps back to its start,
 * and holds still when it fits the window.
 */
export function nextScrollTop(current: number, step: number, range: ScrollRange): { top: number; done: boolean } {
  const last = lastTop(range);
  if (range.loop) {
    if (current < range.start || current > last) return { top: range.start, done: false };
    const next = current + step;
    return { top: next > last ? range.start : next, done: false };
  }
  const top = Math.min(current + step, last);
  return { top, done: top >= last };
}
