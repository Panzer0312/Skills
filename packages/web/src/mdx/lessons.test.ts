import { describe, expect, it } from "vitest";
import { isUnlocked, sortLessons, type LessonMeta } from "./lessons.js";

const a: LessonMeta = { id: "01-haltung", title: "Haltung", order: 1, requires: null };
const b: LessonMeta = { id: "02-anschlag", title: "Anschlag", order: 2, requires: "01-haltung" };
const c: LessonMeta = { id: "03-toene", title: "Töne", order: 2, requires: "02-anschlag" };

describe("sortLessons", () => {
  it("sorts by order and breaks ties by id", () => {
    expect(sortLessons([c, b, a]).map((l) => l.id)).toEqual(["01-haltung", "02-anschlag", "03-toene"]);
  });
});

describe("isUnlocked", () => {
  it("unlocks a lesson without prerequisites", () => {
    expect(isUnlocked(a, new Set())).toBe(true);
  });

  it("locks a lesson whose prerequisite is not done", () => {
    expect(isUnlocked(b, new Set())).toBe(false);
  });

  it("unlocks a lesson once its prerequisite is done", () => {
    expect(isUnlocked(b, new Set(["01-haltung"]))).toBe(true);
  });
});
