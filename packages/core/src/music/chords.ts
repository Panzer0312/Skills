import { noteToSemitone, semitoneToNote, transposeNote } from "./notes.js";

export interface ParsedChord {
  root: string;
  quality: string;
  bass: string | null;
}

export interface ChordShape {
  name: string;
  frets: (number | null)[];
  fingers: (number | null)[];
  baseFret: number;
}

const CHORD_PATTERN = /^([A-G][#b]?)([^/\s]*)(?:\/([A-G][#b]?))?$/;

const KNOWN_QUALITIES = new Set([
  "", "m", "maj7", "m7", "7", "6", "m6", "9", "m9", "dim", "aug",
  "sus2", "sus4", "add9", "5", "7sus4", "m7b5",
]);

export function parseChord(symbol: string): ParsedChord | null {
  const match = CHORD_PATTERN.exec(symbol.trim());
  if (!match) return null;
  const quality = match[2] ?? "";
  if (!KNOWN_QUALITIES.has(quality)) return null;
  return { root: match[1]!, quality, bass: match[3] ?? null };
}

export function transposeChord(symbol: string, steps: number, preferFlats = false): string {
  const parsed = parseChord(symbol);
  if (!parsed) return symbol;
  const root = transposeNote(parsed.root, steps, preferFlats);
  const bass = parsed.bass === null ? null : transposeNote(parsed.bass, steps, preferFlats);
  return `${root}${parsed.quality}${bass ? `/${bass}` : ""}`;
}

const FORMULAS: Record<string, number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  "7": [0, 4, 7, 10],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  "9": [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 4, 7, 14],
  "5": [0, 7],
  "7sus4": [0, 5, 7, 10],
  m7b5: [0, 3, 6, 10],
};

export function chordNotes(symbol: string): string[] {
  const parsed = parseChord(symbol);
  if (!parsed) return [];
  const formula = FORMULAS[parsed.quality] ?? FORMULAS[""]!;
  const root = noteToSemitone(parsed.root);
  return formula.map((step) => semitoneToNote(root + step));
}

export const OPEN_CHORDS: Record<string, ChordShape> = {
  Em: { name: "Em", frets: [0, 2, 2, 0, 0, 0], fingers: [null, 2, 3, null, null, null], baseFret: 1 },
  Am: { name: "Am", frets: [null, 0, 2, 2, 1, 0], fingers: [null, null, 2, 3, 1, null], baseFret: 1 },
  E: { name: "E", frets: [0, 2, 2, 1, 0, 0], fingers: [null, 2, 3, 1, null, null], baseFret: 1 },
  A: { name: "A", frets: [null, 0, 2, 2, 2, 0], fingers: [null, null, 1, 2, 3, null], baseFret: 1 },
  D: { name: "D", frets: [null, null, 0, 2, 3, 2], fingers: [null, null, null, 1, 3, 2], baseFret: 1 },
  G: { name: "G", frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, null, null, null, 3], baseFret: 1 },
  C: { name: "C", frets: [null, 3, 2, 0, 1, 0], fingers: [null, 3, 2, null, 1, null], baseFret: 1 },
  Dm: { name: "Dm", frets: [null, null, 0, 2, 3, 1], fingers: [null, null, null, 2, 3, 1], baseFret: 1 },
  Dsus2: { name: "Dsus2", frets: [null, null, 0, 2, 3, 0], fingers: [null, null, null, 1, 2, null], baseFret: 1 },
  Asus4: { name: "Asus4", frets: [null, 0, 2, 2, 3, 0], fingers: [null, null, 1, 2, 3, null], baseFret: 1 },
  E7: { name: "E7", frets: [0, 2, 0, 1, 0, 0], fingers: [null, 2, null, 1, null, null], baseFret: 1 },
  A7: { name: "A7", frets: [null, 0, 2, 0, 2, 0], fingers: [null, null, 2, null, 3, null], baseFret: 1 },
  D7: { name: "D7", frets: [null, null, 0, 2, 1, 2], fingers: [null, null, null, 2, 1, 3], baseFret: 1 },
  G7: { name: "G7", frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, null, null, null, 1], baseFret: 1 },
  C7: { name: "C7", frets: [null, 3, 2, 3, 1, 0], fingers: [null, 3, 2, 4, 1, null], baseFret: 1 },
};

/** Movable shapes. baseFret 1 means "place the root here and slide the shape". */
export const POWER_CHORD_SHAPE: ChordShape = {
  name: "Powerchord (E-Saite)",
  frets: [1, 3, 3, null, null, null],
  fingers: [1, 3, 4, null, null, null],
  baseFret: 1,
};

export const BARRE_E_SHAPE: ChordShape = {
  name: "Barré, E-Form",
  frets: [1, 3, 3, 2, 1, 1],
  fingers: [1, 3, 4, 2, 1, 1],
  baseFret: 1,
};

export const BARRE_A_SHAPE: ChordShape = {
  name: "Barré, A-Form",
  frets: [null, 1, 3, 3, 3, 1],
  fingers: [null, 1, 2, 3, 4, 1],
  baseFret: 1,
};

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const DEGREES = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
const QUALITIES = ["", "m", "m", "", "", "m", "dim"];

export function keyChords(root: string): { grad: string; akkord: string }[] {
  const base = noteToSemitone(root);
  return MAJOR_SCALE.map((step, i) => ({
    grad: DEGREES[i]!,
    akkord: `${semitoneToNote(base + step)}${QUALITIES[i]}`,
  }));
}
