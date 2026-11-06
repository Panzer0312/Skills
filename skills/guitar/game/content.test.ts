import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  bestNext,
  buildDailyQuests,
  buildTips,
  isMastered,
  lessonMasteryTarget,
  parseGameContent,
  scaleQuest,
  type LessonStatus,
  type MapNode,
} from "@skills/core";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => JSON.parse(readFileSync(join(here, name), "utf8"));
const content = parseGameContent({
  ...read("quests.json"),
  road: read("road.json"),
  ...read("map.json"),
  riffs: read("riffs.json"),
});
const lessonExists = (id: string) => existsSync(join(here, "../lessons", `${id}.mdx`));
const lessonIds = Array.from({ length: 13 }, (_, i) => i + 1).map((n) => {
  const prefix = String(n).padStart(2, "0");
  return { prefix, id: content.road.find((s) => s.lessonId.startsWith(prefix))?.lessonId };
});

const WRITTEN_IN_STAGE_2 = [
  "rhythmus-ankerfinger",
  "rhythmus-achtel",
  "rhythmus-drei-akkorde",
  "lead-drei-toene",
  "jam-ein-akkord",
  "metal-erster-riff",
  "metal-sound",
  "metal-stumm",
  "metal-palm-mute",
  "metal-downpicking",
  "finger-daumen",
  "finger-arpeggio",
  "song-bards-vorbereitung",
  "song-bards-ganz",
];
// A listening lesson: no tempo to scale, like its exemption in lessons.test.ts.
const WITHOUT_SCALE = ["metal-sound"];

