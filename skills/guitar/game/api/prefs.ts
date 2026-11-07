import type { PrefKey, ResolvedPrefs } from "@skills/core";
import { api } from "../../../../packages/web/src/api/client.js";
import { SKILL } from "./client.js";

export const PREFS_KEY = ["prefs", SKILL];

// Own key, outside the game prefix: game writes (refreshing) must not refetch prefs mid-optimistic-update.
export const prefsApi = {
  prefs: () => api.get<{ prefs: ResolvedPrefs }>(`/api/game/${SKILL}/prefs`),
  setPref: (key: PrefKey, value: unknown) => api.put<{ ok: true }>(`/api/game/${SKILL}/prefs`, { key, value }),
  resetPrefs: () => api.del<{ ok: true }>(`/api/game/${SKILL}/prefs`),
  resetPref: (key: PrefKey) => api.del<{ ok: true }>(`/api/game/${SKILL}/prefs/${encodeURIComponent(key)}`),
};
