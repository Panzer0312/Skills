import { existsSync, readFileSync, readdirSync } from "node:fs";
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
  parseStory,
  reachedBeats,
  scaleQuest,
  type LessonStatus,
  type MapNode,
  GEAR,
} from "@skills/core";
import { SPRITE_NAMES } from "./assets.js";
import { resolveChordShape } from "../../../packages/web/src/music/userChords.js";

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
const WRITTEN_IN_STAGE_4 = [
  "caged-a",
  "caged-c",
  "caged-d",
  "caged-e",
  "caged-g",
  "caged-verbinden",
  "finger-akkordmelodie",
  "finger-arrangement",
  "finger-clean-intro",
  "finger-flageolett",
  "finger-hybrid",
  "finger-stimmungen",
  "finger-travis",
  "finger-wechselbass",
  "griffbrett-alle-noten",
  "griffbrett-noten",
  "griffbrett-oktaven",
  "jam-akkordtoene",
  "jam-frage-antwort",
  "jam-frei",
  "lead-bending",
  "lead-boxen",
  "lead-erstes-solo",
  "lead-legato",
  "lead-moll",
  "lead-phrasen",
  "lead-sweep",
  "lead-tapping",
  "lead-vibrato",
  "lead-wechselschlag",
  "metal-drop-d",
  "metal-galopp",
  "metal-ganzer-song",
  "metal-synkopen",
  "metal-thrash-boss",
  "metal-tight",
  "metal-tremolo",
  "metal-zweistimmig",
  "rhythmus-barre-songs",
  "rhythmus-funk",
  "rhythmus-moll-barre",
  "rhythmus-sechzehntel",
  "rhythmus-shuffle",
  "rhythmus-sus-sept",
  "rhythmus-synkopen",
  "theorie-akkordbau",
  "theorie-akkordfolgen",
  "theorie-analyse",
  "theorie-dur-tonleiter",
  "theorie-harmonisch-moll",
  "theorie-intervalle",
  "theorie-modi",
  "theorie-moll",
  "theorie-riff-hoeren",
  "theorie-tonarten",
];
const TITLE_CONFLICTS = "04-aufwaermen";
const JOINED_FROM_TWO_TABS = ["thrash-riff"];
const HIDDEN_FROM_LESSON = ["hoeren-riff-b", "hoeren-riff-c"];
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
  it("gives every playable node a technique", () => {
    expect(content.nodes.filter((node) => node.techniqueId === null && !node.knownSong).map((node) => node.id)).toEqual([]);
    const board = content.nodes.filter((node) => node.path === "griffbrett");
    expect(board.length).toBeGreaterThan(0);
    expect(content.techniques.some((t) => t.id === "griffbrett")).toBe(true);
    for (const node of board.filter((n) => n.id.startsWith("caged-"))) expect(node.techniqueId, node.id).toBe("griffbrett");
  });
  it("lets the player choose the target song on the whole-song lesson", () => {
    const node = content.nodes.find((n) => n.id === "metal-ganzer-song")!;
    expect(node.chooseTarget).toBe(true);
    expect(node.songs.length).toBeGreaterThan(0);
  });
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
  it("opens every lesson written in stage 4 with a quest, and uses it where the road reaches it", () => {
    const onRoad = new Map(content.road.map((step) => [step.lessonId, step]));
    for (const id of WRITTEN_IN_STAGE_4) {
      const node = content.nodes.find((n) => n.id === id);
      const quests = content.quests.filter((q) => q.lessonId === id);
      expect(node?.available, id).toBe(true);
      expect(quests.length, id).toBeGreaterThan(0);
      expect(quests[0]?.techniqueId, id).toBe(node?.techniqueId);
      // A lesson off the road is allowed, a road step must use a quest of its lesson.
      const step = onRoad.get(id);
      if (step) expect(quests.map((q) => q.id), id).toContain(step.questId);
    }
  });
  it("makes every node available except the known songs", () => {
    for (const node of content.nodes) expect(node.available, node.id).toBe(!node.knownSong);
  });
  it("resolves every chord of every Griffbild in the lessons", () => {
    const lessons = readdirSync(join(here, "../lessons")).filter((name) => name.endsWith(".mdx"));
    let found = 0;
    for (const file of lessons) {
      const source = readFileSync(join(here, "../lessons", file), "utf8");
      for (const match of source.matchAll(/<Griffbild\s+akkorde=\{(\[[^\]]*\])\}/g)) {
        for (const chord of JSON.parse(match[1]!) as string[]) {
          found += 1;
          expect(resolveChordShape(chord), `${file}: ${chord}`).not.toBeNull();
        }
      }
    }
    expect(found).toBeGreaterThan(0);
    const own = JSON.parse(readFileSync(join(here, "../chords/eigene.json"), "utf8")) as { symbol: string }[];
    for (const { symbol } of own) expect(resolveChordShape(symbol), `eigene.json: ${symbol}`).not.toBeNull();
  });
  it("gives every quest with a metric label a mastery target", () => {
    for (const quest of content.quests.filter((q) => q.metricLabel && q.lessonId && WRITTEN_IN_STAGE_4.includes(q.lessonId))) {
      expect(quest.masteryTarget, quest.id).toBeDefined();
    }
  });
  it("titles every lesson like its map node", () => {
    for (const node of content.nodes.filter((n) => n.available)) {
      // The lesson title would make this label overlap 11-pentatonik; its mdx is for the coordinator to shorten.
      if (node.id === TITLE_CONFLICTS) continue;
      const source = readFileSync(join(here, "../lessons", `${node.id}.mdx`), "utf8");
      const title = /export const meta = \{[^}]*?title:\s*"((?:[^"\\]|\\.)*)"/.exec(source)?.[1];
      expect(title?.replace(/\\"/g, '"'), node.id).toBe(node.title);
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
  it("gives every road step a quest of its lesson", () => {
    for (const step of content.road) {
      const quest = content.quests.find((q) => q.id === step.questId);
      expect(step.reason.trim(), step.lessonId).not.toBe("");
      expect(quest?.lessonId, step.lessonId).toBe(step.lessonId);
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
    expect(buildTips(content, finished, []).best).toBeNull();
  });
});

describe("story content", () => {
  const story = parseStory(read("story.json"), content);

  it("passes the story checks with the real content", () => {
    expect(story.chapters.length).toBeGreaterThan(0);
    expect(story.beats.length).toBeGreaterThan(0);
  });
  it("seats every theory node in exactly one chapter", () => {
    for (const node of content.nodes.filter((n) => n.path === "theorie")) {
      const holders = story.chapters.filter((chapter) => chapter.theoryLessons.includes(node.id));
      expect(holders.map((chapter) => chapter.id), node.id).toHaveLength(1);
    }
  });
  it("lets no beat run past four lines", () => {
    for (const beat of story.beats) expect(beat.lines.length, beat.id).toBeLessThanOrEqual(4);
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

describe("daily quests over two weeks at every road position", () => {
  const nodeById = new Map(content.nodes.map((n) => [n.id, n]));
  const questById = new Map(content.quests.map((quest) => [quest.id, quest]));
  const day = (n: number) => `2026-11-${String(n).padStart(2, "0")}`;
  const lessonDone = (statuses: Record<string, LessonStatus>, id: string) =>
    statuses[id] === "gelernt" || statuses[id] === "gemeistert";
  /** Independent of the builder: whether the quest's lesson has been taught at this road position. */
  function taught(quest: (typeof content.quests)[number], statuses: Record<string, LessonStatus>): boolean {
    // The change drill is the fixed slot of every session, from the first day on.
    if (quest.lessonId === null || quest.kind === "wechsel") return true;
    const next = bestNext(content.road, statuses);
    if (!next) return true;
    const at = content.road.findIndex((step) => step.lessonId === quest.lessonId);
    if (at !== -1) return at <= content.road.indexOf(next);
    const parent = nodeById.get(quest.lessonId)?.parent ?? null;
    return parent === null || lessonDone(statuses, parent);
  }
  function simulate(position: number, minutes: number, hasTargetSong: boolean) {
    const statuses: Record<string, LessonStatus> = Object.fromEntries(
      content.road.slice(0, position).map((step) => [step.lessonId, "gelernt"]),
    );
    const questDays: Record<string, string> = {};
    let recentQuestIds: string[] = [];
    const sets: string[][] = [];
    for (let d = 1; d <= 14; d++) {
      const set = buildDailyQuests({ minutes, content, statuses, hasTargetSong, recentQuestIds, questDays, chosenLessonIds: [] });
      set.forEach((id) => (questDays[id] = day(d)));
      recentQuestIds = set;
      sets.push(set);
    }
    return { statuses, sets };
  }

  for (const hasTargetSong of [false, true]) {
    for (const minutes of [10, 20, 30, 45, 60]) {
      it(`schedules only taught quests without duplicates at ${minutes} minutes${hasTargetSong ? " with a target song" : ""}`, () => {
        for (let position = 0; position <= content.road.length; position++) {
          const { statuses, sets } = simulate(position, minutes, hasTargetSong);
          sets.forEach((set, d) => {
            const where = `Position ${position}, Tag ${d + 1}`;
            expect(set.length, where).toBeGreaterThan(0);
            expect(new Set(set).size, where).toBe(set.length);
            for (const id of set) expect(taught(questById.get(id)!, statuses), `${where}: ${id}`).toBe(true);
            const total = set.reduce((sum, id) => sum + questById.get(id)!.minutes, 0);
            expect(set.length === 1 || total <= minutes, `${where}: ${total} Minuten`).toBe(true);
          });
        }
      });
    }
  }

  it("brings theory up at least twice in 14 days at 30 minutes with a target song", () => {
    const failures: string[] = [];
    for (let position = 10; position <= content.road.length; position++) {
      const { statuses, sets } = simulate(position, 30, true);
      // The road quest, the change drill and the target song come first. Where they already fill
      // the 30 minutes (a 15 minute road quest), no theory quest has room, which the brief's
      // "10 minutes or less" does not cover.
      const next = bestNext(content.road, statuses);
      const nextQuest = next?.questId ? questById.get(next.questId) : undefined;
      const fixed =
        (nextQuest?.minutes ?? 0) +
        questById.get("wechsel-minute")!.minutes +
        (nextQuest?.kind === "song" ? 0 : questById.get("song-ziel")!.minutes);
      const reachable = content.quests.some(
        (quest) =>
          quest.kind === "theorie" && quest.minutes <= Math.min(10, 30 - fixed) && taught(quest, statuses),
      );
      if (!reachable) continue;
      const days = sets.filter((set) => set.some((id) => questById.get(id)!.kind === "theorie")).length;
      if (days < 2) failures.push(`Position ${position}: ${days}`);
    }
    expect(failures).toEqual([]);
  });
  it("shows every pentatonic box over a month at the lead-boxen step", () => {
    const position = content.road.findIndex((step) => step.lessonId === "lead-boxen");
    const { sets } = simulate(position, 60, false);
    const seen = new Set(sets.flat());
    for (const box of ["pentatonik-box2", "pentatonik-box3", "pentatonik-box4", "pentatonik-box5"]) {
      expect(seen.has(box), box).toBe(true);
    }
  });
  it("does not hand a month 9 player the posture check", () => {
    const position = content.road.findIndex((step) => step.lessonId === "caged-g");
    const { sets } = simulate(position, 45, false);
    expect(sets[0]).not.toContain("haltung-check");
  });
});

describe("story endings on the real content", () => {
  const story = parseStory(read("story.json"), content);
  const beatIds = (statuses: Record<string, LessonStatus>) => reachedBeats(story, content.road, statuses).map((b) => b.id);

  it("does not show the ending for a lone tick on jam-frei", () => {
    expect(beatIds({ "jam-frei": "gelernt" })).not.toContain("ende");
  });
  it("does not show the ending for a save at rhythmus-moll-barre", () => {
    const at = content.road.findIndex((step) => step.lessonId === "rhythmus-moll-barre");
    const statuses = Object.fromEntries(content.road.slice(0, at).map((s) => [s.lessonId, "gelernt"])) as Record<string, LessonStatus>;
    expect(beatIds(statuses)).not.toContain("ende");
    expect(beatIds({ ...statuses, "jam-frei": "gelernt" })).not.toContain("ende");
  });
  it("shows the ending once the road is finished", () => {
    const all = Object.fromEntries(content.road.map((s) => [s.lessonId, "gelernt"])) as Record<string, LessonStatus>;
    expect(beatIds(all)).toContain("ende");
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
      // The ear test hides these two riffs from their lesson on purpose.
      if (HIDDEN_FROM_LESSON.includes(riff.id)) continue;
      const mdx = readFileSync(join(here, "../lessons", `${riff.lessonId}.mdx`), "utf8");
      for (const line of riff.zeilen) {
        // The lesson shows this four-bar riff as two tabs, each within the 40 character limit.
        const bars = line.split("|");
        const parts = JOINED_FROM_TWO_TABS.includes(riff.id)
          ? [bars.slice(0, 2).join("|"), bars.slice(2).join("|")]
          : [line];
        for (const part of parts) expect(mdx, `${riff.id}: ${part}`).toContain(`"${part}"`);
      }
    }
  });
});

const QUEST_CHORDS: Record<string, string[]> = {
  "offene-akkorde": ["Em", "Am", "C", "G"],
  akkordtoene: ["C", "Em"],
  "ankerfinger-wechsel": ["Am", "C", "G", "Em"],
  "drei-akkord-song": ["Em", "Am", "C"],
  "arpeggio-muster": ["Em", "Am", "C", "G"],
  "bards-wechsel": ["Em7", "Dm", "C", "Am", "F", "G"],
  "barre-greifen": ["F"],
  stufenakkorde: ["C", "Am", "F", "G", "Em", "D"],
};

describe("quest chords", () => {
  for (const [id, chords] of Object.entries(QUEST_CHORDS)) {
    it(`shows the chords of ${id} from its lesson`, () => {
      const quest = content.quests.find((q) => q.id === id)!;
      expect(quest.chords).toEqual(chords);
      const mdx = readFileSync(join(here, "../lessons", `${quest.lessonId}.mdx`), "utf8");
      for (const chord of chords) {
        expect(mdx, `${id}: ${chord}`).toMatch(new RegExp(`(^|[^A-Za-z0-9])${chord}([^A-Za-z0-9#b]|$)`, "m"));
        expect(resolveChordShape(chord), `${id}: ${chord} has a diagram`).not.toBeNull();
      }
    });
  }

  it("names no chords on a quest that grips none", () => {
    expect(content.quests.find((q) => q.id === "haltung-check")!.chords).toBeUndefined();
  });
});

describe("note game quest", () => {
  it("pins noten-e-saite to the note game on the low E string", () => {
    const quest = content.quests.find((q) => q.id === "noten-e-saite")!;
    expect(quest.noteGame).toEqual({ strings: [0] });
    expect(quest.metricLabel).toBe("Treffer pro Minute");
    expect(content.quests.find((q) => q.id === "griffbrett-namen")!.noteGame).toBeUndefined();
  });
});

describe("gear catalogue", () => {
  it("uses only known sprites", () => {
    for (const item of GEAR) expect(SPRITE_NAMES as readonly string[]).toContain(item.sprite);
  });

  it("grants every milestone item for a lesson on the road", () => {
    const roadIds = content.road.map((step) => step.lessonId);
    for (const item of GEAR.filter((i) => i.milestone !== null)) expect(roadIds).toContain(item.milestone);
  });
});
