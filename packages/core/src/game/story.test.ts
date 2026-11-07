import { describe, expect, it } from "vitest";
import type { GameContent, LessonStatus, RoadStep } from "./quests.js";
import { currentChapter, parseStory, pendingBeat, reachedBeats } from "./story.js";

const step = (lessonId: string, months: [number, number], questId: string | null = `q-${lessonId}`): RoadStep =>
  ({ lessonId, questId, months, reason: "r" }) as RoadStep;
const road: RoadStep[] = [step("a", [1, 1]), step("b", [1, 2]), step("c", [3, 3]), step("d", [4, 4])];
const content = { road } as unknown as GameContent;

const raw = {
  mentor: { name: "Meister", role: "Lehrer" },
  chapters: [
    { id: "k1", title: "Eins", months: [1, 2], intro: "i", theoryLessons: ["t"] },
    { id: "k2", title: "Zwei", months: [3, 6], intro: "i", theoryLessons: [] },
  ],
  beats: [
    { id: "b-a-done", chapterId: "k1", when: "done", lessonId: "a", title: "A fertig", lines: ["x"] },
    { id: "b-a-next", chapterId: "k1", when: "next", lessonId: "a", title: "A neu", lines: ["x"] },
    { id: "b-c-next", chapterId: "k2", when: "next", lessonId: "c", title: "C neu", lines: ["x"] },
  ],
};
const story = parseStory(raw, content);
const ids = (b: { id: string }[]) => b.map((x) => x.id);
const st = (o: Record<string, LessonStatus>) => o;

describe("parseStory", () => {
  it("rejects a beat on a lesson off the road", () => {
    const bad = { ...raw, beats: [{ ...raw.beats[0]!, lessonId: "zzz" }] };
    expect(() => parseStory(bad, content)).toThrow(/zzz/);
  });
  it("rejects an unknown chapter and duplicate ids", () => {
    expect(() => parseStory({ ...raw, beats: [{ ...raw.beats[0]!, chapterId: "nope" }] }, content)).toThrow();
    expect(() => parseStory({ ...raw, beats: [raw.beats[0], raw.beats[0]] }, content)).toThrow();
    expect(() => parseStory({ ...raw, chapters: [raw.chapters[0], raw.chapters[0]] }, content)).toThrow();
  });
});

describe("reachedBeats", () => {
  it("reaches the next beat of the best next step, in order", () => {
    expect(ids(reachedBeats(story, road, st({})))).toEqual(["b-a-next"]);
  });
  it("puts next before done at the same step", () => {
    expect(ids(reachedBeats(story, road, st({ a: "gelernt" })))).toEqual(["b-a-next", "b-a-done"]);
  });
  it("reaches everything once the road is finished", () => {
    const all = st({ a: "gelernt", b: "gelernt", c: "gemeistert", d: "gelernt" });
    expect(ids(reachedBeats(story, road, all))).toEqual(["b-a-next", "b-a-done", "b-c-next"]);
  });
  it("reaches a later next beat when placed past it", () => {
    expect(ids(reachedBeats(story, road, st({ a: "gelernt", b: "gelernt" })))).toEqual([
      "b-a-next", "b-a-done", "b-c-next",
    ]);
  });
});

describe("done beats", () => {
  it("are not reached by a tick on a later lesson alone", () => {
    expect(ids(reachedBeats(story, road, st({ d: "gelernt" })))).toEqual(["b-a-next"]);
    expect(ids(reachedBeats(story, road, st({ a: "gelernt", c: "gelernt" })))).toEqual(["b-a-next", "b-a-done"]);
  });
  it("wait until the road gets past their step", () => {
    const tail = parseStory({ ...raw, beats: [{ ...raw.beats[0]!, lessonId: "d" }] }, content);
    expect(ids(reachedBeats(tail, road, st({ a: "gelernt", b: "gelernt", c: "gelernt" })))).toEqual([]);
    expect(ids(reachedBeats(tail, road, st({ a: "gelernt", b: "gelernt", c: "gelernt", d: "gelernt" })))).toEqual(["b-a-done"]);
  });
});

describe("pendingBeat", () => {
  it("is the last reached beat that is not seen", () => {
    const s = st({ a: "gelernt", b: "gelernt" });
    expect(pendingBeat(story, road, s, [])?.id).toBe("b-c-next");
    expect(pendingBeat(story, road, s, ["b-c-next"])?.id).toBe("b-a-done");
    expect(pendingBeat(story, road, s, ["b-c-next", "b-a-done", "b-a-next"])).toBeNull();
  });
});

describe("currentChapter", () => {
  it("follows the best next step's first month", () => {
    expect(currentChapter(story, road, st({})).id).toBe("k1");
    expect(currentChapter(story, road, st({ a: "gelernt", b: "gelernt" })).id).toBe("k2");
  });
  it("is the last chapter when the road is finished", () => {
    const all = st({ a: "gelernt", b: "gelernt", c: "gelernt", d: "gelernt" });
    expect(currentChapter(story, road, all).id).toBe("k2");
  });
});
