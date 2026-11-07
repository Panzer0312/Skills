import { PREFS, type PrefKey, type PrefValue } from "@skills/core";
import { useSyncExternalStore } from "react";

// In-memory stand-in for the server prefs, shared by tests that mock "usePref.js".
const store = new Map<string, unknown>();
const listeners = new Set<() => void>();
let version = 0;
let loading = false;
export const prefWrites: { key: string; value: unknown }[] = [];

function notify() {
  version++;
  listeners.forEach((l) => l());
}

export function resetTestPrefs(values: Partial<Record<PrefKey, unknown>> = {}, options: { loading?: boolean } = {}) {
  store.clear();
  prefWrites.length = 0;
  loading = options.loading ?? false;
  for (const [k, v] of Object.entries(values)) store.set(k, v);
  notify();
}

export function finishTestLoading() {
  loading = false;
  notify();
}

export function testPref(key: PrefKey): unknown {
  // Like the server: an invalid stored value falls back to the default.
  if (!store.has(key)) return PREFS[key].default;
  const checked = PREFS[key].schema.safeParse(store.get(key));
  return checked.success ? checked.data : PREFS[key].default;
}

export function usePref<K extends PrefKey>(
  key: K,
): [PrefValue<K>, (v: PrefValue<K>) => void, { loading: boolean }] {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
  return [
    testPref(key) as PrefValue<K>,
    (v) => {
      store.set(key, v);
      prefWrites.push({ key, value: v });
      notify();
    },
    { loading },
  ];
}
