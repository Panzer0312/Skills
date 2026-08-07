import { parseSong, type Song } from "@skills/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../../packages/web/src/api/client.js";
import { SongView } from "../../../packages/web/src/features/songs/SongView.js";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";

interface Uebungsstueck {
  id: string;
  titel: string;
  stufe: number;
  benoetigteAkkorde: string[];
  bpm: number;
  quelle: string;
}

interface StoredSong {
  id: number;
  title: string;
  artist: string | null;
  content: string;
  difficulty: number | null;
}

const LEVEL_LABELS: Record<number, string> = {
  1: "Zwei Akkorde",
  2: "Vier Akkorde",
  3: "Power Chords",
  4: "Mit Barré",
};

export default function SongLibrary({ data }: WidgetProps) {
  const shipped = (data.flat() as Uebungsstueck[]).filter((s) => s && typeof s.id === "string");
  const [level, setLevel] = useState<number | null>(null);
  const [open, setOpen] = useState<Song | null>(null);

  const imported = useQuery({
    queryKey: ["songs"],
    queryFn: () => api.get<{ songs: StoredSong[] }>("/api/songs"),
  });

  if (open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(null)} className="mb-4 text-sm text-slate-500">
          ← Zurück zur Bibliothek
        </button>
        <SongView song={open} />
      </div>
    );
  }

  const visible = level === null ? shipped : shipped.filter((s) => s.stufe === level);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Songs</h1>

      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={() => setLevel(null)}
          className={`rounded border px-3 py-1 ${level === null ? "border-slate-900 dark:border-slate-100" : "border-slate-300 dark:border-slate-700"}`}
        >
          Alle
        </button>
        {[1, 2, 3, 4].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setLevel(value)}
            className={`rounded border px-3 py-1 ${level === value ? "border-slate-900 dark:border-slate-100" : "border-slate-300 dark:border-slate-700"}`}
          >
            {LEVEL_LABELS[value]}
          </button>
        ))}
      </div>

      <section>
        <h2 className="mb-2 font-medium">Übungsstücke</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((stueck) => (
            <li key={stueck.id}>
              <button
                type="button"
                onClick={() => setOpen(parseSong(stueck.quelle))}
                className="w-full rounded border border-slate-200 p-4 text-left hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
              >
                <div className="font-medium">{stueck.titel}</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {LEVEL_LABELS[stueck.stufe]} · {stueck.bpm} BPM · {stueck.benoetigteAkkorde.join(" ")}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Eigene Songs</h2>
        {imported.data && imported.data.songs.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {imported.data.songs.map((song) => (
              <li key={song.id}>
                <button
                  type="button"
                  onClick={() => setOpen(parseSong(song.content))}
                  className="w-full rounded border border-slate-200 p-4 text-left hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
                >
                  <div className="font-medium">{song.title}</div>
                  {song.artist ? (
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{song.artist}</div>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Noch keine eigenen Songs. Füge welche über „Song hinzufügen" in der Seitenleiste ein.
          </p>
        )}
      </section>
    </div>
  );
}
