import { PREFS, type PrefKey, type PrefValue, type ResolvedPrefs } from "@skills/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

/** One pref: default while loading, optimistic writes, rollback if the server refuses. */
export function usePref<K extends PrefKey>(
  key: K,
): [PrefValue<K>, (v: PrefValue<K>) => void, { loading: boolean }] {
  const client = useQueryClient();
  const { prefs, loading } = usePrefs();
  const mutation = useMutation({
    mutationKey: PREFS_KEY,
    mutationFn: (value: PrefValue<K>) => prefsApi.setPref(key, value),
    onMutate: async (value) => {
      await client.cancelQueries({ queryKey: PREFS_KEY });
      const previous = client.getQueryData<PrefsData>(PREFS_KEY)?.prefs[key] ?? defaults()[key];
      client.setQueryData<PrefsData>(PREFS_KEY, (old) => ({
        prefs: { ...(old?.prefs ?? defaults()), [key]: value },
      }));
      return { previous };
    },
    // Only this key goes back, and only while it still shows this write's value.
    onError: (_error, value, context) => {
      client.setQueryData<PrefsData>(PREFS_KEY, (old) =>
        old && old.prefs[key] === value && context ? { prefs: { ...old.prefs, [key]: context.previous } } : old,
      );
    },
    // The last write to settle reloads, so the cache ends up as the server has it.
    onSettled: () => {
      if (client.isMutating({ mutationKey: PREFS_KEY }) <= 1) void client.invalidateQueries({ queryKey: PREFS_KEY });
    },
  });
  return [prefs[key], (v) => mutation.mutate(v), { loading }];
}
