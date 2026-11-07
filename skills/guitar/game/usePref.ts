import { PREFS, type PrefKey, type PrefValue, type ResolvedPrefs } from "@skills/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { PREFS_KEY, prefsApi } from "./api/prefs.js";

type PrefsData = { prefs: ResolvedPrefs };

function defaults(): ResolvedPrefs {
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(PREFS)) out[key] = def.default;
  return out as ResolvedPrefs;
}

/** The whole resolved prefs object; defaults while loading. */
export function usePrefs(): { prefs: ResolvedPrefs; loading: boolean } {
  const query = useQuery({ queryKey: PREFS_KEY, queryFn: prefsApi.prefs, staleTime: 60_000 });
  return { prefs: query.data?.prefs ?? defaults(), loading: query.isPending };
}

const DEBOUNCE_MS = 300;

type Pending = { timer: ReturnType<typeof setTimeout>; value: unknown; previous: unknown; send: () => void };
// One pending (debounced) write per key; latest value wins.
const pending = new Map<string, Pending>();

function flush(key: string) {
  const p = pending.get(key);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(key);
  p.send();
}

/** One pref: default while loading, optimistic writes (sent debounced, latest wins), rollback if the server refuses. */
export function usePref<K extends PrefKey>(
  key: K,
): [PrefValue<K>, (v: PrefValue<K>) => void, { loading: boolean }] {
  const client = useQueryClient();
  const { prefs, loading } = usePrefs();
  const mutation = useMutation({
    mutationKey: PREFS_KEY,
    // Writes per key run in order.
    scope: { id: `pref:${key}` },
    mutationFn: ({ value }: { value: PrefValue<K>; previous: unknown }) => prefsApi.setPref(key, value),
    // Only this key goes back, and only while it still shows this write's value.
    onError: (_error, { value, previous }) => {
      client.setQueryData<PrefsData>(PREFS_KEY, (old) =>
        old && old.prefs[key] === value ? { prefs: { ...old.prefs, [key]: previous } } : old,
      );
    },
    // The last write to settle reloads, so the cache ends up as the server has it.
    onSettled: () => {
      if (client.isMutating({ mutationKey: PREFS_KEY }) <= 1 && pending.size === 0) {
        void client.invalidateQueries({ queryKey: PREFS_KEY });
      }
    },
  });
  const mutate = useRef(mutation.mutate);
  mutate.current = mutation.mutate;
  // Leaving the screen must not lose the last change.
  useEffect(() => () => flush(key), [key]);

  const set = (value: PrefValue<K>) => {
    const existing = pending.get(key);
    if (existing) clearTimeout(existing.timer);
    // The rollback target is the value from before the burst began.
    const previous = existing
      ? existing.previous
      : (client.getQueryData<PrefsData>(PREFS_KEY)?.prefs[key] ?? defaults()[key]);
    client.setQueryData<PrefsData>(PREFS_KEY, (old) => ({
      prefs: { ...(old?.prefs ?? defaults()), [key]: value },
    }));
    // A refetch still in flight would bring back the old value.
    void client.cancelQueries({ queryKey: PREFS_KEY }, { revert: false });
    pending.set(key, {
      value,
      previous,
      send: () => mutate.current({ value, previous }),
      timer: setTimeout(() => flush(key), DEBOUNCE_MS),
    });
  };
  return [prefs[key], set, { loading }];
}
