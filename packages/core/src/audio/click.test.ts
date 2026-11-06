import { describe, expect, it } from "vitest";
import { clickLevel, defaultAccents, speedTrainerBpm, SUBDIVISIONS } from "./click.js";

const base = { beatsPerBar: 4, subdivision: "viertel" as const, accents: defaultAccents(4) };

describe("clickLevel", () => {
  it("accents the first beat and plays the others plainly", () => {
    expect(clickLevel(0, base)).toBe("betont");
    expect(clickLevel(1, base)).toBe("schlag");
    expect(clickLevel(4, base)).toBe("betont");
  });

  it("rests and softens steps according to the gallop pattern", () => {
    const gallop = { ...base, subdivision: "galopp" as const };
    expect([0, 1, 2, 3].map((s) => clickLevel(s, gallop))).toEqual(["betont", "stumm", "unter", "unter"]);
    expect(clickLevel(4, gallop)).toBe("schlag");
  });

  it("counts triplet steps per beat", () => {
    const triplet = { ...base, subdivision: "triole" as const };
    expect(clickLevel(3, triplet)).toBe("schlag");
  });

  it("follows custom accents", () => {
    expect(clickLevel(2, { ...base, accents: [true, false, true, false] })).toBe("betont");
  });

  it("labels every subdivision", () => {
    expect(Object.values(SUBDIVISIONS).map((s) => s.label)).toEqual([
      "Viertel",
      "Achtel",
      "Triolen",
      "Sechzehntel",
      "Galopp",
    ]);
  });
});

describe("defaultAccents", () => {
  it("turns on only the first beat", () => {
    expect(defaultAccents(3)).toEqual([true, false, false]);
  });
});

describe("speedTrainerBpm", () => {
  const t = { startBpm: 60, targetBpm: 70, stepBpm: 4, everyBars: 2 };
  it("steps up every few bars and stops at the target", () => {
    expect(speedTrainerBpm(t, 0)).toBe(60);
    expect(speedTrainerBpm(t, 1)).toBe(60);
    expect(speedTrainerBpm(t, 2)).toBe(64);
    expect(speedTrainerBpm(t, 100)).toBe(70);
  });
  it("handles odd settings", () => {
    expect(speedTrainerBpm({ ...t, targetBpm: 50 }, 10)).toBe(60);
    expect(speedTrainerBpm({ ...t, targetBpm: 400, stepBpm: 100 }, 100)).toBe(300);
    expect(speedTrainerBpm({ ...t, stepBpm: 0 }, 10)).toBe(60);
    expect(speedTrainerBpm({ ...t, everyBars: 0 }, 10)).toBe(60);
  });
});
