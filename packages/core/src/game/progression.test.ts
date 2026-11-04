import { describe, expect, it } from "vitest";
import { computeStreak, levelFromXp, titleForLevel, xpForEntry } from "./progression.js";

describe("xpForEntry", () => {
  it("pays by real time and level", () => {
    expect(xpForEntry({ kind: "frei", seconds: 600, level: 1, rating: null })).toBe(40);
    expect(xpForEntry({ kind: "quest", seconds: 300, level: 6, rating: "passt" })).toBe(40);
  });
  it("gives nothing for no practice", () => {
    expect(xpForEntry({ kind: "quest", seconds: 0, level: 10, rating: "passt" })).toBe(0);
  });
});
describe("levelFromXp", () => {
  it("starts at level 1", () => expect(levelFromXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 100 }));
  it("crosses a level exactly", () => expect(levelFromXp(300)).toEqual({ level: 3, xpIntoLevel: 0, xpForNext: 300 }));
});
describe("titleForLevel", () => {
  it("steps every three levels", () => {
    expect(titleForLevel(3)).toBe("Wandering Novice");
    expect(titleForLevel(4)).toBe("Squire of the Strings");
    expect(titleForLevel(99)).toBe("Legend of the Six Strings");
  });
});
describe("computeStreak", () => {
  it("is zero without practice", () => expect(computeStreak([], "2026-11-04")).toBe(0));
  it("does not break because today is still open", () => {
    expect(computeStreak(["2026-11-02", "2026-11-03"], "2026-11-04")).toBe(2);
  });
  it("forgives one missed day per calendar week", () => {
    expect(computeStreak(["2026-11-02", "2026-11-04"], "2026-11-04")).toBe(2);
  });
  it("breaks on a second miss in one week", () => {
    expect(computeStreak(["2026-11-02", "2026-11-05", "2026-11-06"], "2026-11-06")).toBe(2);
  });
  it("survives the clock change", () => {
    expect(computeStreak(["2026-10-24", "2026-10-25", "2026-10-26"], "2026-10-26")).toBe(3);
  });
});
