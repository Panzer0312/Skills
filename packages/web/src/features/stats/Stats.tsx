import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import type { StatsResponse } from "../../api/types.js";
import { Heatmap } from "./Heatmap.js";

const STATE_LABELS: Record<string, string> = {
  new: "Neu",
  learning: "Im Lernen",
  review: "Wiederholung",
  relearning: "Erneut lernen",
};

export function Stats() {
  const query = useQuery({ queryKey: ["stats"], queryFn: () => api.get<StatsResponse>("/api/stats") });

  if (query.isPending) return <p>Wird geladen…</p>;
  if (query.isError) return <p className="text-red-600 dark:text-red-400">Statistik nicht verfügbar.</p>;

  const stats = query.data;
  const maxForecast = Math.max(1, ...stats.forecast.map((d) => d.count));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Statistik</h1>

      <section className="space-y-2">
        <h2 className="font-medium">Aktivität</h2>
        <Heatmap days={stats.heatmap} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-slate-200 p-4 dark:border-slate-800">
          <div className="text-sm text-slate-500">Behaltensrate</div>
          <div className="text-2xl">{Math.round(stats.retention * 100)} %</div>
        </div>
        <div className="rounded border border-slate-200 p-4 dark:border-slate-800">
          <div className="text-sm text-slate-500">Serie</div>
          <div className="text-2xl">{stats.streak} Tage</div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Kartenzustände</h2>
        <ul className="flex flex-wrap gap-4 text-sm">
          {Object.entries(stats.states).map(([state, count]) => (
            <li key={state}>
              <span className="text-slate-500">{STATE_LABELS[state] ?? state}: </span>
              {count}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Nächste 30 Tage</h2>
        <div className="flex h-32 items-end gap-1">
          {stats.forecast.map((entry) => (
            <div
              key={entry.day}
              title={`${entry.day}: ${entry.count}`}
              className="flex-1 rounded-t bg-slate-400 dark:bg-slate-600"
              style={{ height: `${(entry.count / maxForecast) * 100}%` }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
