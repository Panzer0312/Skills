import { describe, expect, it } from "vitest";
import { frequencyOf, noteAt, noteToSemitone, TUNINGS } from "../music/notes.js";
import { createHoldDetector, matchesTarget, nextTarget, type NoteTarget } from "./noteFinder.js";

const standard = TUNINGS[0]!;
const pitchClass = (note: string) => noteToSemitone(note.replace(/-?\d+$/, ""));

describe("matchesTarget", () => {
  const f: NoteTarget = { stringIndex: 1, fret: 8, note: "F3" };
  it("accepts the pitch within 40 cents and an octave off either way", () => {
    expect(matchesTarget(frequencyOf("F3"), f)).toBe(true);
    expect(matchesTarget(frequencyOf("F3") * 1.02, f)).toBe(true);
    expect(matchesTarget(frequencyOf("F3") * 1.03, f)).toBe(false);
    expect(matchesTarget(frequencyOf("F4"), f)).toBe(true);
    expect(matchesTarget(frequencyOf("F2"), f)).toBe(true);
    expect(matchesTarget(frequencyOf("F#3"), f)).toBe(false);
  });
});

describe("createHoldDetector", () => {
  it("needs the pitch held without a break", () => {
    const hold = createHoldDetector(200);
    expect(hold(true, 0)).toBe(false);
    expect(hold(true, 150)).toBe(false);
    expect(hold(false, 160)).toBe(false);
    expect(hold(true, 170)).toBe(false);
    expect(hold(true, 380)).toBe(true);
  });
});

describe("nextTarget", () => {
  it("never repeats the pitch class of the previous target", () => {
    let previous: NoteTarget | null = null;
    for (let i = 0; i < 200; i += 1) {
      const target = nextTarget([0], previous, standard);
      if (previous) expect(pitchClass(target.note)).not.toBe(pitchClass(previous.note));
      previous = target;
    }
  });
  it("stays on the chosen strings and frets 0 to 12", () => {
    let previous: NoteTarget | null = null;
    for (let i = 0; i < 200; i += 1) {
      const target = nextTarget([0, 1], previous, standard);
      expect([0, 1]).toContain(target.stringIndex);
      expect(target.fret).toBeGreaterThanOrEqual(0);
      expect(target.fret).toBeLessThanOrEqual(12);
      expect(target.note).toBe(noteAt(standard, target.stringIndex, target.fret));
      previous = target;
    }
  });
});
