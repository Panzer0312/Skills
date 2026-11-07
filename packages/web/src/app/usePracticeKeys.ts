import { useEffect, useRef } from "react";

const IGNORED = "input, textarea, select, button, [contenteditable]";

export function usePracticeKeys(bindings: Record<string, () => void>, enabled = true): void {
  const ref = useRef(bindings);
  ref.current = bindings;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target;
      if (target instanceof Element && target.closest(IGNORED)) return;
      const current = ref.current;
      const handler =
        current[e.key] ?? (e.key.length === 1 ? current[e.key.toLowerCase()] : undefined);
      if (!handler) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
