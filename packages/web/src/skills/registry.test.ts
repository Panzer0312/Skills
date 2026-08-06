import { describe, expect, it } from "vitest";
import { loadSkills } from "./registry.js";

const validManifest = {
  id: "demo",
  name: "Demo",
  icon: "sparkles",
  accent: "#4f46e5",
  description: "Test",
  modules: [{ id: "cards", type: "srs-deck", title: "Karten", data: ["decks/demo.json"] }],
};

const deck = { deck: "Demo", cards: [{ key: "a", front: "A", back: "Ah" }] };

describe("loadSkills", () => {
  it("loads a valid skill and attaches its data files", () => {
    const { skills, broken } = loadSkills(
      { "/skills/demo/skill.json": { default: validManifest } },
      { "/skills/demo/decks/demo.json": { default: deck } },
    );
    expect(broken).toHaveLength(0);
    expect(skills).toHaveLength(1);
    expect(skills[0]?.dir).toBe("demo");
    expect(skills[0]?.data["decks/demo.json"]).toEqual(deck);
  });

  it("collects an invalid manifest as broken without dropping valid skills", () => {
    const { skills, broken } = loadSkills(
      {
        "/skills/demo/skill.json": { default: validManifest },
        "/skills/kaputt/skill.json": { default: { id: "kaputt" } },
      },
      { "/skills/demo/decks/demo.json": { default: deck } },
    );
    expect(skills.map((s) => s.manifest.id)).toEqual(["demo"]);
    expect(broken).toHaveLength(1);
    expect(broken[0]?.dir).toBe("kaputt");
    expect(broken[0]?.error.length).toBeGreaterThan(0);
  });

  it("marks a skill broken when a declared data file is missing", () => {
    const { skills, broken } = loadSkills({ "/skills/demo/skill.json": { default: validManifest } }, {});
    expect(skills).toHaveLength(0);
    expect(broken[0]?.error).toContain("decks/demo.json");
  });

  it("resolves glob patterns in module data paths", () => {
    const manifest = {
      ...validManifest,
      modules: [{ id: "cards", type: "srs-deck", title: "Karten", data: ["decks/*.json"] }],
    };
    const { skills } = loadSkills(
      { "/skills/demo/skill.json": { default: manifest } },
      {
        "/skills/demo/decks/a.json": { default: deck },
        "/skills/demo/decks/b.json": { default: deck },
      },
    );
    expect(Object.keys(skills[0]!.data).sort()).toEqual(["decks/a.json", "decks/b.json"]);
  });
});
