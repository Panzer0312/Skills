import type { RecentLogEntry } from "@skills/core";
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
  const { data } = useRecentLog();
  const entries = data?.entries ?? [];
  return (
    <section>
      <h2 className="mt-6 text-lg font-semibold">Letzte Einträge</h2>
      {entries.length === 0 ? (
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
                onClick={() => {
                  if (window.confirm("Diesen Eintrag löschen?")) void gameApi.deleteLog(entry.id);
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
