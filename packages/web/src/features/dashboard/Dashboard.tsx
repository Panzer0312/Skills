import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/client.js";
import type { ReviewCard, StatsResponse } from "../../api/types.js";
import { getBrokenSkills, getSkills } from "../../skills/registry.js";
import { useSeedSync } from "../../skills/useSeedSync.js";

export function Dashboard() {
  const seed = useSeedSync();
  const skills = getSkills();
  const broken = getBrokenSkills();

  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.get<StatsResponse>("/api/stats"),
  });

  const queues = useQueries({
    queries: skills.map((skill) => ({
      queryKey: ["queue", skill.manifest.id, null],
      queryFn: () => api.get<{ cards: ReviewCard[] }>(`/api/queue?skillId=${skill.manifest.id}`),
      enabled: seed.status === "done",
    })),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Übersicht</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          {stats.data ? `Serie: ${stats.data.streak} Tage` : "Serie wird geladen…"}
        </p>
      </div>

      {seed.status === "error" ? (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Inhalte konnten nicht abgeglichen werden: {seed.error}
        </p>
      ) : null}

      {broken.length > 0 ? (
        <ul className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {broken.map((entry) => (
            <li key={entry.dir}>
              Lernbereich „{entry.dir}" wurde nicht geladen: {entry.error}
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {skills.map((skill, i) => {
          const due = queues[i]?.data?.cards.length ?? 0;
          return (
            <li key={skill.manifest.id}>
              <Link
                to={`/skill/${skill.manifest.id}`}
                className="block rounded-lg border border-slate-200 p-4 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{skill.manifest.name}</span>
                  <span className="text-sm text-slate-500">{due} fällig</span>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {skill.manifest.description}
                </p>
              </Link>
              {due > 0 ? (
                <Link
                  to={`/review?skillId=${skill.manifest.id}`}
                  className="mt-2 inline-block rounded bg-slate-900 px-3 py-1 text-sm text-white dark:bg-slate-100 dark:text-slate-900"
                >
                  Jetzt wiederholen
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
