import { chordNotes, type ChordShape } from "@skills/core";
import type { ChordOverrides } from "./chordOverrides.js";
import { resolveChordShape } from "./userChords.js";

const VISIBLE_FRETS = 4;
const COLUMN_REM = 1.75; // w-6 (1.5rem) + gap-1 (0.25rem)
const DOT_REM = 1.5;

/** Finds a barre at `fretNumber`: two or more strings held down by the same finger. */
function findBarre(shape: ChordShape, fretNumber: number): { start: number; end: number } | null {
  const byFinger = new Map<number, number[]>();
  shape.frets.forEach((fret, stringIndex) => {
    if (fret !== fretNumber) return;
    const finger = shape.fingers[stringIndex];
    if (finger === null || finger === undefined) return;
    const indices = byFinger.get(finger) ?? [];
    indices.push(stringIndex);
    byFinger.set(finger, indices);
  });

  for (const indices of byFinger.values()) {
    if (indices.length >= 2) {
      return { start: Math.min(...indices), end: Math.max(...indices) };
    }
  }
  return null;
}

export function ChordDiagramSingle({
  name,
  overrides,
  onEdit,
}: {
  name: string;
  overrides?: ChordOverrides;
  onEdit?: () => void;
}) {
  const shape = resolveChordShape(name, overrides);

  if (!shape) {
    return (
      <div className="rounded border border-slate-200 p-4 text-sm dark:border-slate-800">
        <h3 className="font-medium">{name}</h3>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Für diesen Akkord ist kein Griffbild hinterlegt.
        </p>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="mt-2 text-xs text-slate-500 underline dark:text-slate-400"
          >
            Griff bearbeiten
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-baseline justify-between">
        <h3 className="font-medium">{name}</h3>
        {shape.baseFret > 1 ? (
          <span className="text-xs text-slate-500 dark:text-slate-400" data-testid="base-fret">
            {shape.baseFret}. Bund
          </span>
        ) : null}
      </div>

      {shape.name !== name ? (
        <p data-testid="shape-name" className="text-xs text-slate-500 dark:text-slate-400">
          {shape.name}
        </p>
      ) : null}

      <div className="mt-3 flex gap-1 text-center text-xs">
        {shape.frets.map((fret, stringIndex) => (
          <span key={stringIndex} data-testid={`string-${stringIndex}`} className="w-6">
            {fret === null ? "x" : fret === 0 ? "0" : ""}
          </span>
        ))}
      </div>

      <div className="mt-1 space-y-1">
        {Array.from({ length: VISIBLE_FRETS }, (_, row) => {
          const fretNumber = shape.baseFret + row;
          const barre = findBarre(shape, fretNumber);
          return (
            <div key={fretNumber} className="relative flex gap-1">
              {barre ? (
                <span
                  data-testid={`barre-${fretNumber}`}
                  className="absolute top-0 h-6 rounded-full bg-slate-900 dark:bg-slate-100"
                  style={{
                    left: `${barre.start * COLUMN_REM}rem`,
                    width: `${(barre.end - barre.start) * COLUMN_REM + DOT_REM}rem`,
                  }}
                />
              ) : null}
              {shape.frets.map((fret, stringIndex) => (
                <span
                  key={stringIndex}
                  data-testid={fret === fretNumber ? `dot-${stringIndex}-${fretNumber}` : undefined}
                  className={`relative flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                    fret === fretNumber
                      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {fret === fretNumber ? (shape.fingers[stringIndex] ?? "") : ""}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
        Töne: {chordNotes(name).join(", ")}
      </p>

      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="mt-2 text-xs text-slate-500 underline dark:text-slate-400"
        >
          Griff bearbeiten
        </button>
      ) : null}
    </div>
  );
}
