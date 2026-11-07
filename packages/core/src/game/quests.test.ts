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
  available: true, knownSong: false, techniqueId: null, links: [], songs: [], targetSong: null, chooseTarget: false, ...extra,
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
  riffs: [],
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
  it("keeps a song quest out of the fillers without a target song", () => {
    expect(build({ minutes: 120, hasTargetSong: false })).not.toContain("song");
  });
  it("keeps a song quest that is the best next without a target song", () => {
    const c = { ...content, road: [step("la", "song")] };
    const r = buildDailyQuests({ minutes: 30, hasTargetSong: false, statuses: {}, recentQuestIds: [], chosenLessonIds: [], content: c });
    expect(r[0]).toBe("song");
  });
  it("skips the generic song slot when the best next is a song quest", () => {
    const quests = [...content.quests, q("bard", "song", 15, "la")];
    const c = { ...content, quests, road: [step("la", "bard")] };
    const r = buildDailyQuests({ minutes: 120, hasTargetSong: true, statuses: {}, recentQuestIds: [], chosenLessonIds: [], content: c });
    expect(r[0]).toBe("bard");
    expect(r).not.toContain("song");
  });
  it("keeps the generic song slot when the best next is no song quest", () => {
    expect(build({ minutes: 30 })).toContain("song");
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

describe("buildDailyQuests fillers", () => {
  it("keeps road quests past the best next out of the fillers", () => {
    expect(build({ minutes: 90, hasTargetSong: false })).not.toContain("b");
  });
  it("keeps quests off the road, with or without a lesson", () => {
    expect(build({ minutes: 90, hasTargetSong: false })).toEqual(expect.arrayContaining(["qc", "wechsel", "theorie", "warm"]));
  });
  it("offers road quests the player has reached", () => {
    const ids = build({ minutes: 90, hasTargetSong: false, statuses: { la: "gelernt" } });
    expect(ids[0]).toBe("b");
    expect(ids).toContain("a");
  });
  it("opens every filler once the road is finished", () => {
    const ids = build({ minutes: 90, hasTargetSong: false, statuses: { la: "gelernt", lb: "gelernt" } });
    expect(ids).toEqual(expect.arrayContaining(["a", "b", "qc"]));
  });
  it("still offers a chosen lesson past the best next", () => {
    expect(build({ minutes: 90, hasTargetSong: false, chosenLessonIds: ["lb"] })).toContain("b");
  });
});

describe("buildDailyQuests off-road lessons", () => {
  const offRoad: GameContent = {
    ...content,
    quests: [
      q("a", "technik", 10, "la"),
      q("b", "technik", 10, "lb"),
      q("child", "technik", 10, "lchild"),
      q("fast", "technik", 10, "lquick"),
      q("later", "theorie", 5, "ltheorie"),
    ],
    nodes: [
      node("la"),
      node("lb"),
      node("lchild", { parent: "la" }),
      node("lquick", { parent: "lb", quick: true }),
      node("ltheorie", { parent: "lb" }),
    ],
  };
  const fill = (o: { statuses?: Record<string, LessonStatus>; chosenLessonIds?: string[] }) =>
    buildDailyQuests({ minutes: 90, hasTargetSong: false, recentQuestIds: [], chosenLessonIds: [], statuses: {}, content: offRoad, ...o });

  it("gives a beginner no off-road lesson that is neither quick nor chosen", () => {
    const ids = fill({});
    expect(ids).not.toContain("child");
    expect(ids).not.toContain("later");
  });
  it("offers a quick off-road lesson only when chosen or its parent is done", () => {
    expect(fill({})).not.toContain("fast");
    expect(fill({ chosenLessonIds: ["lquick"] })).toContain("fast");
    expect(fill({ statuses: { lb: "gelernt" } })).toContain("fast");
  });
  it("offers an off-road lesson once its parent is done", () => {
    expect(fill({ statuses: { la: "gelernt" } })).toContain("child");
    expect(fill({ statuses: { la: "gemeistert" } })).toContain("child");
    expect(fill({ statuses: { la: "aktiv" } })).not.toContain("child");
  });
  it("offers off-road theory only once its parent is done", () => {
    expect(fill({})).not.toContain("later");
    expect(fill({ statuses: { la: "gelernt", lb: "gelernt" } })).toContain("later");
  });
  it("always offers a chosen off-road lesson", () => {
    expect(fill({ chosenLessonIds: ["lchild"] })).toContain("child");
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
  it("rejects a quest with an unknown fretboard root", () => {
    const withBoard = (root: string) => ({
      ...content,
      quests: content.quests.map((quest, i) =>
        i === 0 ? { ...quest, fretboard: { root, scale: "moll-pentatonik", box: 1 } } : quest,
      ),
    });
    expect(() => parseGameContent(withBoard("H"))).toThrow(/fretboard/);
    expect(() => parseGameContent(withBoard("A"))).not.toThrow();
  });
  it("accepts a CAGED shape on a fretboard and rejects an unknown one", () => {
    const withCaged = (caged: string) => ({
      ...content,
      road: [],
      nodes: [node("la")],
      quests: [{ ...q("a", "technik", 10, "la"), fretboard: { root: "C", scale: "dur", caged } }],
    });
    expect(parseGameContent(withCaged("E")).quests[0]!.fretboard?.caged).toBe("E");
    expect(() => parseGameContent(withCaged("F"))).toThrow(/caged/);
  });
  it("defaults chooseTarget to false", () => {
    const { chooseTarget: _unused, ...bare } = node("la");
    expect(parseGameContent({ ...content, road: [], quests: [], nodes: [bare] }).nodes[0]!.chooseTarget).toBe(false);
  });
  it("rejects a quest with an unknown tuning", () => {
    const withTuning = (tuning: string) => ({
      ...content,
      quests: content.quests.map((quest, i) => (i === 0 ? { ...quest, tuning } : quest)),
    });
    expect(() => parseGameContent(withTuning("Quinten"))).toThrow(/Stimmung/);
    expect(() => parseGameContent(withTuning("Drop D"))).not.toThrow();
  });
  describe("riffs", () => {
    const six = Array.from({ length: 6 }, () => "-0-0-");
    const riff = (extra: Record<string, unknown> = {}) => ({
      id: "r", title: "R", description: "d", lessonId: "la", bpm: 70, zeilen: six, ...extra,
    });
    const withRiffs = (riffs: unknown[], quests = content.quests) => ({ ...content, quests, riffs });
    it("defaults to no riffs", () => {
      expect(parseGameContent(content).riffs).toEqual([]);
    });
    it("rejects an unknown riff id on a quest", () => {
      const quests = content.quests.map((quest, i) => (i === 0 ? { ...quest, riffId: "zz" } : quest));
      expect(() => parseGameContent(withRiffs([riff()], quests))).toThrow(/riffId/);
      const ok = content.quests.map((quest, i) => (i === 0 ? { ...quest, riffId: "r" } : quest));
      expect(() => parseGameContent(withRiffs([riff()], ok))).not.toThrow();
    });
    it("rejects an unknown lesson, bad tuning and bad tab lines", () => {
      expect(() => parseGameContent(withRiffs([riff({ lessonId: "zz" })]))).toThrow(/riffs\.0\.lessonId/);
      expect(() => parseGameContent(withRiffs([riff({ tuning: "Quinten" })]))).toThrow(/Stimmung/);
      expect(() => parseGameContent(withRiffs([riff({ zeilen: six.slice(1) })]))).toThrow(/riffs\.0\.zeilen/);
      expect(() => parseGameContent(withRiffs([riff({ zeilen: [...six.slice(1), "-0-"] })]))).toThrow(/riffs\.0\.zeilen/);
    });
  });
  it("throws a German message", () => {
    expect(() => parseGameContent({})).toThrow(/Spielinhalt/);
  });
});

describe("buildDailyQuests rotation and fit", () => {
  const day = (n: number) => `2026-11-${String(n).padStart(2, "0")}`;
  const ids = ["la", "lt1", "lt2", "lt3", "lbig"];
  const rotating: GameContent = {
    ...content,
    quests: [
      q("a", "technik", 10, "la"),
      q("theorie-gross", "theorie", 10, "lbig"),
      q("theorie-1", "theorie", 5, "lt1"),
      q("theorie-2", "theorie", 5, "lt2"),
      q("theorie-3", "theorie", 5, "lt3"),
      q("wechsel", "wechsel", 5),
      q("song", "song", 10),
    ],
    road: ids.map((id) => step(id, "a")),
    nodes: ids.map((id) => node(id)),
  };
  const all = Object.fromEntries(ids.map((id) => [id, "gelernt"])) as Record<string, LessonStatus>;
  const run = (days: number, minutes: number, hasTargetSong = true) => {
    const questDays: Record<string, string> = {};
    let recentQuestIds: string[] = [];
    const sets: string[][] = [];
    for (let d = 1; d <= days; d++) {
      const set = buildDailyQuests({
        minutes, hasTargetSong, statuses: all, recentQuestIds, questDays, chosenLessonIds: [], content: rotating,
      });
      set.forEach((id) => (questDays[id] = day(d)));
      recentQuestIds = set;
      sets.push(set);
    }
    return sets;
  };

  it("picks the first theory quest that fits the remaining minutes", () => {
    const set = buildDailyQuests({
      minutes: 30, hasTargetSong: true, statuses: { ...all, la: "aktiv" }, recentQuestIds: [], chosenLessonIds: [], content: rotating,
    });
    expect(set).toEqual(["a", "wechsel", "song"]);
    const theory = set.filter((id) => id.startsWith("theorie"));
    expect(theory.length).toBeLessThanOrEqual(1);
  });
  it("rotates all theory on a finished road instead of a two-cycle", () => {
    const seen = run(9, 45).flatMap((set) => set.filter((id) => id.startsWith("theorie")));
    expect(new Set(seen)).toEqual(new Set(["theorie-gross", "theorie-1", "theorie-2", "theorie-3"]));
  });
  it("lets a theory quest that does not fit step aside for one that does", () => {
    const sets = run(8, 30);
    for (const set of sets) expect(set.reduce((n, id) => n + rotating.quests.find((x) => x.id === id)!.minutes, 0)).toBeLessThanOrEqual(30);
    expect(sets.filter((set) => set.some((id) => id.startsWith("theorie"))).length).toBeGreaterThanOrEqual(2);
  });
  it("picks the quest done longest ago", () => {
    const questDays = { "theorie-1": day(5), "theorie-2": day(2), "theorie-3": day(9), "theorie-gross": day(7) };
    const set = buildDailyQuests({
      minutes: 45, hasTargetSong: false, statuses: all, recentQuestIds: [], questDays, chosenLessonIds: [], content: rotating,
    });
    expect(set.find((id) => id.startsWith("theorie"))).toBe("theorie-2");
  });
});

describe("buildDailyQuests siblings", () => {
  const ids = ["la", "lm", "ln"];
  const multi: GameContent = {
    ...content,
    quests: [
      q("a", "technik", 10, "la"),
      q("m1", "technik", 10, "lm"),
      q("m2", "technik", 10, "lm"),
      q("m3", "technik", 10, "lm"),
      q("n", "technik", 10, "ln"),
      q("alt", "technik", 5, "la"),
    ],
    road: ids.map((id) => step(id, id === "la" ? "a" : id === "lm" ? "m1" : "n")),
    nodes: ids.map((id) => node(id)),
  };
  const fill = (o: { statuses?: Record<string, LessonStatus>; questDays?: Record<string, string>; chosenLessonIds?: string[]; minutes?: number }) =>
    buildDailyQuests({ minutes: 25, hasTargetSong: false, recentQuestIds: [], statuses: {}, chosenLessonIds: [], content: multi, ...o });

  it("adds a sibling of the best next lesson right after the road quest", () => {
    expect(fill({ minutes: 15 })).toEqual(["a", "alt"]);
  });
  it("keeps the road quest first and rotates the sibling", () => {
    const set = fill({ statuses: { la: "gelernt" }, questDays: { m2: "2026-11-02" } });
    expect(set[0]).toBe("m1");
    expect(set).toContain("m3");
    expect(set).not.toContain("m2");
  });
  it("rotates the quest of a chosen lesson", () => {
    const set = fill({ statuses: { la: "gelernt", lm: "gelernt" }, chosenLessonIds: ["lm"], questDays: { m1: "2026-11-03", m2: "2026-11-01" }, minutes: 40 });
    expect(set.slice(0, 2)).toEqual(["n", "m3"]);
    expect(set).toContain("m2");
  });
  it("lets the newest road step fill first", () => {
    const set = fill({ statuses: { la: "gelernt" }, minutes: 80 });
    expect(set[0]).toBe("m1");
    expect(set.indexOf("m3")).toBeLessThan(set.indexOf("a"));
  });
});
