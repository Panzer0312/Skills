import { frequencyOf, noteAt, noteToSemitone, type Tuning } from "../music/notes.js";

export interface NoteTarget {
  stringIndex: number;
  fret: number;
  /** With octave, for example "F3". */
  note: string;
}

const MAX_FRET = 12;
const TOLERANCE_CENTS = 40;
const DEFAULT_HOLD_MS = 200;

/** Semitone 0 to 11 of a note with or without octave. */
export function notePitchClass(note: string): number {
  return noteToSemitone(note.replace(/-?\d+$/, ""));
}

/** A random place on the chosen strings, never the pitch class of the previous target. */
export function nextTarget(
  strings: number[],
  previous: NoteTarget | null,
  tuning: Tuning,
  random: () => number = Math.random,
): NoteTarget {
  const avoid = previous ? notePitchClass(previous.note) : null;
  const candidates: NoteTarget[] = [];
  for (const stringIndex of strings) {
    for (let fret = 0; fret <= MAX_FRET; fret += 1) {
      const note = noteAt(tuning, stringIndex, fret);
      if (notePitchClass(note) !== avoid) candidates.push({ stringIndex, fret, note });
    }
  }
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index]!;
}

/** True within 40 cents of the target or one octave above or below it. */
export function matchesTarget(frequency: number, target: NoteTarget): boolean {
  const cents = 1200 * Math.log2(frequency / frequencyOf(target.note));
  return [cents, cents - 1200, cents + 1200].some((c) => Math.abs(c) <= TOLERANCE_CENTS);
}

/** Reports true once the pitch matched for holdMs without a break. */
export function createHoldDetector(holdMs: number = DEFAULT_HOLD_MS): (matching: boolean, nowMs: number) => boolean {
  let since: number | null = null;
  return (matching, nowMs) => {
    if (!matching) {
      since = null;
      return false;
    }
    since ??= nowMs;
    return nowMs - since >= holdMs;
  };
}
