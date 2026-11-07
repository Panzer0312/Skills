import type { PrefKey, ResolvedPrefs } from "@skills/core";
import { api } from "../../../../packages/web/src/api/client.js";
import { SKILL } from "./client.js";

export const PREFS_KEY = ["game", SKILL, "prefs"];

// Prefs are not part of the state view, so a write refreshes only its own query.
export const prefsApi = {
  prefs: () => api.get<{ prefs: ResolvedPrefs }>(`/api/game/${SKILL}/prefs`),
  setPref: (key: PrefKey, value: unknown) => api.put<{ ok: true }>(`/api/game/${SKILL}/prefs`, { key, value }),
  resetPrefs: () => api.del<{ ok: true }>(`/api/game/${SKILL}/prefs`),
  resetPref: (key: PrefKey) => api.del<{ ok: true }>(`/api/game/${SKILL}/prefs/${encodeURIComponent(key)}`),
};
