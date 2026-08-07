import { readTuning, TUNINGS, type TuningReading } from "@skills/core";
import { useCallback, useState } from "react";
import { playReferenceTone } from "../../../packages/web/src/audio/referenceTone.js";
import { useMicrophone } from "../../../packages/web/src/audio/useMicrophone.js";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";

export default function Tuner(_: WidgetProps) {
  const [tuningName, setTuningName] = useState("Standard");
  const [reading, setReading] = useState<TuningReading | null>(null);
  const [minRms, setMinRms] = useState(0.01);

  const tuning = TUNINGS.find((t) => t.name === tuningName)!;

  const onBuffer = useCallback(
    (buffer: Float32Array, sampleRate: number) => {
      setReading(readTuning(buffer, sampleRate, tuning, { minRms }));
    },
    [tuning, minRms],
  );

  const mic = useMicrophone({ onBuffer });
  const inTune = reading !== null && Math.abs(reading.cents) <= 5;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Stimmgerät</h1>

      <label className="block text-sm">
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

      <ol className="flex justify-between text-sm">
        {tuning.strings.map((note, index) => (
          <li key={index}>
            <button
              type="button"
              aria-label={`${note} anspielen`}
              onClick={() => playReferenceTone(note)}
              className={`rounded px-2 py-1 ${
                reading?.targetString === index
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "hover:bg-slate-100 dark:hover:bg-slate-900"
              }`}
            >
              {note}
            </button>
          </li>
        ))}
      </ol>

      <label className="block text-sm">
        <span className="mr-2">Rauschschwelle</span>
        <input
          type="range"
          min={1}
          max={100}
          value={Math.round(minRms * 1000)}
          onChange={(e) => setMinRms(Number(e.target.value) / 1000)}
          aria-label="Rauschschwelle"
        />
        <span className="ml-2 text-slate-500">
          Höher stellen, wenn die Anzeige in einem lauten Raum zappelt.
        </span>
      </label>

      {mic.state === "running" ? (
        <div className="rounded-lg border border-slate-200 p-8 text-center dark:border-slate-800">
          {reading ? (
            <>
              <div className="text-5xl">{reading.note}</div>
              <div className={`mt-3 text-2xl ${inTune ? "text-emerald-600" : "text-amber-600"}`}>
                {reading.cents > 0 ? `+${reading.cents}` : reading.cents} Cent
              </div>
              <div className="mt-2 text-sm text-slate-500">
                {inTune ? "Stimmt." : reading.cents < 0 ? "Zu tief — spannen." : "Zu hoch — lockern."}
              </div>
              <div className="mt-4 h-2 w-full rounded bg-slate-200 dark:bg-slate-800">
                <div
                  className={`h-2 w-2 rounded ${inTune ? "bg-emerald-600" : "bg-amber-600"}`}
                  style={{ marginLeft: `${Math.min(100, Math.max(0, 50 + reading.cents / 2))}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-slate-500">Spiele eine Saite an.</p>
          )}
        </div>
      ) : null}

      {mic.error ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {mic.error}
        </p>
      ) : null}

      {mic.state === "running" ? (
        <button
          type="button"
          onClick={mic.stop}
          className="w-full rounded border border-slate-300 px-4 py-2 dark:border-slate-700"
        >
          Stimmgerät stoppen
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void mic.start()}
          className="w-full rounded bg-slate-900 px-4 py-2 text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Stimmgerät starten
        </button>
      )}
    </div>
  );
}
