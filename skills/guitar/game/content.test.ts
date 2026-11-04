import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseGameContent } from "@skills/core";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => JSON.parse(readFileSync(join(here, name), "utf8"));
const content = parseGameContent({ ...read("quests.json"), road: read("road.json") });
const lessonIds = Array.from({ length: 13 }, (_, i) => i + 1).map((n) => {
  const prefix = String(n).padStart(2, "0");
  return { prefix, id: content.road.find((s) => s.lessonId.startsWith(prefix))?.lessonId };
});

describe("guitar game content", () => {
  it("references existing lesson files", () => {
    for (const quest of content.quests) {
      if (quest.lessonId) expect(existsSync(join(here, "../lessons", `${quest.lessonId}.mdx`)), quest.id).toBe(true);
    }
    for (const step of content.road) {
      expect(existsSync(join(here, "../lessons", `${step.lessonId}.mdx`)), step.lessonId).toBe(true);
    }
  });
  it("has existing quests on the road", () => {
    const ids = new Set(content.quests.map((x) => x.id));
    for (const step of content.road) expect(ids.has(step.questId), step.questId).toBe(true);
  });
  it("has unique ids", () => {
    const quests = content.quests.map((x) => x.id);
    expect(new Set(quests).size).toBe(quests.length);
    const techniques = content.techniques.map((x) => x.id);
    expect(new Set(techniques).size).toBe(techniques.length);
  });
  it("has every lesson 01 to 13 on the road, each with a quest", () => {
    for (const { prefix, id } of lessonIds) {
      expect(id, prefix).toBeDefined();
      expect(content.quests.some((x) => x.lessonId === id), prefix).toBe(true);
    }
  });
  it("defines every technique", () => {
    const ids = new Set(content.techniques.map((x) => x.id));
    for (const quest of content.quests) expect(ids.has(quest.techniqueId), quest.id).toBe(true);
  });
  it("has the song and change quests", () => {
    expect(content.quests.find((x) => x.id === "song-ziel")).toMatchObject({ kind: "song", minutes: 10, lessonId: null });
    expect(content.quests.find((x) => x.id === "wechsel-minute")).toMatchObject({ kind: "wechsel", minutes: 5, masteryTarget: 40 });
  });
});
