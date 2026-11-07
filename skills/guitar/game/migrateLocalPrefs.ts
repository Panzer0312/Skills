import { PREFS, type PrefKey } from "@skills/core";
import { prefsApi } from "./api/prefs.js";

// Old localStorage keys of the tools, and the pref each one moved to.
const OLD_KEYS: [string, PrefKey][] = [
  ["guitar.metronome", "werkzeuge.metronom"],
  ["guitar.jam", "werkzeuge.jam"],
  ["guitar.tuner.tuning", "werkzeuge.stimmgeraet.stimmung"],
  ["guitar.notefinder.tuning", "werkzeuge.notenfinder.stimmung"],
  ["guitar.trainer.customPair", "werkzeuge.akkordtrainer.eigenesPaar"],
];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

/** Moves old local tool settings into the server prefs. Resolves true when something was written. */
export async function migrateLocalPrefs(): Promise<boolean> {
  try {
    const present = OLD_KEYS.filter(([old]) => read(old) !== null);
    if (present.length === 0) return false;
    const { prefs } = await prefsApi.prefs();
    let wrote = false;
    for (const [old, key] of present) {
      try {
        const raw = read(old);
        if (raw === null) continue;
        let value: unknown;
        let valid = false;
        try {
          const checked = PREFS[key].schema.safeParse(JSON.parse(raw));
          valid = checked.success;
          if (checked.success) value = checked.data;
        } catch {
          valid = false;
        }
        const untouched = JSON.stringify(prefs[key]) === JSON.stringify(PREFS[key].default);
        if (valid && untouched) {
          await prefsApi.setPref(key, value);
          wrote = true;
        }
        remove(old);
      } catch {
        // Keep the old key, so the next load tries again.
      }
    }
    return wrote;
  } catch {
    return false;
  }
}
