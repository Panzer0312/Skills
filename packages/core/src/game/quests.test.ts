import { describe, expect, it } from "vitest";
import type { MapNode } from "./map.js";
import {
  bestNext,
  buildDailyQuests,
  lessonMasteryTarget,
  parseGameContent,
  type GameContent,
  type LessonStatus,
  type QuestDefinition,
  type RoadStep,
} from "./quests.js";

const q = (id: string, kind: QuestDefinition["kind"], minutes: number, lessonId: string | null = null): QuestDefinition => ({
  id, title: id, description: id, kind, techniqueId: "t", lessonId, minutes, icon: "x", scale: {},
});
const node = (id: string, extra: Partial<MapNode> = {}): MapNode => ({
  id, title: id, description: id, path: "hafen", rank: 1, x: 0, y: 0, parent: null, quick: false,
  available: true, knownSong: false, techniqueId: null, links: [], songs: [], targetSong: null, ...extra,
});
const step = (lessonId: string, questId: string | null): RoadStep => ({ lessonId, questId, months: [1, 1], reason: "r" });
// fixture: road la->lb->lc; quests a(10), b(10), c(10), wechsel(5), song(10), theorie(5), warm(5)
const content: GameContent = {
  techniques: [{ id: "t", title: "T" }],
  quests: [
    q("a", "technik", 10, "la"), q("b", "technik", 10, "lb"), q("qc", "technik", 10, "lc"),
    q("wechsel", "wechsel", 5), q("song", "song", 10), q("theorie", "theorie", 5), q("warm", "aufwaermen", 5),
  ],
  road: [step("la", "a"), step("lb", "b")],
  paths: [],
  nodes: [node("la"), node("lb"), node("lc")],
};
function build(o: { minutes?: number; hasTargetSong?: boolean; statuses?: Record<string, LessonStatus>; recentQuestIds?: string[]; chosenLessonIds?: string[] }) {
  return buildDailyQuests({ minutes: 30, hasTargetSong: true, statuses: {}, recentQuestIds: [], chosenLessonIds: [], content, ...o });
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
    const c = { ...content, road: [step("la", "wechsel")] };
    const r = buildDailyQuests({ minutes: 30, hasTargetSong: false, statuses: {}, recentQuestIds: [], chosenLessonIds: [], content: c });
    expect(new Set(r).size).toBe(r.length);
    expect(r[0]).toBe("wechsel");
  });
  it("adds chosen lessons after the drill", () => {
    expect(build({ minutes: 30, chosenLessonIds: ["lc"] }).slice(0, 3)).toEqual(["a", "wechsel", "qc"]);
  });
  it("keeps best next first when a chosen lesson is also on the road", () => {
    expect(build({ minutes: 30, chosenLessonIds: ["la"] })[0]).toBe("a");
  });
  it("skips recent quests among the fillers", () => {
    expect(build({ minutes: 60, recentQuestIds: ["b"] })).not.toContain("b");
  });
});

describe("buildDailyQuests slots", () => {
  const ids = ["la", "lt1", "lw1", "lt2", "lw2", "lt-spaet"];
  const slots: GameContent = {
    ...content,
    quests: [
      q("a", "technik", 10, "la"),
      q("theorie-1", "theorie", 5, "lt1"),
      q("theorie-2", "theorie", 5, "lt2"),
      q("theorie-spaet", "theorie", 5, "lt-spaet"),
      q("warm-1", "aufwaermen", 5, "lw1"),
      q("warm-2", "aufwaermen", 5, "lw2"),
    ],
    road: ids.map((id) => step(id, "a")),
    nodes: ids.map((id) => node(id)),
  };
  const upTo = { la: "gelernt", lt1: "gelernt", lw1: "gelernt" } as Record<string, LessonStatus>;
  const all = Object.fromEntries(ids.map((id) => [id, "gelernt"])) as Record<string, LessonStatus>;
  const fill = (statuses: Record<string, LessonStatus>, recentQuestIds: string[] = []) =>
    buildDailyQuests({ minutes: 45, hasTargetSong: false, statuses, recentQuestIds, chosenLessonIds: [], content: slots });

  it("takes the first reached unfinished quest, then a reached one", () => {
    expect(fill(upTo).slice(0, 3)).toEqual(["a", "theorie-2", "warm-1"]);
  });
  it("does not offer theory or warm-up beyond the road position", () => {
    const result = fill(upTo);
    expect(result).not.toContain("theorie-spaet");
    expect(result).not.toContain("warm-2");
    expect(fill({})).toEqual(["a"]);
  });
  it("skips a slot quest played yesterday", () => {
    expect(fill(upTo, ["theorie-2"]).slice(0, 3)).toEqual(["a", "theorie-1", "warm-1"]);
  });
  it("rotates reached theory when all of it is finished", () => {
    expect(fill(all, ["theorie-1"]).slice(0, 2)).toEqual(["theorie-2", "warm-1"]);
  });
  it("falls back to the first reached of a kind when none is left", () => {
    expect(fill(all, ["theorie-1", "theorie-2", "theorie-spaet", "warm-1", "warm-2"]).slice(0, 2)).toEqual(["theorie-1", "warm-1"]);
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

describe("bestNext planned steps", () => {
  it("never points at a planned step", () => {
    expect(bestNext([step("a", null), step("b", "qb")], {})?.lessonId).toBe("b");
  });
  it("is null when only planned steps remain", () => {
    expect(bestNext([step("a", "qa"), step("b", null)], { a: "gelernt" })).toBeNull();
  });
});

describe("parseGameContent", () => {
  it("accepts valid content", () => expect(parseGameContent(content)).toEqual(content));
  it("rejects a link to an unknown node", () => {
    const bad = { ...content, nodes: [node("la", { links: [{ to: "zz", reason: "r" }] }), node("lb"), node("lc")] };
    expect(() => parseGameContent(bad)).toThrow(/links/);
  });
  it("rejects duplicate node ids", () => {
    expect(() => parseGameContent({ ...content, nodes: [node("la"), node("la"), node("lb"), node("lc")] })).toThrow(/mehrfach/);
  });
  it("rejects a road step without a node and an unknown quest", () => {
    expect(() => parseGameContent({ ...content, road: [step("zz", "a")] })).toThrow(/road\.0\.lessonId/);
    expect(() => parseGameContent({ ...content, road: [step("la", "zz")] })).toThrow(/road\.0\.questId/);
  });
  it("rejects an unknown parent, technique and quest lesson", () => {
    expect(() => parseGameContent({ ...content, nodes: [node("la", { parent: "zz" }), node("lb"), node("lc")] })).toThrow(/parent/);
    expect(() => parseGameContent({ ...content, nodes: [node("la", { techniqueId: "zz" }), node("lb"), node("lc")] })).toThrow(/techniqueId/);
    expect(() => parseGameContent({ ...content, quests: [q("a", "technik", 5, "zz")] })).toThrow(/quests\.0\.lessonId/);
  });
  it("throws a German message", () => {
    expect(() => parseGameContent({})).toThrow(/Spielinhalt/);
  });
});
