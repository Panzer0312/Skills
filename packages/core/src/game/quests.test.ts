import { describe, expect, it } from "vitest";
import {
  bestNext,
  buildDailyQuests,
  lessonMasteryTarget,
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

describe("buildDailyQuests slots", () => {
  const lesson = (quest: QuestDefinition, lessonId: string | null): QuestDefinition => ({ ...quest, lessonId });
  const slots: GameContent = {
    ...content,
    quests: [
      q("a", "technik", 10),
      lesson(q("theorie-1", "theorie", 5), "lt1"),
      lesson(q("theorie-2", "theorie", 5), "lt2"),
      lesson(q("warm-1", "aufwaermen", 5), "lw1"),
      lesson(q("warm-2", "aufwaermen", 5), "lw2"),
    ],
  };
  const fill = (o: { statuses?: Record<string, LessonStatus>; recentQuestIds?: string[] }) =>
    buildDailyQuests({ minutes: 20, hasTargetSong: false, statuses: {}, recentQuestIds: [], content: slots, ...o });

  it("takes the first of a kind on a fresh start", () => {
    expect(fill({})).toEqual(["a", "theorie-1", "warm-1"]);
  });
  it("skips a slot quest of a finished lesson", () => {
    expect(fill({ statuses: { lt1: "gelernt", lw1: "gemeistert" } })).toEqual(["a", "theorie-2", "warm-2"]);
  });
  it("skips a slot quest played yesterday", () => {
    expect(fill({ recentQuestIds: ["theorie-1", "warm-1"] })).toEqual(["a", "theorie-2", "warm-2"]);
  });
  it("keeps a slot quest of an active lesson", () => {
    expect(fill({ statuses: { lt1: "aktiv" } })).toEqual(["a", "theorie-1", "warm-1"]);
  });
  it("falls back to the first of a kind when none is left", () => {
    const statuses: Record<string, LessonStatus> = { lt1: "gelernt", lt2: "gelernt", lw1: "gelernt", lw2: "gelernt" };
    expect(fill({ statuses })).toEqual(["a", "theorie-1", "warm-1"]);
  });
});

describe("lessonMasteryTarget", () => {
  const target = (id: string, lessonId: string | null, masteryTarget?: number): QuestDefinition => ({
    ...q(id, "technik", 5),
    lessonId,
    ...(masteryTarget !== undefined ? { masteryTarget } : {}),
  });
  it("takes the highest target of any quest on the lesson", () => {
    const quests = [target("a", "l"), target("b", "l", 40), target("c", "l", 30), target("d", "m", 90)];
    expect(lessonMasteryTarget(quests, "l")).toBe(40);
  });
  it("has no target for a lesson without a metric", () => {
    expect(lessonMasteryTarget([target("a", "l")], "l")).toBeUndefined();
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
