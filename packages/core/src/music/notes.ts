export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

const INTERVALS = [
  "Prime",
  "kleine Sekunde",
  "große Sekunde",
  "kleine Terz",
  "große Terz",
  "Quarte",
  "Tritonus",
  "Quinte",
  "kleine Sexte",
  "große Sexte",
  "kleine Septime",
  "große Septime",
  "Oktave",
] as const;

export interface Tuning {
  name: string;
  strings: string[];
}

export const TUNINGS: Tuning[] = [
  { name: "Standard", strings: ["E2", "A2", "D3", "G3", "B3", "E4"] },
  { name: "Drop D", strings: ["D2", "A2", "D3", "G3", "B3", "E4"] },
  { name: "Half Step Down", strings: ["D#2", "G#2", "C#3", "F#3", "A#3", "D#4"] },
  { name: "Open G", strings: ["D2", "G2", "D3", "G3", "B3", "D4"] },
];

export function noteToSemitone(note: string): number {
  const sharp = NOTES.indexOf(note as (typeof NOTES)[number]);
  if (sharp >= 0) return sharp;
  const flat = FLAT_NOTES.indexOf(note as (typeof FLAT_NOTES)[number]);
  if (flat >= 0) return flat;
  throw new Error(`Unbekannter Ton: ${note}`);
}

export function semitoneToNote(semitone: number, preferFlats = false): string {
  const index = ((semitone % 12) + 12) % 12;
  return preferFlats ? FLAT_NOTES[index]! : NOTES[index]!;
}

export function transposeNote(note: string, steps: number, preferFlats = false): string {
  return semitoneToNote(noteToSemitone(note) + steps, preferFlats);
}

function splitOctave(noteWithOctave: string): { note: string; octave: number } {
  const match = /^([A-G][#b]?)(-?\d+)$/.exec(noteWithOctave);
  if (!match) throw new Error(`Ton ohne Oktave: ${noteWithOctave}`);
  return { note: match[1]!, octave: Number(match[2]) };
}

/** Absolute pitch index; C0 is 0, so A4 lands on 57. */
function absoluteIndex(noteWithOctave: string): number {
  const { note, octave } = splitOctave(noteWithOctave);
  return octave * 12 + noteToSemitone(note);
}

function fromAbsoluteIndex(index: number, preferFlats = false): string {
  const octave = Math.floor(index / 12);
  return `${semitoneToNote(index % 12, preferFlats)}${octave}`;
}

export function noteAt(tuning: Tuning, stringIndex: number, fret: number): string {
  const open = tuning.strings[stringIndex];
  if (!open) throw new Error(`Saite ${stringIndex} gibt es in dieser Stimmung nicht.`);
  return fromAbsoluteIndex(absoluteIndex(open) + fret);
}

const A4_INDEX = absoluteIndex("A4");

export function frequencyOf(noteWithOctave: string): number {
  return 440 * Math.pow(2, (absoluteIndex(noteWithOctave) - A4_INDEX) / 12);
}

export function nearestNote(frequency: number): { note: string; cents: number } {
  const exact = A4_INDEX + 12 * Math.log2(frequency / 440);
  const rounded = Math.round(exact);
  return {
    note: fromAbsoluteIndex(rounded),
    cents: Math.round((exact - rounded) * 100),
  };
}

export function intervalName(semitones: number): string {
  const name = INTERVALS[semitones];
  if (name) return name;
  return `${semitones} Halbtöne`;
}
