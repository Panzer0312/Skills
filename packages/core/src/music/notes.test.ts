import { describe, expect, it } from "vitest";
import {
  frequencyOf,
  intervalName,
  nearestNote,
  noteAt,
  noteToSemitone,
  semitoneToNote,
  transposeNote,
  TUNINGS,
} from "./notes.js";

const standard = TUNINGS.find((t) => t.name === "Standard")!;

describe("note names", () => {
  it("maps sharps and flats to the same semitone", () => {
    expect(noteToSemitone("C#")).toBe(1);
    expect(noteToSemitone("Db")).toBe(1);
    expect(noteToSemitone("B")).toBe(11);
  });

  it("prefers sharps by default and flats on request", () => {
    expect(semitoneToNote(1)).toBe("C#");
    expect(semitoneToNote(1, true)).toBe("Db");
  });

  it("wraps around the octave when transposing", () => {
    expect(transposeNote("A", 3)).toBe("C");
    expect(transposeNote("C", -1)).toBe("B");
    expect(transposeNote("F#", 12)).toBe("F#");
  });
});

describe("fretboard", () => {
  it("names the open strings of standard tuning", () => {
    expect(standard.strings).toEqual(["E2", "A2", "D3", "G3", "B3", "E4"]);
    expect(noteAt(standard, 0, 0)).toBe("E2");
  });

  it("names fretted notes including the octave", () => {
    expect(noteAt(standard, 0, 5)).toBe("A2");
    expect(noteAt(standard, 0, 12)).toBe("E3");
    expect(noteAt(standard, 5, 3)).toBe("G4");
  });

  it("knows drop D", () => {
    const dropD = TUNINGS.find((t) => t.name === "Drop D")!;
    expect(dropD.strings[0]).toBe("D2");
    expect(noteAt(dropD, 0, 2)).toBe("E2");
  });
});

describe("frequencies", () => {
  it("anchors on A4 = 440 Hz", () => {
    expect(frequencyOf("A4")).toBeCloseTo(440, 5);
    expect(frequencyOf("A3")).toBeCloseTo(220, 5);
    expect(frequencyOf("E2")).toBeCloseTo(82.41, 1);
  });

  it("finds the nearest note and the deviation in cents", () => {
    expect(nearestNote(440)).toEqual({ note: "A4", cents: 0 });

    const slightlySharp = nearestNote(444);
    expect(slightlySharp.note).toBe("A4");
    expect(slightlySharp.cents).toBeGreaterThan(10);
    expect(slightlySharp.cents).toBeLessThan(20);

    const slightlyFlat = nearestNote(436);
    expect(slightlyFlat.note).toBe("A4");
    expect(slightlyFlat.cents).toBeLessThan(-10);
  });
});

describe("intervals", () => {
  it("names intervals in German", () => {
    expect(intervalName(0)).toBe("Prime");
    expect(intervalName(3)).toBe("kleine Terz");
    expect(intervalName(7)).toBe("Quinte");
    expect(intervalName(12)).toBe("Oktave");
  });
});
