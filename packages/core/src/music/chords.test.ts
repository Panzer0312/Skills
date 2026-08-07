import { describe, expect, it } from "vitest";
import { chordNotes, chordShape, keyChords, OPEN_CHORDS, parseChord, transposeChord } from "./chords.js";

describe("parseChord", () => {
  it("splits root, quality and bass note", () => {
    expect(parseChord("C")).toEqual({ root: "C", quality: "", bass: null });
    expect(parseChord("Am7")).toEqual({ root: "A", quality: "m7", bass: null });
    expect(parseChord("F#m")).toEqual({ root: "F#", quality: "m", bass: null });
    expect(parseChord("D/F#")).toEqual({ root: "D", quality: "", bass: "F#" });
    expect(parseChord("Bbsus4")).toEqual({ root: "Bb", quality: "sus4", bass: null });
  });

  it("returns null for things that are not chords", () => {
    expect(parseChord("Strophe")).toBeNull();
    expect(parseChord("")).toBeNull();
    expect(parseChord("H")).toBeNull();
  });
});

describe("transposeChord", () => {
  it("moves root and bass together", () => {
    expect(transposeChord("C", 2)).toBe("D");
    expect(transposeChord("Am7", 3)).toBe("Cm7");
    expect(transposeChord("D/F#", 2)).toBe("E/G#");
    expect(transposeChord("B", 1)).toBe("C");
  });

  it("can write flats", () => {
    expect(transposeChord("C", 1, true)).toBe("Db");
  });

  it("leaves unknown symbols untouched", () => {
    expect(transposeChord("Strophe", 2)).toBe("Strophe");
  });
});

describe("chordNotes", () => {
  it("spells major, minor and seventh chords", () => {
    expect(chordNotes("C")).toEqual(["C", "E", "G"]);
    expect(chordNotes("Am")).toEqual(["A", "C", "E"]);
    expect(chordNotes("G7")).toEqual(["G", "B", "D", "F"]);
    expect(chordNotes("Dsus4")).toEqual(["D", "G", "A"]);
  });
});

describe("OPEN_CHORDS", () => {
  it("ships the beginner shapes with six strings each", () => {
    for (const name of ["Em", "Am", "E", "A", "D", "G", "C", "Dm"]) {
      const shape = OPEN_CHORDS[name];
      expect(shape, `${name} fehlt`).toBeDefined();
      expect(shape!.frets).toHaveLength(6);
      expect(shape!.fingers).toHaveLength(6);
    }
  });

  it("describes Em correctly: two fingers on the second fret", () => {
    expect(OPEN_CHORDS.Em!.frets).toEqual([0, 2, 2, 0, 0, 0]);
    expect(OPEN_CHORDS.Em!.fingers).toEqual([null, 2, 3, null, null, null]);
  });

  it("mutes the low E string on the C chord", () => {
    expect(OPEN_CHORDS.C!.frets[0]).toBeNull();
  });

  it("only names frets that the shape actually contains", () => {
    for (const [name, shape] of Object.entries(OPEN_CHORDS)) {
      for (let i = 0; i < 6; i += 1) {
        const fret = shape.frets[i];
        const finger = shape.fingers[i];
        if (fret === null || fret === 0) {
          expect(finger, `${name}: Saite ${i} braucht keinen Finger`).toBeNull();
        } else {
          expect(finger, `${name}: Saite ${i} braucht einen Finger`).not.toBeNull();
        }
      }
    }
  });
});

describe("chordShape", () => {
  it("derives F as an E-form barre at fret 1", () => {
    const shape = chordShape("F");
    expect(shape).not.toBeNull();
    expect(shape!.baseFret).toBe(1);
    expect(shape!.frets[0]).toBe(1);
    expect(shape!.name).toMatch(/E-Form/);
  });

  it("derives Bb as an A-form barre at fret 1", () => {
    const shape = chordShape("Bb");
    expect(shape).not.toBeNull();
    expect(shape!.baseFret).toBe(1);
    expect(shape!.frets[0]).toBeNull();
    expect(shape!.name).toMatch(/A-Form/);
  });

  it("derives Bm as an A-form minor barre at fret 2", () => {
    const shape = chordShape("Bm");
    expect(shape).not.toBeNull();
    expect(shape!.baseFret).toBe(2);
    expect(shape!.name).toMatch(/A-Form/);
  });

  it("prefers an open chord over a derived shape", () => {
    const shape = chordShape("C");
    expect(shape).toEqual(OPEN_CHORDS.C);
  });

  it("returns null for a nonsense symbol", () => {
    expect(chordShape("Strophe")).toBeNull();
  });

  it("never derives a shape above fret 12", () => {
    for (const root of ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]) {
      for (const quality of ["", "m", "7", "m7"]) {
        const shape = chordShape(`${root}${quality}`);
        if (!shape) continue;
        const maxFret = Math.max(...shape.frets.filter((f): f is number => f !== null));
        expect(maxFret).toBeLessThanOrEqual(12);
      }
    }
  });
});

describe("keyChords", () => {
  it("builds the seven diatonic chords of a major key", () => {
    expect(keyChords("C")).toEqual([
      { grad: "I", akkord: "C" },
      { grad: "ii", akkord: "Dm" },
      { grad: "iii", akkord: "Em" },
      { grad: "IV", akkord: "F" },
      { grad: "V", akkord: "G" },
      { grad: "vi", akkord: "Am" },
      { grad: "vii°", akkord: "Bdim" },
    ]);
  });

  it("works in G major", () => {
    expect(keyChords("G").map((c) => c.akkord)).toEqual(["G", "Am", "Bm", "C", "D", "Em", "F#dim"]);
  });
});
