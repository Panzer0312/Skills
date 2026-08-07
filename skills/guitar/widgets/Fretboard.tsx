import { intervalName, noteAt, noteToSemitone, NOTES, TUNINGS } from "@skills/core";
import { useState } from "react";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";

type Mode = "noten" | "intervalle" | "tonleiter";

const FRET_COUNT = 15;
const MARKERS = [3, 5, 7, 9, 12, 15];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const SHORT_INTERVALS = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"];

export default function Fretboard(_: WidgetProps) {
  const [tuningName, setTuningName] = useState("Standard");
  const [mode, setMode] = useState<Mode>("noten");
  const [root, setRoot] = useState("E");

  const tuning = TUNINGS.find((t) => t.name === tuningName)!;
  const rootSemitone = noteToSemitone(root);

  function labelFor(stringIndex: number, fret: number): string {
    const withOctave = noteAt(tuning, stringIndex, fret);
    const note = withOctave.replace(/-?\d+$/, "");
    if (mode === "noten") return note;
    const distance = (noteToSemitone(note) - rootSemitone + 12) % 12;
    return SHORT_INTERVALS[distance]!;
  }

  function inScale(stringIndex: number, fret: number): boolean {
    if (mode !== "tonleiter") return true;
    const note = noteAt(tuning, stringIndex, fret).replace(/-?\d+$/, "");
    return MAJOR_SCALE.includes((noteToSemitone(note) - rootSemitone + 12) % 12);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Griffbrett</h1>

      <div className="flex flex-wrap gap-4">
        <label className="text-sm">
          <span className="mr-2">Stimmung</span>
          <select
            value={tuningName}
            onChange={(e) => setTuningName(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          >
            {TUNINGS.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mr-2">Anzeige</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="noten">Notennamen</option>
            <option value="intervalle">Intervalle</option>
            <option value="tonleiter">Dur-Tonleiter</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="mr-2">Grundton</span>
          <select
            value={root}
            onChange={(e) => setRoot(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          >
            {NOTES.map((note) => (
              <option key={note} value={note}>
                {note}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse text-center text-xs">
          <tbody>
            {[...tuning.strings].map((_, reversed) => {
              const stringIndex = tuning.strings.length - 1 - reversed;
              return (
                <tr key={stringIndex}>
                  {Array.from({ length: FRET_COUNT + 1 }, (_, fret) => {
                    const highlighted = inScale(stringIndex, fret);
                    return (
                      <td
                        key={fret}
                        data-testid={`fret-${stringIndex}-${fret}`}
                        data-in-scale={String(highlighted)}
                        className={`h-9 w-12 border border-slate-300 dark:border-slate-700 ${
                          fret === 0 ? "bg-slate-200 font-medium dark:bg-slate-800" : ""
                        } ${highlighted ? "" : "text-slate-300 dark:text-slate-700"}`}
                      >
                        {labelFor(stringIndex, fret)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr>
              {Array.from({ length: FRET_COUNT + 1 }, (_, fret) => (
                <td key={fret} className="pt-1 text-slate-500">
                  {MARKERS.includes(fret) ? fret : fret === 0 ? "leer" : ""}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {mode === "intervalle" ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Die Zahlen zählen vom Grundton {root} aus. 5 ist die {intervalName(7)}, 3 die {intervalName(4)}.
        </p>
      ) : null}
    </div>
  );
}
