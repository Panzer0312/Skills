import { chordNotes, OPEN_CHORDS } from "@skills/core";

const VISIBLE_FRETS = 4;

export function ChordDiagramSingle({ name }: { name: string }) {
  const shape = OPEN_CHORDS[name];

  if (!shape) {
    return (
      <div className="rounded border border-slate-200 p-4 text-sm dark:border-slate-800">
        <h3 className="font-medium">{name}</h3>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Für diesen Akkord ist kein Griffbild hinterlegt.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded border border-slate-200 p-4 dark:border-slate-800">
      <h3 className="font-medium">{name}</h3>

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
          return (
            <div key={fretNumber} className="flex gap-1">
              {shape.frets.map((fret, stringIndex) => (
                <span
                  key={stringIndex}
                  data-testid={fret === fretNumber ? `dot-${stringIndex}-${fretNumber}` : undefined}
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
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
    </div>
  );
}
