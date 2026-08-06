import { describe, expect, it } from "vitest";
import { buildSeedPayload } from "./useSeedSync.js";
import type { LoadedSkill } from "./registry.js";

const skill: LoadedSkill = {
  dir: "demo",
  manifest: {
    id: "demo",
    name: "Demo",
    icon: "sparkles",
    accent: "#4f46e5",
    description: "",
    modules: [
      { id: "cards", type: "srs-deck", title: "Karten", pinned: false, data: ["decks/a.json"] },
      { id: "kurs", type: "course", title: "Kurs", pinned: false, data: [] },
    ],
  },
  data: {
    "decks/a.json": {
      deck: "A",
      cards: [{ key: "eins", front: "1", back: "eins", tags: ["zahl"] }],
    },
  },
};

describe("buildSeedPayload", () => {
  it("collects cards from srs-deck modules only", () => {
    const payload = buildSeedPayload(skill);
    expect(payload.skillId).toBe("demo");
    expect(payload.modules.map((m) => m.id)).toEqual(["cards", "kurs"]);
    expect(payload.cards).toEqual([
      { moduleId: "cards", cardKey: "eins", front: "1", back: "eins", tags: ["zahl"] },
    ]);
  });

  it("throws with the offending file name when a deck is malformed", () => {
    const broken: LoadedSkill = {
      ...skill,
      data: { "decks/a.json": { deck: "A", cards: [{ front: "1", back: "eins" }] } },
    };
    expect(() => buildSeedPayload(broken)).toThrowError(/decks\/a\.json/);
  });
});
