import {
  cagedShape,
  displayNote,
  intervalName,
  noteAt,
  noteToSemitone,
  NOTES,
  pentatonicBox,
  TUNINGS,
  type CagedShape,
  type ScaleId,
} from "@skills/core";
import { useState } from "react";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";
import { scaleMarks } from "../game/FretOverlay.js";
import { FretboardGrid, type FretMark } from "../game/FretboardGrid.js";

type Mode = "noten" | "intervalle" | "tonleiter" | "moll" | "pentatonik" | "box" | "caged";

const SCALE_MODES: Partial<Record<Mode, ScaleId>> = { tonleiter: "dur", moll: "moll", pentatonik: "moll-pentatonik" };
const SHORT_INTERVALS = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"];
const SELECT_CLASS = "rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900";

export default function Fretboard(_: WidgetProps) {
  const [tuningName, setTuningName] = useState("Standard");
  const [mode, setMode] = useState<Mode>("noten");
  const [root, setRoot] = useState("E");
  const [box, setBox] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [form, setForm] = useState<CagedShape>("E");

  const tuning = TUNINGS.find((t) => t.name === tuningName)!;
  const rootSemitone = noteToSemitone(root);
  const needsStandard = (mode === "box" || mode === "caged") && tuningName !== "Standard";

  const scaleId = SCALE_MODES[mode];
  const shapeMarks = scaleMarks(
    tuning,
    root,
    "moll-pentatonik",
    mode === "box" ? pentatonicBox(root, box) : mode === "caged" ? cagedShape(root, form) : undefined,
  );

  function mark(stringIndex: number, fret: number): FretMark {
    const note = noteAt(tuning, stringIndex, fret).replace(/-?\d+$/, "");
    if (mode === "noten") return { label: displayNote(note), state: "normal" };
    if (mode === "intervalle") {
      return { label: SHORT_INTERVALS[(noteToSemitone(note) - rootSemitone + 12) % 12]!, state: "normal" };
    }
    if (needsStandard) return { label: displayNote(note), state: "dim" };
    return scaleId ? scaleMarks(tuning, root, scaleId)(stringIndex, fret) : shapeMarks(stringIndex, fret);
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
            className={SELECT_CLASS}
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
            className={SELECT_CLASS}
          >
            <option value="noten">Notennamen</option>
            <option value="intervalle">Intervalle</option>
            <option value="tonleiter">Dur-Tonleiter</option>
            <option value="moll">Moll-Tonleiter</option>
            <option value="pentatonik">Moll-Pentatonik</option>
            <option value="box">Pentatonik-Box</option>
            <option value="caged">CAGED</option>
          </select>
        </label>

        {mode === "box" ? (
          <label className="text-sm">
            <span className="mr-2">Box</span>
            <select
              value={box}
              onChange={(e) => setBox(Number(e.target.value) as typeof box)}
              className={SELECT_CLASS}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {mode === "caged" ? (
          <label className="text-sm">
            <span className="mr-2">Form</span>
            <select value={form} onChange={(e) => setForm(e.target.value as CagedShape)} className={SELECT_CLASS}>
              {(["C", "A", "G", "E", "D"] as const).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="text-sm">
          <span className="mr-2">Grundton</span>
          <select
            value={root}
            onChange={(e) => setRoot(e.target.value)}
            className={SELECT_CLASS}
          >
            {NOTES.map((note) => (
              <option key={note} value={note}>
                {displayNote(note)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {needsStandard ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Boxen und CAGED gelten für die Standardstimmung.</p>
      ) : null}

      <FretboardGrid tuning={tuning} mark={mark} />

      {mode === "intervalle" ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Die Zahlen zählen vom Grundton {root} aus. 5 ist die {intervalName(7)}, 3 die {intervalName(4)}.
        </p>
      ) : null}
    </div>
  );
}
