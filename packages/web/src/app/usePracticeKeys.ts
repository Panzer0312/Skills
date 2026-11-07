import { useEffect, useRef } from "react";

// Text fields take every key; buttons and links only need space and Enter for themselves.
const TEXT_FIELDS = "input, textarea, select, [contenteditable]";
const ACTIVATORS = "button, a, [role=button]";
const ACTIVATION_KEYS = new Set([" ", "Enter"]);

export function usePracticeKeys(bindings: Record<string, () => void>, enabled = true): void {
  const ref = useRef(bindings);
  ref.current = bindings;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target;
      if (target instanceof Element) {
        if (target.closest(TEXT_FIELDS)) return;
        if (ACTIVATION_KEYS.has(e.key) && target.closest(ACTIVATORS)) return;
      }
      const current = ref.current;
      const own = (key: string) => (Object.hasOwn(current, key) ? current[key] : undefined);
      const handler = own(e.key) ?? (e.key.length === 1 ? own(e.key.toLowerCase()) : undefined);
      if (!handler) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
