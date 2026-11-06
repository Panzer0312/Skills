import { describe, expect, it } from "vitest";
import { noteAt, noteToSemitone, NOTES, TUNINGS } from "./notes.js";
import {
  cagedShape,
  displayNote,
  inScale,
  MAX_FRET,
  pentatonicBox,
  type CagedShape,
  type FretPosition,
} from "./scales.js";

const standard = TUNINGS.find((t) => t.name === "Standard")!;
const noteOf = (p: FretPosition) => noteAt(standard, p.stringIndex, p.fret).replace(/-?\d+$/, "");
const frets = (list: FretPosition[], s: number) =>
  list.filter((p) => p.stringIndex === s).map((p) => p.fret).sort((a, b) => a - b);

describe("scales", () => {
  it("knows which notes belong to a scale", () => {
    expect(inScale("G", "A", "moll-pentatonik")).toBe(true);
    expect(inScale("B", "A", "moll-pentatonik")).toBe(false);
    expect(inScale("F#", "G", "dur")).toBe(true);
    expect(inScale("F", "G", "dur")).toBe(false);
    expect(inScale("C", "A", "moll")).toBe(true);
  });

  it("places the pentatonic boxes", () => {
    expect(frets(pentatonicBox("A", 1), 0)).toEqual([5, 8]);
    expect(frets(pentatonicBox("A", 1), 1)).toEqual([5, 7]);
    expect(frets(pentatonicBox("A", 1), 4)).toEqual([5, 8]);
    expect(frets(pentatonicBox("A", 3), 4)).toEqual([10, 13]);
    expect(frets(pentatonicBox("E", 1), 0)).toEqual([0, 3]);
    // Box 5 of A runs to fret 17, so it moves down an octave.
    expect(frets(pentatonicBox("A", 5), 0)).toEqual([3, 5]);
    expect(frets(pentatonicBox("A", 5), 2)).toEqual([2, 5]);
  });

  it("keeps every box on the drawn frets and in the scale", () => {
    for (const root of NOTES) {
      for (const box of [1, 2, 3, 4, 5] as const) {
        const positions = pentatonicBox(root, box);
        expect(positions).toHaveLength(12);
        for (const p of positions) {
          expect(p.fret).toBeGreaterThanOrEqual(0);
          expect(p.fret).toBeLessThanOrEqual(MAX_FRET);
          expect(inScale(noteOf(p), root, "moll-pentatonik")).toBe(true);
        }
      }
    }
  });

  it("places the CAGED shapes", () => {
    expect(cagedShape("C", "C")).toEqual([
      { stringIndex: 1, fret: 3 },
      { stringIndex: 2, fret: 2 },
      { stringIndex: 3, fret: 0 },
      { stringIndex: 4, fret: 1 },
      { stringIndex: 5, fret: 0 },
    ]);
    expect(cagedShape("C", "E").map((p) => p.fret)).toEqual([8, 10, 10, 9, 8, 8]);
    expect(cagedShape("C", "D").map((p) => p.fret)).toEqual([10, 12, 13, 12]);
    expect(cagedShape("A", "C").map((p) => p.fret)).toEqual([12, 11, 9, 10, 9]);
  });

  it("builds every CAGED shape from major chord tones", () => {
    for (const root of NOTES) {
      for (const shape of ["C", "A", "G", "E", "D"] as CagedShape[]) {
        for (const p of cagedShape(root, shape)) {
          expect(p.fret).toBeGreaterThanOrEqual(0);
          expect(p.fret).toBeLessThanOrEqual(MAX_FRET);
          expect([0, 4, 7]).toContain((noteToSemitone(noteOf(p)) - noteToSemitone(root) + 12) % 12);
        }
      }
    }
  });

  it("names B as H in German", () => {
    expect(displayNote("B")).toBe("H");
    expect(displayNote("B3")).toBe("H3");
    expect(displayNote("A#")).toBe("A#");
    expect(displayNote("A#3")).toBe("A#3");
  });
});
