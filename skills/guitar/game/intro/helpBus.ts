const EVENT = "guitar:intro-help";

/** Ask the mounted tour to show a single step (the "?" buttons call this). */
export function openIntroStep(id: string): void {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: id }));
}

export function onIntroStep(handler: (id: string) => void): () => void {
  const listener = (event: Event) =>
    handler((event as CustomEvent<string>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
