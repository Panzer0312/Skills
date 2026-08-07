import { kanjiEntrySchema, satzSchema, type KanjiEntry, type Satz } from "@skills/core";
import { useMemo, useState } from "react";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";

type Tab = "kanji" | "regeln" | "training";

interface Regel {
  Regel: string;
  Erklaerung: string;
  Merksatz: string;
  Beispiel: string;
}

function isRegel(entry: unknown): entry is Regel {
  return (
    typeof entry === "object" &&
    entry !== null &&
    !Array.isArray(entry) &&
    "Regel" in entry &&
    "Erklaerung" in entry &&
    "Merksatz" in entry &&
    "Beispiel" in entry
  );
}

/**
 * `ModuleRoute` flattens every array-shaped data file into individual entries
 * (needed so `ReferenceRenderer` gets flat table rows), so this widget receives
 * kanji, sentences and rules interleaved in a single list rather than as three
 * whole-file arrays. Each entry is matched against its shape to sort it back out.
 */
export default function ReadingTrainer({ data, progress }: WidgetProps) {
  const [tab, setTab] = useState<Tab>("kanji");

  const kanji = useMemo<KanjiEntry[]>(
    () => data.flatMap((entry) => (kanjiEntrySchema.safeParse(entry).success ? [entry as KanjiEntry] : [])),
    [data],
  );

  const saetze = useMemo<Satz[]>(
    () => data.flatMap((entry) => (satzSchema.safeParse(entry).success ? [entry as Satz] : [])),
    [data],
  );

  const regeln = useMemo<Regel[]>(() => data.filter(isRegel), [data]);

  return (
    <div className="space-y-6">
      <div role="tablist" className="flex gap-2">
        {(
          [
            ["kanji", "Kanji"],
            ["regeln", "Regeln"],
            ["training", "Lesetraining"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded border px-3 py-1 text-sm ${
              tab === value ? "border-slate-900 dark:border-slate-100" : "border-slate-300 dark:border-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "kanji" ? <KanjiList entries={kanji} /> : null}
      {tab === "regeln" ? <RuleList regeln={regeln} /> : null}
      {tab === "training" ? <Training saetze={saetze} progress={progress} /> : null}
    </div>
  );
}

function KanjiList({ entries }: { entries: KanjiEntry[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {entries.map((entry) => (
        <li key={entry.kanji} className="rounded border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl">{entry.kanji}</span>
            <span>{entry.bedeutung}</span>
            <span className="ml-auto text-xs text-slate-500">{entry.strokes} Striche</span>
          </div>
          <dl className="mt-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-slate-500">on:</dt>
              <dd>{entry.on.join("、") || "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-slate-500">kun:</dt>
              <dd>{entry.kun.join("、") || "—"}</dd>
            </div>
          </dl>
          <p className="mt-2 rounded bg-amber-50 p-2 text-sm dark:bg-amber-950">{entry.merksatz}</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
            {entry.beispiele.map((b) => (
              <li key={b.wort}>
                {b.wort} ({b.lesung}) — {b.bedeutung} <span className="text-xs">[{b.lesungsart}]</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function RuleList({ regeln }: { regeln: Regel[] }) {
  return (
    <ul className="space-y-3">
      {regeln.map((regel) => (
        <li key={regel.Regel} className="rounded border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="font-medium">{regel.Regel}</h3>
          <p className="mt-1 text-sm">{regel.Erklaerung}</p>
          <p className="mt-2 rounded bg-amber-50 p-2 text-sm dark:bg-amber-950">
            <strong>Merksatz: </strong>
            {regel.Merksatz}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{regel.Beispiel}</p>
        </li>
      ))}
    </ul>
  );
}

function Training({ saetze, progress }: { saetze: Satz[]; progress: WidgetProps["progress"] }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [openToken, setOpenToken] = useState<number | null>(null);

  const satz = saetze[index];
  if (!satz) return <p className="text-slate-600 dark:text-slate-400">Keine Sätze vorhanden.</p>;

  function assess(result: "correct" | "wrong") {
    progress.record(satz!.id, result);
    setRevealed(false);
    setOpenToken(null);
    setIndex((i) => (i + 1) % saetze.length);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Stufe: {satz.stufe} — Satz {index + 1} von {saetze.length}
      </p>

      <div className="rounded-lg border border-slate-200 p-8 dark:border-slate-800">
        <div className="flex flex-wrap items-end gap-x-1 gap-y-4 text-3xl leading-relaxed">
          {satz.tokens.map((token, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setOpenToken(openToken === i ? null : i)}
              className="relative rounded px-0.5 hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              {(revealed || openToken === i) && token.lesung && token.lesung !== token.text ? (
                <span className="absolute -top-4 left-0 right-0 text-center text-xs text-slate-500">
                  {token.lesung}
                </span>
              ) : null}
              {token.text}
            </button>
          ))}
        </div>

        {openToken !== null && satz.tokens[openToken] ? (
          <div className="mt-6 rounded bg-slate-100 p-3 text-sm dark:bg-slate-900">
            <div>
              <strong>{satz.tokens[openToken]!.text}</strong> — {satz.tokens[openToken]!.lesung}
            </div>
            {satz.tokens[openToken]!.bedeutung ? <div>{satz.tokens[openToken]!.bedeutung}</div> : null}
            {satz.tokens[openToken]!.begruendung ? (
              <div className="mt-1 text-slate-600 dark:text-slate-400">
                {satz.tokens[openToken]!.begruendung}
              </div>
            ) : null}
          </div>
        ) : null}

        {revealed ? <p className="mt-6 text-lg">{satz.uebersetzung}</p> : null}
      </div>

      {revealed ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => assess("correct")}
            className="flex-1 rounded border border-slate-300 px-4 py-2 dark:border-slate-700"
          >
            Konnte ich lesen
          </button>
          <button
            type="button"
            onClick={() => assess("wrong")}
            className="flex-1 rounded border border-slate-300 px-4 py-2 dark:border-slate-700"
          >
            Noch nicht
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="w-full rounded bg-slate-900 px-4 py-2 text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Aufdecken
        </button>
      )}
    </div>
  );
}
