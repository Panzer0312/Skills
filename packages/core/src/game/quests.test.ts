import { describe, expect, it } from "vitest";
import {
  bestNext,
  buildDailyQuests,
  parseGameContent,
  type GameContent,
  type LessonStatus,
  type QuestDefinition,
} from "./quests.js";

const q = (id: string, kind: QuestDefinition["kind"], minutes: number): QuestDefinition => ({
  id, title: id, description: id, kind, techniqueId: "t", lessonId: null, minutes, icon: "x", scale: {},
});
// fixture: road a->b; quests a(10), b(10), wechsel(5), song(10), theorie(5), warm(5)
const content: GameContent = {
  techniques: [{ id: "t", title: "T" }],
  quests: [q("a", "technik", 10), q("b", "technik", 10), q("wechsel", "wechsel", 5), q("song", "song", 10), q("theorie", "theorie", 5), q("warm", "aufwaermen", 5)],
  road: [
    { lessonId: "la", questId: "a", months: [1, 2], reason: "r" },
    { lessonId: "lb", questId: "b", months: [2, 3], reason: "r" },
  ],
};
function build(o: { minutes?: number; hasTargetSong?: boolean; statuses?: Record<string, LessonStatus>; recentQuestIds?: string[] }) {
  return buildDailyQuests({ minutes: 30, hasTargetSong: true, statuses: {}, recentQuestIds: [], content, ...o });
}

describe("buildDailyQuests", () => {
  it("fills 30 minutes in priority order", () => {
    expect(build({ minutes: 30 })).toEqual(["a", "wechsel", "song", "theorie"]);
  });
  it("skips the song quest without a target song", () => {
    expect(build({ minutes: 30, hasTargetSong: false })).toEqual(["a", "wechsel", "theorie", "warm"]);
  });
  it("trims to the most important item for a short session", () => {
    expect(build({ minutes: 10 })).toEqual(["a"]);
  });
  it("never returns an empty board", () => expect(build({ minutes: 1 })).toEqual(["a"]));
  it("leads with the change drill once the road is finished", () => {
    expect(build({ statuses: { la: "gelernt", lb: "gelernt" }, minutes: 5 })).toEqual(["wechsel"]);
  });
  it("has no duplicates when the best-next quest is the change drill", () => {
    const c = { ...content, road: [{ lessonId: "lw", questId: "wechsel", months: [1, 1] as [number, number], reason: "r" }] };
    const r = buildDailyQuests({ minutes: 30, hasTargetSong: false, statuses: {}, recentQuestIds: [], content: c });
    expect(new Set(r).size).toBe(r.length);
    expect(r[0]).toBe("wechsel");
  });
  it("skips recent quests among the fillers", () => {
    expect(build({ minutes: 60, recentQuestIds: ["b"] })).not.toContain("b");
  });
});

describe("bestNext", () => {
  it("returns the first open, active or missing lesson", () => {
    expect(bestNext(content.road, { la: "gelernt" })?.questId).toBe("b");
    expect(bestNext(content.road, {})?.questId).toBe("a");
    expect(bestNext(content.road, { la: "aktiv" })?.questId).toBe("a");
  });
  it("returns null at the end of the road", () => {
    expect(bestNext(content.road, { la: "gemeistert", lb: "gelernt" })).toBeNull();
  });
});

describe("parseGameContent", () => {
  it("accepts valid content", () => expect(parseGameContent(content)).toEqual(content));
  it("throws a German message", () => {
    expect(() => parseGameContent({})).toThrow(/Spielinhalt/);
  });
});
