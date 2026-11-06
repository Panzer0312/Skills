import { noteToSemitone, semitoneToNote } from "./notes.js";
import type { ScaleId } from "./scales.js";

export type JamStyle = "rock" | "metal" | "blues";

export const JAM_STYLES: Record<
  JamStyle,
  { label: string; scale: ScaleId; stepsPerBar: number; progression: number[] }
> = {
  rock: { label: "Rock", scale: "moll-pentatonik", stepsPerBar: 16, progression: [0, 8, 3, 10] },
  metal: { label: "Metal", scale: "moll", stepsPerBar: 16, progression: [0, 0, 8, 10] },
  blues: {
    label: "Blues",
    scale: "moll-pentatonik",
    stepsPerBar: 12,
    progression: [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 0],
  },
};

export interface JamSettings {
  root: string;
  style: JamStyle;
}

export interface JamHit {
  step: number;
  voice: "kick" | "snare" | "hat" | "bass";
  midi?: number;
}

interface StylePattern {
  kick: number[];
  snare: number[];
  hat: number[];
  bass: number[];
}

// Steps are 16ths for rock and metal (beats at 0, 4, 8, 12) and triplet
// shuffle steps for blues (beats at 0, 3, 6, 9).
const PATTERNS: Record<JamStyle, StylePattern> = {
  rock: {
    kick: [0, 8, 10],
    snare: [4, 12],
    hat: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  metal: {
    kick: [0, 2, 4, 6, 8, 10, 12, 14],
    snare: [4, 12],
    hat: [0, 2, 4, 6, 8, 10, 12, 14],
    // Gallop per beat: 8th, then two 16ths.
    bass: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15],
  },
  blues: {
    kick: [0, 6],
    snare: [3, 9],
    hat: [0, 2, 3, 5, 6, 8, 9, 11],
    bass: [0, 3, 6, 9],
  },
};

function progressionOffset(settings: JamSettings, barIndex: number): number {
  const { progression } = JAM_STYLES[settings.style];
  const length = progression.length;
  return progression[((barIndex % length) + length) % length]!;
}

function chordPitchClass(settings: JamSettings, barIndex: number): number {
  const root = noteToSemitone(settings.root);
  return (((root + progressionOffset(settings, barIndex)) % 12) + 12) % 12;
}

export function jamBar(settings: JamSettings, barIndex: number): JamHit[] {
  const pattern = PATTERNS[settings.style];
  const bassMidi = 28 + ((chordPitchClass(settings, barIndex) - 4 + 12) % 12);
  const hits: JamHit[] = [
    ...pattern.kick.map((step): JamHit => ({ step, voice: "kick" })),
    ...pattern.snare.map((step): JamHit => ({ step, voice: "snare" })),
    ...pattern.hat.map((step): JamHit => ({ step, voice: "hat" })),
    ...pattern.bass.map((step): JamHit => ({ step, voice: "bass", midi: bassMidi })),
  ];
  return hits.sort((a, b) => a.step - b.step);
}

export function jamChord(settings: JamSettings, barIndex: number): string {
  const name = semitoneToNote(chordPitchClass(settings, barIndex));
  const offset = progressionOffset(settings, barIndex);
  switch (settings.style) {
    case "rock":
      return offset === 0 ? `${name}m` : name;
    case "metal":
      return `${name}5`;
    case "blues":
      return `${name}7`;
  }
}
