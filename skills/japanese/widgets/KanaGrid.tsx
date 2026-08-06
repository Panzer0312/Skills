import { useState } from "react";
import { parseKanaFile, type KanaEntry } from "@skills/core";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";

export default function KanaGrid({ data }: WidgetProps) {
  const [selected, setSelected] = useState<KanaEntry | null>(null);

  const entries: KanaEntry[] = data.flatMap((file) => {
    const parsed = parseKanaFile(file, "kana");
    return parsed.ok ? parsed.file.entries : [];
  });

  if (entries.length === 0) {
    return <p className="text-red-600 dark:text-red-400">Die Kana-Datei konnte nicht gelesen werden.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {entries.map((entry) => (
          <button
            key={entry.kana}
            type="button"
            onClick={() => setSelected(entry)}
            className={`rounded border p-3 text-center hover:border-slate-500 ${
              selected?.kana === entry.kana
                ? "border-slate-900 dark:border-slate-100"
                : "border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="text-2xl">{entry.kana}</div>
            <div className="text-xs text-slate-500">{entry.romaji}</div>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
          <div className="flex items-baseline gap-4">
            <span className="text-5xl">{selected.kana}</span>
            <span className="text-xl text-slate-500">{selected.romaji}</span>
            <span className="text-sm text-slate-500">{selected.strokes} Striche</span>
          </div>
          <p className="mt-4 rounded bg-amber-50 p-3 text-sm dark:bg-amber-950">
            <strong>Merksatz: </strong>
            {selected.merksatz}
          </p>
          <p className="mt-3 text-sm">
            <strong>Beispiel: </strong>
            {selected.beispiel.wort} ({selected.beispiel.lesung}) — {selected.beispiel.bedeutung}
          </p>
          {selected.verwechslung.length > 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Leicht zu verwechseln mit: {selected.verwechslung.join(", ")}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Zeichen anklicken für Merksatz und Beispiel.</p>
      )}
    </div>
  );
}
