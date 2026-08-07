import type { ChordShape } from "@skills/core";
import { useState } from "react";
import { ChordDiagramSingle } from "./ChordDiagramSingle.js";

const STRINGS = [0, 1, 2, 3, 4, 5];
const VISIBLE_FRETS = 5;
const STRING_LABELS = ["E", "A", "D", "G", "H", "e"];

const EMPTY: ChordShape = {
  name: "",
  frets: [0, 0, 0, 0, 0, 0],
  fingers: [null, null, null, null, null, null],
  baseFret: 1,
};

export interface ChordEditorProps {
  symbol: string;
  initial: ChordShape | null;
  allowSongScope: boolean;
  canReset?: { song: boolean; global: boolean };
  onSave: (shape: ChordShape, scope: "song" | "global") => void;
  onReset?: (scope: "song" | "global") => void;
  onCancel: () => void;
}

export function ChordEditor({
  symbol,
  initial,
  allowSongScope,
  canReset,
  onSave,
  onReset,
  onCancel,
}: ChordEditorProps) {
  const start = initial ?? EMPTY;
  const [frets, setFrets] = useState<(number | null)[]>([...start.frets]);
  const [fingers, setFingers] = useState<(number | null)[]>([...start.fingers]);
  const [baseFret, setBaseFret] = useState(start.baseFret);
  const [name, setName] = useState(initial?.name ?? "");

  function update(stringIndex: number, fret: number | null, finger: number | null) {
    setFrets((current) => current.map((value, i) => (i === stringIndex ? fret : value)));
    setFingers((current) => current.map((value, i) => (i === stringIndex ? finger : value)));
  }

  function toggleCell(stringIndex: number, fretNumber: number) {
    if (frets[stringIndex] === fretNumber) update(stringIndex, 0, null);
    else update(stringIndex, fretNumber, fingers[stringIndex] ?? 1);
  }

  function toggleHead(stringIndex: number) {
    update(stringIndex, frets[stringIndex] === null ? 0 : null, null);
  }

  const preview: ChordShape = { name: name || symbol, frets, fingers, baseFret };

  return (
    <div className="space-y-4 rounded border border-slate-300 p-4 dark:border-slate-700">
      <h3 className="text-lg font-medium">Griffbild für {symbol}</h3>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col text-sm">
          <span>Anzeigename</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={symbol}
            className="mt-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span>Startbund</span>
          <input
            type="number"
            min={1}
            max={24}
            value={baseFret}
            onChange={(e) => setBaseFret(Math.min(24, Math.max(1, Number(e.target.value) || 1)))}
            className="mt-1 w-20 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </div>

      <div>
        <div className="flex gap-1 text-center text-xs">
          {STRINGS.map((stringIndex) => (
            <button
              key={stringIndex}
              type="button"
              data-testid={`head-${stringIndex}`}
              onClick={() => toggleHead(stringIndex)}
              aria-label={`Saite ${STRING_LABELS[stringIndex]} leer oder gedämpft`}
              className="w-8 rounded border border-slate-300 py-0.5 dark:border-slate-700"
            >
              {frets[stringIndex] === null ? "x" : frets[stringIndex] === 0 ? "0" : "·"}
            </button>
          ))}
        </div>

        <div className="mt-1 space-y-1">
          {Array.from({ length: VISIBLE_FRETS }, (_, row) => {
            const fretNumber = baseFret + row;
            return (
              <div key={fretNumber} className="flex gap-1">
                {STRINGS.map((stringIndex) => {
                  const set = frets[stringIndex] === fretNumber;
                  return (
                    <button
                      key={stringIndex}
                      type="button"
                      data-testid={`cell-${stringIndex}-${fretNumber}`}
                      onClick={() => toggleCell(stringIndex, fretNumber)}
                      aria-label={`Saite ${STRING_LABELS[stringIndex]}, Bund ${fretNumber}`}
                      className={`h-8 w-8 rounded-full border text-xs ${
                        set
                          ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                          : "border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      {set ? (fingers[stringIndex] ?? "") : ""}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        {STRINGS.filter((i) => typeof frets[i] === "number" && frets[i] !== 0).map((stringIndex) => (
          <label key={stringIndex} className="flex items-center gap-1">
            <span>{STRING_LABELS[stringIndex]}</span>
            <select
              value={fingers[stringIndex] ?? 1}
              aria-label={`Finger für Saite ${STRING_LABELS[stringIndex]}`}
              onChange={(e) => update(stringIndex, frets[stringIndex] ?? null, Number(e.target.value))}
              className="rounded border border-slate-300 px-1 py-0.5 dark:border-slate-700 dark:bg-slate-900"
            >
              {[1, 2, 3, 4].map((finger) => (
                <option key={finger} value={finger}>
                  {finger}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div>
        <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Vorschau</div>
        <div className="max-w-[14rem]">
          <ChordDiagramSingle name={symbol} overrides={{ song: { [symbol]: preview } }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {allowSongScope ? (
          <button
            type="button"
            onClick={() => onSave(preview, "song")}
            className="rounded bg-slate-900 px-3 py-1 text-white dark:bg-slate-100 dark:text-slate-900"
          >
            Nur in diesem Song
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onSave(preview, "global")}
          className="rounded bg-slate-900 px-3 py-1 text-white dark:bg-slate-100 dark:text-slate-900"
        >
          In allen Songs
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1 dark:border-slate-700"
        >
          Abbrechen
        </button>
        {canReset?.song && onReset ? (
          <button
            type="button"
            onClick={() => onReset("song")}
            className="rounded border border-slate-300 px-3 py-1 dark:border-slate-700"
          >
            Griff für diesen Song zurücksetzen
          </button>
        ) : null}
        {canReset?.global && onReset ? (
          <button
            type="button"
            onClick={() => onReset("global")}
            className="rounded border border-slate-300 px-3 py-1 dark:border-slate-700"
          >
            Globalen Griff zurücksetzen
          </button>
        ) : null}
      </div>
    </div>
  );
}