describe("guitar game content", () => {
  for (const minutes of [60, 90]) {
    it(`gives a beginner no road quest past the best next as filler at ${minutes} minutes`, () => {
      const atRoad = new Map(content.road.map((step, i) => [step.lessonId, i]));
      const fixedSlot = content.quests.find((quest) => quest.kind === "wechsel")?.id;
      let recentQuestIds: string[] = [];
      for (let day = 0; day < 7; day++) {
        const ids = buildDailyQuests({
          minutes,
          content,
          statuses: {},
          hasTargetSong: false,
          recentQuestIds,
          chosenLessonIds: [],
        });
        expect(ids.length, `Tag ${day}`).toBeGreaterThan(0);
        for (const id of ids.filter((questId) => questId !== fixedSlot)) {
          const lessonId = content.quests.find((quest) => quest.id === id)?.lessonId;
          const at = lessonId ? atRoad.get(lessonId) : undefined;
          expect(at === undefined || at === 0, `Tag ${day}: ${id}`).toBe(true);
        }
        recentQuestIds = ids;
      }
    });
  }
  it("gives the pentatonic and jam quests a fretboard", () => {
    const board = (id: string) => content.quests.find((quest) => quest.id === id)?.fretboard;
    expect(board("pentatonik-box1")).toEqual({ root: "A", scale: "moll-pentatonik", box: 1 });
    expect(board("jam-em")).toEqual({ root: "E", scale: "moll-pentatonik", box: 3 });
  });
  it("references existing lesson files", () => {
    for (const quest of content.quests) {
      if (quest.lessonId) expect(lessonExists(quest.lessonId), quest.id).toBe(true);
    }
    for (const step of content.road.filter((s) => s.questId !== null)) {
      expect(lessonExists(step.lessonId), step.lessonId).toBe(true);
    }
  });
  it("has existing quests on the road", () => {
    const ids = new Set(content.quests.map((x) => x.id));
    for (const step of content.road) {
      if (step.questId !== null) expect(ids.has(step.questId), step.questId).toBe(true);
    }
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
  it("gives lesson 07 the change target for both of its quests", () => {
    expect(content.quests.filter((x) => x.lessonId === "07-akkordwechsel").map((x) => x.id)).toEqual([
      "akkordwechsel-takt",
      "wechsel-minute",
    ]);
    expect(lessonMasteryTarget(content.quests, "07-akkordwechsel")).toBe(40);
    expect(lessonMasteryTarget(content.quests, "01-haltung")).toBeUndefined();
  });
});

describe("skill map content", () => {
  const byId = new Map(content.nodes.map((node) => [node.id, node]));
  const withParent = content.nodes.flatMap((node) => {
    const parent = node.parent ? byId.get(node.parent) : undefined;
    return parent ? [{ node, parent }] : [];
  });
  const pairs = <T,>(items: T[]) => items.flatMap((a, i) => items.slice(i + 1).map((b) => [a, b] as const));
  const label = (node: MapNode) => {
    const width = node.title.length * 6.4;
    return { left: node.x - width / 2, right: node.x + width / 2, top: node.y + 16, bottom: node.y + 32 };
  };

  it("plans about eighty lessons", () => {
    const lessons = content.nodes.filter((n) => !n.knownSong);
    expect(lessons.length).toBeGreaterThanOrEqual(78);
    expect(lessons.length).toBeLessThanOrEqual(84);
  });
  it("marks a node available exactly when its lesson file exists", () => {
    for (const node of content.nodes) expect(node.available, node.id).toBe(lessonExists(node.id));
  });
  it("rises in rank along every parent chain", () => {
    for (const { node, parent } of withParent) {
      if (node.quick || node.knownSong) continue;
      expect(node.rank, node.id).toBeGreaterThanOrEqual(parent.rank);
    }
  });
  it("keeps every parent on the same path, or the Harbor", () => {
    for (const { node, parent } of withParent) expect([node.path, "hafen"], node.id).toContain(parent.path);
  });
  it("hangs quick nodes on a parent and keeps them at rank 3 or below", () => {
    const quick = content.nodes.filter((n) => n.quick);
    expect(quick.length).toBeGreaterThan(0);
    for (const node of quick) {
      expect(node.parent, node.id).not.toBeNull();
      expect(node.rank, node.id).toBeLessThanOrEqual(3);
    }
  });
  it("keeps nodes at least 56 units apart", () => {
    for (const [a, b] of pairs(content.nodes)) {
      expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} ${b.id}`).toBeGreaterThanOrEqual(56);
    }
  });
  it("keeps estimated labels from overlapping", () => {
    for (const [a, b] of pairs(content.nodes)) {
      const [la, lb] = [label(a), label(b)];
      const overlap = la.left < lb.right && lb.left < la.right && la.top < lb.bottom && lb.top < la.bottom;
      expect(overlap, `${a.id} ${b.id}`).toBe(false);
    }
  });
  it("keeps all nodes inside 1600 by 1100", () => {
    for (const node of content.nodes) {
      const box = label(node);
      expect(box.left, node.id).toBeGreaterThanOrEqual(0);
      expect(box.right, node.id).toBeLessThanOrEqual(1600);
      expect(node.y, node.id).toBeGreaterThanOrEqual(0);
      expect(box.bottom, node.id).toBeLessThanOrEqual(1100);
    }
  });
  it("has at least twenty cross-links, each with a reason", () => {
    const links = content.nodes.flatMap((node) => node.links.map((link) => ({ from: node.id, ...link })));
    expect(links.length).toBeGreaterThanOrEqual(20);
    for (const link of links) expect(link.reason.trim(), link.from).not.toBe("");
    const has = (from: string, to: string) => links.some((link) => link.from === from && link.to === to);
    expect(has("metal-palm-mute", "rhythmus-funk")).toBe(true);
    expect(has("10-barre", "caged-e")).toBe(true);
    expect(has("finger-arpeggio", "lead-sweep")).toBe(true);
    expect(has("07-akkordwechsel", "song-bards-vorbereitung")).toBe(true);
    expect(has("caged-g", "caged-e")).toBe(true);
  });
  it("covers every available lesson on the road or as a quick win", () => {
    const onRoad = new Set(content.road.map((step) => step.lessonId));
    for (const node of content.nodes.filter((n) => n.available)) {
      expect(onRoad.has(node.id) || node.quick, node.id).toBe(true);
    }
  });
  it("opens every lesson written in stage 2, with a quest, on the road or as a quick win", () => {
    const onRoad = new Map(content.road.map((step) => [step.lessonId, step]));
    for (const id of WRITTEN_IN_STAGE_2) {
      const node = content.nodes.find((n) => n.id === id);
      const quest = content.quests.find((q) => q.lessonId === id);
      expect(node?.available, id).toBe(true);
      expect(quest?.techniqueId, id).toBe(node?.techniqueId);
      if (!WITHOUT_SCALE.includes(id)) expect(Object.keys(quest?.scale ?? {}), id).not.toHaveLength(0);
      expect(node?.quick || onRoad.get(id)?.questId === quest?.id, id).toBe(true);
    }
  });
  it("names The Bard's Song as target on both of its lessons", () => {
    for (const id of ["song-bards-vorbereitung", "song-bards-ganz"]) {
      expect(byId.get(id)?.targetSong, id).toEqual({ title: "The Bard's Song", artist: "Blind Guardian" });
    }
  });
  it("keeps pasted sheets out of the song lessons", () => {
    for (const id of ["song-bards-vorbereitung", "song-bards-ganz"]) {
      const source = readFileSync(join(here, "../lessons", `${id}.mdx`), "utf8");
      expect(source, id).not.toContain("{start_of_verse}");
      expect(source, id).not.toMatch(/\[[A-H][#b]?(m|maj|sus|add|dim|aug)?\d*(\/[A-H][#b]?)?\]/);
    }
  });
  it("orders road months without going backwards", () => {
    content.road.forEach((step, i) => {
      const before = content.road[i - 1];
      expect(step.months[0], step.lessonId).toBeLessThanOrEqual(step.months[1]);
      if (!before) return;
      expect(step.months[0], step.lessonId).toBeGreaterThanOrEqual(before.months[0]);
      expect(step.months[1], step.lessonId).toBeGreaterThanOrEqual(before.months[1]);
    });
  });
  it("reaches every road step after its parent", () => {
    const at = new Map(content.road.map((step, i) => [step.lessonId, i]));
    content.road.forEach((step, i) => {
      const node = byId.get(step.lessonId);
      expect(node?.quick, step.lessonId).toBe(false);
      expect(node?.knownSong, step.lessonId).toBe(false);
      if (node?.parent) expect(at.get(node.parent) ?? Infinity, step.lessonId).toBeLessThan(i);
    });
  });
  it("gives every written road step a quest and every planned step none", () => {
    for (const step of content.road) {
      const quest = content.quests.find((q) => q.id === step.questId);
      expect(step.reason.trim(), step.lessonId).not.toBe("");
      if (byId.get(step.lessonId)?.available) expect(quest?.lessonId, step.lessonId).toBe(step.lessonId);
      else expect(step.questId, step.lessonId).toBeNull();
    }
  });
  it("starts a placed stage-1 player at the first unfinished written step", () => {
    const placed = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, "gelernt" as LessonStatus]));
    const written = content.road.filter((step) => step.questId !== null);
    const stage1 = lessonIds.map(({ id }) => id as string);

    const gap = stage1.slice(0, 7).filter((id) => id !== "06-offene-akkorde");
    expect(bestNext(content.road, placed(gap))?.lessonId).toBe("06-offene-akkorde");

    const best = bestNext(content.road, placed(stage1.slice(0, 9)));
    expect(best?.questId).not.toBeNull();
    expect(best).toBe(written.find((step) => !stage1.slice(0, 9).includes(step.lessonId)));

    const finished = placed(written.map((step) => step.lessonId));
    expect(bestNext(content.road, finished)).toBeNull();
    expect(buildTips(content, finished, []).moreComing).toBe(true);
  });
});

describe("The Bard's Song mastery", () => {
  const quest = content.quests.find((q) => q.id === "bards-ganz")!;
  const target = lessonMasteryTarget(content.quests, "song-bards-ganz");
  const lesson = readFileSync(join(here, "../lessons/song-bards-ganz.mdx"), "utf8");
  const days = ["2026-11-01", "2026-11-02", "2026-11-03"];

  it("is not mastered by three passing quests without a metric", () => {
    const entries = days.map((day) => ({ rating: "passt" as const, day, metricValue: null }));
    expect(isMastered(entries, target)).toBe(false);
  });
  it("is not mastered by two full runs on each of three days", () => {
    const entries = days.map((day) => ({ rating: "passt" as const, day, metricValue: 2 }));
    expect(isMastered(entries, target)).toBe(false);
  });
  it("is mastered by three full runs", () => {
    expect(isMastered([{ rating: "passt", day: days[0]!, metricValue: 3 }], target)).toBe(true);
  });
  it("asks for full runs", () => {
    expect(quest.metricLabel).toBe("Ganze Durchläufe");
    expect(quest.masteryTarget).toBe(3);
  });
  it("reaches the full song at level 6 and not before", () => {
    const sections = Array.from({ length: 10 }, (_, i) => scaleQuest(quest, i + 1).section);
    expect(sections.slice(0, 3)).toEqual(["Teil A", "Teil A", "Teil A"]);
    expect(sections.slice(3, 5)).toEqual(["Teil B", "Teil B"]);
    expect(new Set(sections.slice(5))).toEqual(new Set(["Ganzer Song"]));
  });
  it("tops out at 80 percent with a metronome that matches at every level", () => {
    expect(scaleQuest(quest, 1)).toMatchObject({ tempoPercent: 50, bpm: 50 });
    expect(scaleQuest(quest, 10)).toMatchObject({ tempoPercent: 80, bpm: 80 });
    for (let level = 1; level <= 10; level += 1) {
      const { tempoPercent, bpm } = scaleQuest(quest, level);
      expect(bpm, `Stufe ${level}`).toBe(tempoPercent);
    }
  });
  it("tells the same story in the lesson", () => {
    const flat = lesson.replace(/\s+/g, " ");
    expect(flat).toContain("drei ganzen Durchläufen");
    expect(flat).toContain("ab 6 der ganze Song");
    expect(flat).toContain("80 %");
    expect(flat).toContain("100 % = 100 BPM");
    expect(quest.description).toContain("100 % = 100 BPM");
  });
});

describe("daily quests on the real content", () => {
  const statuses: Record<string, LessonStatus> = Object.fromEntries(
    content.road.slice(0, 6).map((step) => [step.lessonId, "gelernt"]),
  );
  const build = (minutes: number, recentQuestIds: string[] = []) =>
    buildDailyQuests({ minutes, content, statuses, hasTargetSong: false, recentQuestIds, chosenLessonIds: [] });

  it("recommends the change drill once lessons 01 to 06 are learned", () => {
    expect(bestNext(content.road, statuses)?.questId).toBe("wechsel-minute");
  });
  it("leads a 10 minute session with the change drill and stays inside it", () => {
    expect(build(10)).toEqual(["wechsel-minute", "griffbrett-namen"]);
  });
  it("rotates the theory slot through the reached theory quests", () => {
    expect(build(10, ["griffbrett-namen"])).toEqual(["wechsel-minute", "noten-e-saite"]);
    expect(build(10, ["griffbrett-namen", "noten-e-saite"])).toEqual(["wechsel-minute", "akkordtoene"]);
  });
  it("does not reach lesson 13 theory at lesson 07", () => {
    expect(build(45)).not.toContain("stufenakkorde");
    expect(build(10, ["griffbrett-namen"])).not.toContain("stufenakkorde");
  });
});

describe("song recommendations", () => {
  it("recommends at least twelve songs with a source URL", () => {
    const songs = content.nodes.flatMap((n) => n.songs);
    expect(songs.length).toBeGreaterThanOrEqual(12);
    for (const song of songs) expect(song.source).toMatch(/^https:\/\//);
  });
  it("leans towards metal", () => {
    const metal = content.nodes.filter((n) => n.path === "metal").flatMap((n) => n.songs);
    expect(metal.length).toBeGreaterThanOrEqual(4);
  });
  it("takes every riff from its lesson", () => {
    expect(content.riffs.length).toBeGreaterThan(0);
    for (const riff of content.riffs) {
      const mdx = readFileSync(join(here, "../lessons", `${riff.lessonId}.mdx`), "utf8");
      for (const line of riff.zeilen) expect(mdx, `${riff.id}: ${line}`).toContain(`"${line}"`);
    }
  });
});
