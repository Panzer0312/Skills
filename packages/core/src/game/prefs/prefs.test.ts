import { describe, expect, it } from "vitest";
import { PREFS, resolvePrefs } from "./index.js";

describe("prefs registry", () => {
  it("resolvePrefs drops unknown keys and falls back on invalid values", () => {
    expect(resolvePrefs({})["intro.gesehen"]).toBe(false);
    expect(resolvePrefs({ "intro.gesehen": true })["intro.gesehen"]).toBe(true);
    const resolved = resolvePrefs({ "intro.gesehen": "ja", "gibt.es.nicht": 1 });
    expect(resolved["intro.gesehen"]).toBe(false);
    expect(Object.keys(resolved).sort()).toEqual(Object.keys(PREFS).sort());
    expect("gibt.es.nicht" in resolved).toBe(false);
  });
});
