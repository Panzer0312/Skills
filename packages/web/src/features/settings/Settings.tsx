import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../api/client.js";
import { useTheme } from "../../app/theme.js";

export function Settings() {
  const queryClient = useQueryClient();
  const { preference, setTheme } = useTheme();
  const [snapshot, setSnapshot] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ settings: Record<string, string> }>("/api/settings"),
  });

  const save = useMutation({
    mutationFn: (values: Record<string, string>) => api.put("/api/settings", values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  const makeSnapshot = useMutation({
    mutationFn: () => api.post<{ path: string }>("/api/backup/snapshot", {}),
    onSuccess: (result) => setSnapshot(result.path),
  });

  const current = settings.data?.settings ?? {};

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>

      <section className="space-y-3">
        <h2 className="font-medium">Tageslimits</h2>
        <label className="flex items-center justify-between gap-4">
          <span>Neue Karten pro Tag</span>
          <input
            type="number"
            min={0}
            defaultValue={current.dailyNew ?? "20"}
            onBlur={(e) => save.mutate({ dailyNew: e.target.value })}
            className="w-24 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>Wiederholungen pro Tag</span>
          <input
            type="number"
            min={0}
            defaultValue={current.dailyReviews ?? "200"}
            onBlur={(e) => save.mutate({ dailyReviews: e.target.value })}
            className="w-24 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Darstellung</h2>
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTheme(option)}
              className={`rounded border px-3 py-1 text-sm ${
                preference === option ? "border-slate-900 dark:border-slate-100" : "border-slate-300 dark:border-slate-700"
              }`}
            >
              {option === "light" ? "Hell" : option === "dark" ? "Dunkel" : "System"}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Sicherung</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => makeSnapshot.mutate()}
            className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
          >
            Sicherung anlegen
          </button>
          <a
            href="/api/backup/export"
            className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
          >
            Datenbank herunterladen
          </a>
        </div>
        {snapshot ? <p className="text-sm text-slate-500">Gesichert nach {snapshot}</p> : null}
        <p className="text-sm text-slate-500">
          Wiederherstellen: Server stoppen, <code>data/app.db</code> durch die Sicherung ersetzen, Server neu starten.
        </p>
      </section>
    </div>
  );
}
