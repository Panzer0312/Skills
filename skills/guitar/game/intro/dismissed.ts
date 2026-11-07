import { useSyncExternalStore } from "react";

const KEY = "guitar.intro.dismissed";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

// Survives a failed pref write (rollback) for this session; sessionStorage keeps it over reloads.
let dismissed = read();

function emit() {
  listeners.forEach((l) => l());
}

export function dismissIntro(): void {
  dismissed = true;
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // memory flag is enough
  }
  emit();
}

/** Replay from the settings: forget the local dismissal. */
export function resetIntroDismissed(): void {
  dismissed = false;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  emit();
}

export function useIntroDismissed(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => dismissed,
  );
}
