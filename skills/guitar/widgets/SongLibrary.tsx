import { parseSong, type Song, type SongMeta } from "@skills/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { gameApi, gameContent, SONG_META_KEY } from "../game/api.js";
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

const NO_TAGS: string[] = [];
const ZERO: SongMeta = { stars: 0, lastPlayedAt: null, tags: NO_TAGS };

/** "heute", "gestern" or "vor N Tagen" by local calendar day, nothing for a song never played. */
export function lastPlayedLabel(at: number | null | undefined, now = Date.now()): string | null {
  if (at == null) return null;
  const midnight = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.max(0, Math.round((midnight(now) - midnight(at)) / 86_400_000));
  if (days === 0) return "Zuletzt gespielt: heute";
  if (days === 1) return "Zuletzt gespielt: gestern";
  return `Zuletzt gespielt: vor ${days} Tagen`;
}

function Stars({ stars }: { stars: number }) {
  return (
    <span role="img" aria-label={`${stars} von 5 Sternen`} className="text-amber-600 dark:text-amber-400">
      {"★".repeat(stars)}
      {"☆".repeat(5 - stars)}
    </span>
  );
}

function CardMeta({ meta }: { meta: SongMeta | undefined }) {
  if (!meta) return null;
  const played = lastPlayedLabel(meta.lastPlayedAt);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-slate-600 dark:text-slate-400">
      <Stars stars={meta.stars} />
      {played ? <span>{played}</span> : null}
    </div>
  );
}

/** Stars and technique tags of the open song. Lives here so SongView stays free of game calls. */
function SongTools({ songKey, meta }: { songKey: string; meta: SongMeta | undefined }) {
  const [error, setError] = useState<string | null>(null);
  const stars = meta?.stars ?? 0;
  const tags = meta?.tags ?? NO_TAGS;

  const write = async (patch: { stars?: number; tags?: string[] }) => {
    setError(null);
    try {
      await gameApi.setSongMeta(songKey, patch);
    } catch {
      setError("Die Änderung wurde nicht gespeichert. Bitte versuche es noch einmal.");
    }
  };

  return (
    <div className="mb-4 space-y-3 rounded border border-slate-200 p-3 dark:border-slate-800">
      <div role="group" aria-label="Beherrschung" className="flex items-center gap-1">
        <span className="mr-2 text-sm">Beherrschung</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} ${n === 1 ? "Stern" : "Sterne"}`}
            aria-pressed={n === stars}
            onClick={() => void write({ stars: n === stars ? 0 : n })}
            className="px-1 text-xl text-amber-600 dark:text-amber-400"
          >
            {n <= stars ? "★" : "☆"}
          </button>
        ))}
      </div>
      <details>
        <summary className="cursor-pointer text-sm">Techniken</summary>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {gameContent.techniques.map((t) => (
            <label key={t.id} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={tags.includes(t.id)}
                onChange={(e) =>
                  void write({ tags: e.target.checked ? [...tags, t.id] : tags.filter((x) => x !== t.id) })
                }
              />
              {t.title}
            </label>
          ))}
        </div>
      </details>
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function SongLibrary({ data }: WidgetProps) {
  const shipped = (data.flat() as Uebungsstueck[]).filter((s) => s && typeof s.id === "string");
  const [level, setLevel] = useState<number | null>(null);
  const [open, setOpen] = useState<{ song: Song; key: string } | null>(null);
  const [technique, setTechnique] = useState("");

  const metaQuery = useQuery({ queryKey: SONG_META_KEY, queryFn: gameApi.songMeta });
  const metas = metaQuery.data?.songs;

  const openSong = (song: Song, key: string) => {
    setOpen({ song, key });
    // Playing is self-reported by opening; a failed write must not block the song.
    gameApi.setSongMeta(key, { played: true }).catch(() => undefined);
  };
  const matches = (key: string) => technique === "" || (metas?.[key]?.tags ?? NO_TAGS).includes(technique);

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
        <SongTools songKey={open.key} meta={metas?.[open.key]} />
        <SongView song={open.song} songKey={open.key} />
      </div>
    );
  }

  const visible = (level === null ? shipped : shipped.filter((s) => s.stufe === level)).filter((s) =>
    matches(`uebung:${s.id}`),
  );

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
        <label className="ml-auto flex items-center gap-2">
          Technik
          <select
            value={technique}
            onChange={(e) => setTechnique(e.target.value)}
            className="rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
          >
            <option value="">Alle Techniken</option>
            {gameContent.techniques.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section>
        <h2 className="mb-2 font-medium">Übungsstücke</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((stueck) => (
            <li key={stueck.id}>
              <button
                type="button"
                onClick={() => openSong(parseSong(stueck.quelle), `uebung:${stueck.id}`)}
                className="w-full rounded border border-slate-200 p-4 text-left hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
              >
                <div className="font-medium">{stueck.titel}</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {LEVEL_LABELS[stueck.stufe]} · {stueck.bpm} BPM · {stueck.benoetigteAkkorde.join(" ")}
                </div>
                <CardMeta meta={metas?.[`uebung:${stueck.id}`] ?? (metas ? ZERO : undefined)} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Eigene Songs</h2>
        {imported.data && imported.data.songs.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {imported.data.songs.filter((song) => matches(`song:${song.id}`)).map((song) => (
              <li key={song.id}>
                <button
                  type="button"
                  onClick={() => openSong(parseSong(song.content), `song:${song.id}`)}
                  className="w-full rounded border border-slate-200 p-4 text-left hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
                >
                  <div className="font-medium">{song.title}</div>
                  {song.artist ? (
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{song.artist}</div>
                  ) : null}
                  <CardMeta meta={metas?.[`song:${song.id}`] ?? (metas ? ZERO : undefined)} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Noch keine eigenen Songs. Füge welche über „Song hinzufügen" ein.
          </p>
        )}
      </section>
    </div>
  );
}
