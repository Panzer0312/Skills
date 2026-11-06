import {
  displayNote,
  inScale,
  noteAt,
  pentatonicBox,
  TUNINGS,
  type FretPosition,
  type ScaleId,
  type Tuning,
} from "@skills/core";
import { FretboardGrid, type FretMark } from "./FretboardGrid.js";

/** Marks the scale tones, or only the given positions, with the root drawn stronger. */
export function scaleMarks(
  tuning: Tuning,
  root: string,
  scale: ScaleId,
  only?: FretPosition[],
): (stringIndex: number, fret: number) => FretMark {
  const allowed = only && new Set(only.map((p) => `${p.stringIndex}-${p.fret}`));
  return (stringIndex, fret) => {
    const note = noteAt(tuning, stringIndex, fret).replace(/-?\d+$/, "");
    const label = displayNote(note);
    const member = allowed ? allowed.has(`${stringIndex}-${fret}`) : inScale(note, root, scale);
    if (!member) return { label, state: "dim" };
    return { label, state: note === root ? "root" : "scale" };
  };
}

const STANDARD = TUNINGS.find((t) => t.name === "Standard")!;

/** A read-only fretboard for a quest: the scale or one pentatonic box in the standard tuning. */
export function FretOverlay({ root, scale, box }: { root: string; scale: ScaleId; box?: 1 | 2 | 3 | 4 | 5 }) {
  const only = box !== undefined && scale === "moll-pentatonik" ? pentatonicBox(root, box) : undefined;
  return <FretboardGrid tuning={STANDARD} mark={scaleMarks(STANDARD, root, scale, only)} />;
}
