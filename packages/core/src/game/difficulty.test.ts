import { describe, expect, it } from "vitest";
import type { Rating } from "./progression.js";
import { isMastered, scaleQuest, suggestLevel } from "./difficulty.js";
import type { QuestDefinition } from "./quests.js";

describe("suggestLevel", () => {
  const at = (rating: Rating, level = 4) => ({ rating, level });
  it("lowers after one too hard", () => expect(suggestLevel([at("zu-schwer")], 4)).toBe(3));
  it("raises after two too easy", () => expect(suggestLevel([at("zu-leicht"), at("zu-leicht")], 4)).toBe(5));
  it("needs two in a row", () => expect(suggestLevel([at("zu-leicht"), at("passt")], 4)).toBeNull());
  it("ignores results from another level", () => {
    expect(suggestLevel([at("zu-leicht", 4), at("zu-leicht", 3)], 4)).toBeNull();
  });
  it("stays within 1 to 10", () => {
    expect(suggestLevel([at("zu-schwer", 1)], 1)).toBeNull();
    expect(suggestLevel([at("zu-leicht", 10), at("zu-leicht", 10)], 10)).toBeNull();
  });
});

describe("isMastered", () => {
  it("uses the target when there is one", () => {
    expect(isMastered([{ rating: "passt", day: "2026-11-01", metricValue: 40 }], 40)).toBe(true);
    expect(isMastered([{ rating: "passt", day: "2026-11-01", metricValue: 39 }], 40)).toBe(false);
  });
  it("needs three different days otherwise", () => {
    const e = (day: string) => ({ rating: "passt" as const, day, metricValue: null });
    expect(isMastered([e("2026-11-01"), e("2026-11-01"), e("2026-11-02")])).toBe(false);
    expect(isMastered([e("2026-11-01"), e("2026-11-02"), e("2026-11-03")])).toBe(true);
  });
  it("ignores too hard ratings", () => {
    const e = (day: string) => ({ rating: "zu-schwer" as const, day, metricValue: null });
    expect(isMastered([e("2026-11-01"), e("2026-11-02"), e("2026-11-03")])).toBe(false);
  });
});

describe("scaleQuest", () => {
  const quest: QuestDefinition = {
    id: "q", title: "Q", description: "", kind: "wechsel", techniqueId: "akkordwechsel",
    lessonId: null, minutes: 5, icon: "x",
    scale: { bpm: [50, 90], tempoPercent: [50, 100], chordPairs: [["Em", "Am"], ["Am", "C"], ["C", "G"], ["G", "D"], ["D", "Am"]] },
  };
  it("is linear from level 1 to 10", () => {
    expect(scaleQuest(quest, 1)).toMatchObject({ bpm: 50, tempoPercent: 50, chordPair: ["Em", "Am"] });
    expect(scaleQuest(quest, 10)).toMatchObject({ bpm: 90, tempoPercent: 100, chordPair: ["D", "Am"] });
    expect(scaleQuest(quest, 5).bpm).toBe(68);
  });
  it("returns null for missing scale parts", () => {
    expect(scaleQuest({ ...quest, scale: {} }, 3)).toEqual({ bpm: null, tempoPercent: null, chordPair: null, section: null, runs: null });
  });
  it("picks a later section at a higher level", () => {
    const withScale = { ...quest, scale: { sections: ["Intro", "Strophe"], runs: [2, 6] as [number, number] } };
    expect(scaleQuest(withScale, 1)).toMatchObject({ section: "Intro", runs: 2 });
    expect(scaleQuest(withScale, 10)).toMatchObject({ section: "Strophe", runs: 6 });
  });
});
