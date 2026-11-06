import { describe, expect, it } from "vitest";
import { relations, roadPoints, type MapNode } from "./map.js";

const node = (id: string, extra: Partial<MapNode> = {}): MapNode => ({
  id, title: id, description: id, path: "hafen", rank: 1, x: 0, y: 0, parent: null, quick: false,
  available: true, knownSong: false, techniqueId: null, links: [], songs: [], targetSong: null, chooseTarget: false, ...extra,
});
const nodes = [
  node("a"),
  node("b", { parent: "a" }),
  node("c", { parent: "b", x: 5, y: 6 }),
  node("x", { links: [{ to: "b", reason: "weil" }] }),
];

describe("relations", () => {
  it("finds parent, children and links in both directions", () => {
    const r = relations(nodes, "b");
    expect(r.buildsOn.map((n) => n.id)).toEqual(["a"]);
    expect(r.unlocks.map((n) => n.id)).toEqual(["c"]);
    expect(r.linked).toEqual([{ node: expect.objectContaining({ id: "x" }), reason: "weil" }]);
  });
  it("finds a link from the linking side too", () => {
    expect(relations(nodes, "x").linked.map((l) => l.node.id)).toEqual(["b"]);
  });
  it("is empty for an unknown id", () => {
    expect(relations(nodes, "zz")).toEqual({ buildsOn: [], unlocks: [], linked: [] });
  });
});

describe("roadPoints", () => {
  it("maps road steps to node positions and skips unknown lessons", () => {
    const road = ["c", "zz", "a"].map((lessonId) => ({ lessonId, questId: null, months: [1, 1] as [number, number], reason: "r" }));
    expect(roadPoints(road, nodes)).toEqual([{ x: 5, y: 6 }, { x: 0, y: 0 }]);
  });
});
