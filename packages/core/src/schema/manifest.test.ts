import { describe, expect, it } from "vitest";
import { parseManifest } from "./manifest.js";

const valid = {
  id: "demo",
  name: "Demo",
  icon: "sparkles",
  accent: "#4f46e5",
  description: "Ein Demo-Skill.",
  modules: [
    { id: "cards", type: "srs-deck", title: "Karten", data: ["decks/demo.json"] },
  ],
};

describe("parseManifest", () => {
  it("accepts a valid manifest", () => {
    const result = parseManifest(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.modules[0]?.type).toBe("srs-deck");
      expect(result.manifest.modules[0]?.pinned).toBe(false);
    }
  });

  it("defaults fullscreen to false and keeps redirect and entry", () => {
    const result = parseManifest({
      ...valid,
      entry: "/vollbild/demo/cards",
      modules: [{ id: "cards", type: "practice", title: "K", redirect: "/x", data: [] }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.entry).toBe("/vollbild/demo/cards");
      expect(result.manifest.modules[0]?.fullscreen).toBe(false);
      expect(result.manifest.modules[0]?.redirect).toBe("/x");
    }
  });

  it("rejects an unknown module type", () => {
    const result = parseManifest({ ...valid, modules: [{ id: "x", type: "quiz", title: "X", data: [] }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("modules");
  });

  it("rejects duplicate module ids", () => {
    const dupe = {
      ...valid,
      modules: [
        { id: "cards", type: "srs-deck", title: "A", data: [] },
        { id: "cards", type: "reference", title: "B", data: [] },
      ],
    };
    const result = parseManifest(dupe);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("eindeutig");
  });

  it("rejects an id that is not a slug", () => {
    expect(parseManifest({ ...valid, id: "Demo Skill" }).ok).toBe(false);
  });
});
