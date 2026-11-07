import { prefs as allgemein } from "./allgemein.js";
import { prefs as darstellung } from "./darstellung.js";
import { prefs as daten } from "./daten.js";
import { prefs as geraete } from "./geraete.js";
import { prefs as klang } from "./klang.js";
import { prefs as mentor } from "./mentor.js";
import { prefs as ueben } from "./ueben.js";
import { prefs as werkzeuge } from "./werkzeuge.js";
import type { z } from "zod";
import type { PrefDef } from "./types.js";

export { definePrefs } from "./define.js";
export type { PrefDef, PrefGroup, PrefUi } from "./types.js";

export const PREFS = {
  ...allgemein,
  ...klang,
  ...ueben,
  ...werkzeuge,
  ...geraete,
  ...darstellung,
  ...mentor,
  ...daten,
};

export type PrefKey = keyof typeof PREFS;
export type PrefValue<K extends PrefKey> = z.infer<(typeof PREFS)[K]["schema"]>;
export type ResolvedPrefs = { [K in PrefKey]: PrefValue<K> };

/** Validates each stored value; invalid or missing ones fall back to the default, unknown keys are dropped. */
export function resolvePrefs(stored: Record<string, unknown>): ResolvedPrefs {
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(PREFS) as [string, PrefDef<unknown>][]) {
    const parsed = key in stored ? def.schema.safeParse(stored[key]) : undefined;
    out[key] = parsed?.success ? parsed.data : def.default;
  }
  return out as ResolvedPrefs;
}

export function isPrefKey(key: string): key is PrefKey {
  return Object.prototype.hasOwnProperty.call(PREFS, key);
}
