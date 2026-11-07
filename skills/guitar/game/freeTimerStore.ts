// Whether the free practice timer runs: written by FreePractice, read by the ambience.
let running = false;
const listeners = new Set<() => void>();

export function setFreeTimerRunning(next: boolean): void {
  if (next === running) return;
  running = next;
  for (const listener of listeners) listener();
}

export function getFreeTimerRunning(): boolean {
  return running;
}

export function subscribeFreeTimer(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
