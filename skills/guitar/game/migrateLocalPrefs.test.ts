import { PREFS } from "@skills/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ prefs: vi.fn(), setPref: vi.fn() }));
vi.mock("./api/prefs.js", () => ({ PREFS_KEY: ["prefs"], prefsApi: api }));

import { migrateLocalPrefs } from "./migrateLocalPrefs.js";

const metronome = { beatsPerBar: 3, subdivision: "achtel", accents: [true, false, true], stepBpm: 6, everyBars: 3 };

function serverPrefs(overrides: Record<string, unknown> = {}) {
  const out: Record<string, unknown> = {};
  for (const [k, d] of Object.entries(PREFS)) out[k] = d.default;
  api.prefs.mockResolvedValue({ prefs: { ...out, ...overrides } });
}

beforeEach(() => {
  localStorage.clear();
  api.prefs.mockReset();
  api.setPref.mockReset();
  api.setPref.mockResolvedValue({ ok: true });
  serverPrefs();
});

describe("migrateLocalPrefs", () => {
  it("old local metronome setting migrates once and is removed", async () => {
    localStorage.setItem("guitar.metronome", JSON.stringify(metronome));
    expect(await migrateLocalPrefs()).toBe(true);
    expect(api.setPref).toHaveBeenCalledTimes(1);
    expect(api.setPref).toHaveBeenCalledWith("werkzeuge.metronom", metronome);
    expect(localStorage.getItem("guitar.metronome")).toBeNull();
    expect(await migrateLocalPrefs()).toBe(false);
    expect(api.setPref).toHaveBeenCalledTimes(1);
  });

  it("existing pref is not overwritten by an old local value", async () => {
    serverPrefs({ "werkzeuge.notenfinder.stimmung": "Drop D" });
    localStorage.setItem("guitar.notefinder.tuning", JSON.stringify("Standard"));
    await migrateLocalPrefs();
    expect(api.setPref).not.toHaveBeenCalled();
    expect(localStorage.getItem("guitar.notefinder.tuning")).toBeNull();
  });

  it("migrates the other tool keys and skips invalid values", async () => {
    localStorage.setItem("guitar.tuner.tuning", JSON.stringify("Drop D"));
    localStorage.setItem("guitar.trainer.customPair", JSON.stringify(["D", "A"]));
    localStorage.setItem("guitar.jam", JSON.stringify({ root: "A", style: "polka", bpm: 120, volume: 0.4 }));
    await migrateLocalPrefs();
    expect(api.setPref).toHaveBeenCalledWith("werkzeuge.stimmgeraet.stimmung", "Drop D");
    expect(api.setPref).toHaveBeenCalledWith("werkzeuge.akkordtrainer.eigenesPaar", ["D", "A"]);
    expect(api.setPref).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem("guitar.jam")).toBeNull();
  });

  it("keeps the old key when the write fails and never throws", async () => {
    api.setPref.mockRejectedValue(new Error("offline"));
    localStorage.setItem("guitar.tuner.tuning", JSON.stringify("Drop D"));
    await expect(migrateLocalPrefs()).resolves.toBe(false);
    expect(localStorage.getItem("guitar.tuner.tuning")).not.toBeNull();
  });

  it("does nothing when no old key exists", async () => {
    expect(await migrateLocalPrefs()).toBe(false);
    expect(api.prefs).not.toHaveBeenCalled();
  });
});
