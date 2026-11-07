import type { PrefDef } from "./types.js";

/** Gives a group file type safety without widening its keys. */
export function definePrefs<T extends Record<string, PrefDef<any>>>(defs: T): T {
  return defs;
}
