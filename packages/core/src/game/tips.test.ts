import { describe, expect, it } from "vitest";
import type { MapNode } from "./map.js";
import type { GameContent, LessonStatus } from "./quests.js";
import { buildTips } from "./tips.js";

const node = (id: string, extra: Partial<MapNode> = {}): MapNode => ({
  id, title: id, description: id, path: "hafen", rank: 1, x: 0, y: 0, parent: null, quick: false,
  available: true, knownSong: false, techniqueId: null, links: [], songs: [], targetSong: null, ...extra,
});
const content: GameContent = {
  techniques: [],
  quests: [],
  riffs: [],
  paths: [],
  nodes: [node("q0", { available: false, quick: true }), node("q1", { quick: true }), node("q2", { quick: true }), node("r1"), node("r2")],
  road: [
    { lessonId: "r1", questId: "x", months: [1, 1], reason: "r" },
    { lessonId: "r2", questId: null, months: [1, 1], reason: "r" },
  ],
};
const tips = (o: { statuses?: Record<string, LessonStatus>; chosen?: string[] } = {}) =>
  buildTips(content, o.statuses ?? {}, o.chosen ?? []);

describe("buildTips", () => {
  it("offers an open quick win first", () => expect(tips().quick).toMatchObject({ node: { id: "q1" }, refine: false }));
  it("moves on to the next open quick win", () => {
    expect(tips({ statuses: { q1: "gelernt" } }).quick).toMatchObject({ node: { id: "q2" }, refine: false });
  });
  it("asks to refine a learned quick win", () => {
    expect(tips({ statuses: { q1: "gelernt", q2: "gelernt" } }).quick).toMatchObject({ node: { id: "q1" }, refine: true });
  });
  it("keeps a started quick win as a quick win, not as refining", () => {
    expect(tips({ statuses: { q1: "aktiv", q2: "gemeistert" } }).quick).toMatchObject({ node: { id: "q1" }, refine: false });
    expect(tips({ statuses: { q1: "aktiv", q2: "gelernt" } }).quick).toMatchObject({ node: { id: "q1" }, refine: false });
  });
  it("drops a mastered quick win", () => {
    expect(tips({ statuses: { q1: "gemeistert", q2: "gemeistert" } }).quick).toBeNull();
  });
  it("skips unavailable quick wins", () => {
    expect(tips({ statuses: { q1: "gemeistert", q2: "gemeistert" } }).quick?.node.id).not.toBe("q0");
  });
  it("follows the road for best next", () => expect(tips().best?.lessonId).toBe("r1"));
  it("says more lessons are coming when only planned steps remain", () => {
    expect(tips({ statuses: { r1: "gelernt" } })).toMatchObject({ best: null, moreComing: true });
    expect(tips().moreComing).toBe(false);
  });
  it("changes the stay-on-track text with chosen lessons", () => {
    expect(tips({ chosen: ["a", "b"] }).stayOnTrack).toBe("Zwei Nebenwege reichen. Bring erst einen davon zu Ende.");
    expect(tips({ chosen: ["a"] }).stayOnTrack).toBe("Neben dem Hauptweg läuft ein Nebenweg. Das ist ein gutes Maß.");
    expect(tips().stayOnTrack).toBe("Bleib beim Hauptweg und nimm dir bei Lust einen Nebenweg dazu.");
  });
  it("does not count the best next lesson as a side road", () => {
    expect(tips({ chosen: ["r1"] }).stayOnTrack).toBe("Bleib beim Hauptweg und nimm dir bei Lust einen Nebenweg dazu.");
    expect(tips({ chosen: ["r1", "a"] }).stayOnTrack).toBe("Neben dem Hauptweg läuft ein Nebenweg. Das ist ein gutes Maß.");
    expect(tips({ chosen: ["r1", "a", "b"] }).stayOnTrack).toBe("Zwei Nebenwege reichen. Bring erst einen davon zu Ende.");
  });
});
