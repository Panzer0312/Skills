import type { RecentLogEntry } from "@skills/core";
import { useState } from "react";
import { gameApi, gameContent, useRecentLog } from "../api.js";

const FREE_LABELS: Record<string, string> = {
  song: "Song (frei)",
  "frei-technik": "Technik (frei)",
  jam: "Jam Room",
  akkordwechsel: "Akkordwechsel-Trainer",
  theorie: "Noten finden",
};

function entryLabel(entry: RecentLogEntry): string {
  if (entry.kind === "quest") {
    return gameContent.quests.find((q) => q.id === entry.questId)?.title ?? entry.questId ?? "Quest";
  }
  return FREE_LABELS[entry.techniqueId ?? ""] ?? "Freies Üben";
}

const date = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(2, 4)}`;

export function RecentLog() {
  const recent = useRecentLog();
  const [pending, setPending] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const entries = recent.data?.entries ?? [];

  async function remove(id: number) {
    setFailed(false);
    setPending(id);
    try {
      await gameApi.deleteLog(id);
    } catch {
      setFailed(true);
    } finally {
      setPending(null);
    }
  }
  return (
    <section>
      <h2 className="mt-6 text-lg font-semibold">Letzte Einträge</h2>
      {failed ? <p role="alert">Der Eintrag konnte nicht gelöscht werden.</p> : null}
      {recent.isPending ? (
        <p role="status">Wird geladen …</p>
      ) : recent.isError ? (
        <div role="alert">
          <p>Die letzten Einträge konnten nicht geladen werden.</p>
          <button type="button" className="underline" onClick={() => void recent.refetch()}>
            Erneut versuchen
          </button>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">Noch keine Einträge.</p>
      ) : (
        <ul>
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-x-4">
              <span>
                {date(entry.day)} · {entryLabel(entry)} · {Math.round(entry.seconds / 60)} min
                {entry.metricValue != null ? ` · ${entry.metricValue}` : ""}
              </span>
              <button
                type="button"
                className="underline"
                disabled={pending === entry.id}
                onClick={() => {
                  if (window.confirm("Diesen Eintrag löschen?")) void remove(entry.id);
                }}
              >
                Löschen
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
