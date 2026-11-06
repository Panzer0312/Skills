const TICK_MS = 25;
const AHEAD_S = 0.1;
// Browsers throttle timers in background tabs to about one per second.
const HIDDEN_AHEAD_S = 1.5;

/**
 * Calls onStep for every step falling inside the look-ahead window, with its audio time
 * and running index. Scheduling ahead keeps the click steady; setInterval alone drifts.
 * Returns the stop function.
 */
export function startLookahead({
  context,
  stepSeconds,
  onStep,
}: {
  context: AudioContext;
  stepSeconds: () => number;
  onStep: (time: number, index: number) => void;
}): () => void {
  let next = context.currentTime + 0.05;
  let index = 0;
  const timer = setInterval(() => {
    const ahead = typeof document !== "undefined" && document.hidden ? HIDDEN_AHEAD_S : AHEAD_S;
    while (next < context.currentTime + ahead) {
      onStep(next, index);
      index += 1;
      next += stepSeconds();
    }
  }, TICK_MS);
  return () => clearInterval(timer);
}
