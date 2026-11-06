import { noteToSemitone } from "./notes.js";

export type ScaleId = "dur" | "moll" | "moll-pentatonik";

export const SCALES: Record<ScaleId, { label: string; intervals: number[] }> = {
  dur: { label: "Dur-Tonleiter", intervals: [0, 2, 4, 5, 7, 9, 11] },
  moll: { label: "Moll-Tonleiter", intervals: [0, 2, 3, 5, 7, 8, 10] },
  "moll-pentatonik": { label: "Moll-Pentatonik", intervals: [0, 3, 5, 7, 10] },
};

/** stringIndex 0 is the low E. */
export interface FretPosition {
  stringIndex: number;
  fret: number;
}

export const MAX_FRET = 15;

export function inScale(note: string, root: string, scale: ScaleId): boolean {
  const distance = (noteToSemitone(note) - noteToSemitone(root) + 12) % 12;
  return SCALES[scale].intervals.includes(distance);
}

// Fret offsets from the root's fret on the low E string, low E to high e: [first, second] fret per string.
const BOXES = [
  [[0, 3], [0, 2], [0, 2], [0, 2], [0, 3], [0, 3]],
  [[3, 5], [2, 5], [2, 5], [2, 4], [3, 5], [3, 5]],
  [[5, 7], [5, 7], [5, 7], [4, 7], [5, 8], [5, 7]],
  [[7, 10], [7, 10], [7, 9], [7, 9], [8, 10], [7, 10]],
  [[10, 12], [10, 12], [9, 12], [9, 12], [10, 12], [10, 12]],
];

const STANDARD_OPEN = [4, 9, 2, 7, 11, 4]; // E A D G B E as semitones

function rootFret(root: string, stringIndex: number): number {
  return (noteToSemitone(root) - STANDARD_OPEN[stringIndex]! + 12) % 12;
}

export function pentatonicBox(root: string, box: 1 | 2 | 3 | 4 | 5): FretPosition[] {
  const r = rootFret(root, 0);
  const positions = BOXES[box - 1]!.flatMap((pair, stringIndex) =>
    pair.map((offset) => ({ stringIndex, fret: r + offset })),
  );
  const shift = Math.max(...positions.map((p) => p.fret)) > MAX_FRET ? 12 : 0;
  return positions.map((p) => ({ stringIndex: p.stringIndex, fret: p.fret - shift }));
}

export type CagedShape = "C" | "A" | "G" | "E" | "D";

const SHAPES: Record<CagedShape, { rootString: number; offsets: (number | null)[] }> = {
  C: { rootString: 1, offsets: [null, 0, -1, -3, -2, -3] },
  A: { rootString: 1, offsets: [null, 0, 2, 2, 2, 0] },
  G: { rootString: 0, offsets: [0, -1, -3, -3, -3, 0] },
  E: { rootString: 0, offsets: [0, 2, 2, 1, 0, 0] },
  D: { rootString: 2, offsets: [null, null, 0, 2, 3, 2] },
};

export function cagedShape(root: string, shape: CagedShape): FretPosition[] {
  const { rootString, offsets } = SHAPES[shape];
  let r = rootFret(root, rootString);
  const played = offsets.flatMap((offset, stringIndex) => (offset === null ? [] : [{ stringIndex, offset }]));
  if (played.some((p) => r + p.offset < 0)) r += 12;
  return played.map((p) => ({ stringIndex: p.stringIndex, fret: r + p.offset }));
}

/** German note names: B is H. Keeps sharps and an octave number. */
export function displayNote(note: string): string {
  return note.startsWith("B") && !note.startsWith("Bb") ? `H${note.slice(1)}` : note;
}
