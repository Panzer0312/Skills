import { parseKanaFile, type KanaEntry } from "@skills/core";
import { useCallback, useMemo, useState } from "react";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";

type Direction = "kana-to-romaji" | "romaji-to-kana";

function pick(entries: KanaEntry[], weight: (entry: KanaEntry) => number): KanaEntry {
  const total = entries.reduce((sum, entry) => sum + weight(entry), 0);
  let cursor = Math.random() * total;
  for (const entry of entries) {
    cursor -= weight(entry);
    if (cursor <= 0) return entry;
  }
  return entries[entries.length - 1]!;
}

export default function KanaDrill({ data, progress }: WidgetProps) {
  const entries = useMemo(
    () =>
      data.flatMap((file) => {
        const parsed = parseKanaFile(file, "kana");
        return parsed.ok ? parsed.file.entries : [];
      }),
    [data],
  );

  const weight = useCallback(
    (entry: KanaEntry) => (progress.get(entry.kana) === "wrong" ? 3 : 1),
    [progress],
  );

  const [direction, setDirection] = useState<Direction>("kana-to-romaji");
  const [current, setCurrent] = useState<KanaEntry>(() => pick(entries, weight));
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<"correct" | "wrong" | null>(null);

  if (entries.length === 0) {
    return <p className="text-red-600 dark:text-red-400">Keine Kana-Daten geladen.</p>;
  }

  const expected = direction === "kana-to-romaji" ? current.romaji : current.kana;
  const prompt = direction === "kana-to-romaji" ? current.kana : current.romaji;

  function check() {
    const correct = answer.trim().toLowerCase() === expected.toLowerCase();
    setVerdict(correct ? "correct" : "wrong");
    progress.record(current.kana, correct ? "correct" : "wrong");
  }

  function next() {
    setCurrent(pick(entries, weight));
    setAnswer("");
    setVerdict(null);
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="flex gap-2">
        {(
          [
            ["kana-to-romaji", "Zeichen → Laut"],
            ["romaji-to-kana", "Laut → Zeichen"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setDirection(value);
              next();
            }}
            className={`rounded border px-3 py-1 text-sm ${
              direction === value
                ? "border-slate-900 dark:border-slate-100"
                : "border-slate-300 dark:border-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 p-10 text-center dark:border-slate-800">
        <div data-testid="prompt" className="text-6xl">
          {prompt}
        </div>
      </div>

      <input
        type="text"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          if (verdict === null) check();
          else next();
        }}
        className="w-full rounded border border-slate-300 px-3 py-2 text-center text-lg dark:border-slate-700 dark:bg-slate-900"
        placeholder={direction === "kana-to-romaji" ? "Lesung eingeben" : "Zeichen eingeben"}
      />

      {verdict === null ? (
        <button
          type="button"
          onClick={check}
          className="w-full rounded bg-slate-900 px-4 py-2 text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Prüfen
        </button>
      ) : (
        <div className="space-y-3">
          <p className={verdict === "correct" ? "text-emerald-600" : "text-red-600"}>
            {verdict === "correct" ? "Richtig." : `Falsch — richtig wäre: ${expected}`}
          </p>
          {verdict === "wrong" ? (
            <p className="rounded bg-amber-50 p-3 text-sm dark:bg-amber-950">
              <strong>Merksatz: </strong>
              {current.merksatz}
            </p>
          ) : null}
          <button
            type="button"
            onClick={next}
            className="w-full rounded border border-slate-300 px-4 py-2 dark:border-slate-700"
          >
            Weiter
          </button>
        </div>
      )}
    </div>
  );
}
