import { OPEN_CHORDS } from "@skills/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "../../../packages/web/src/api/client.js";
import type { ChordOverrideEntry } from "../../../packages/web/src/music/chordOverrides.js";
import { ChordDiagramSingle } from "../../../packages/web/src/music/ChordDiagramSingle.js";
import { ChordEditor } from "../../../packages/web/src/music/ChordEditor.js";
import { useChordOverrides } from "../../../packages/web/src/music/useChordOverrides.js";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";

interface StoredSong {
  id: number;
  title: string;
}

interface Uebungsstueck {
  id: string;
  titel: string;
}

const REMOVE_FALLBACK_ERROR = "Der Eintrag konnte nicht gelöscht werden. Bitte später erneut versuchen.";
const SAVE_FALLBACK_ERROR = "Der Griff konnte nicht gespeichert werden. Bitte später erneut versuchen.";

function scopeLabel(entry: ChordOverrideEntry, shipped: Uebungsstueck[], songs: StoredSong[]) {
  if (entry.scope === "global") return "Alle Songs";
  const key = entry.songKey;
  if (key.startsWith("uebung:")) {
    const id = key.slice("uebung:".length);
    const song = shipped.find((s) => s.id === id);
    return song ? `Nur „${song.titel}"` : `Nur ${key}`;
  }
  if (key.startsWith("song:")) {
    const id = Number(key.slice("song:".length));
    const song = songs.find((s) => s.id === id);
    return song ? `Nur „${song.title}"` : `Nur ${key}`;
  }
  return `Nur ${key}`;
}

function OwnShapes({ shipped }: { shipped: Uebungsstueck[] }) {
  const client = useQueryClient();
  const [editing, setEditing] = useState<{ symbol: string; entry: ChordOverrideEntry | null } | null>(null);
  const [newSymbol, setNewSymbol] = useState("");
  const [error, setError] = useState<string | null>(null);

  const overrides = useQuery({
    queryKey: ["chords", "all"],
    queryFn: () => api.get<{ entries: ChordOverrideEntry[] }>("/api/chords?all=1"),
  });
  const songs = useQuery({
    queryKey: ["songs"],
    queryFn: () => api.get<{ songs: StoredSong[] }>("/api/songs"),
  });

  const entries = overrides.data?.entries ?? [];

  async function remove(entry: ChordOverrideEntry) {
    const params = new URLSearchParams({ scope: entry.scope, symbol: entry.symbol });
    if (entry.scope === "song") params.set("songKey", entry.songKey);
    try {
      await api.del(`/api/chords?${params.toString()}`);
      setError(null);
      await client.invalidateQueries({ queryKey: ["chords"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : REMOVE_FALLBACK_ERROR);
    }
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <ChordEditor
          symbol={editing.symbol}
          initial={
            editing.entry
              ? {
                  name: editing.entry.name ?? editing.entry.symbol,
                  frets: editing.entry.frets,
                  fingers: editing.entry.fingers,
                  baseFret: editing.entry.baseFret,
                }
              : null
          }
          allowSongScope={false}
          onSave={async (shape) => {
            try {
              await api.put("/api/chords", {
                scope: "global",
                symbol: editing.symbol,
                name: shape.name || undefined,
                frets: shape.frets,
                fingers: shape.fingers,
                baseFret: shape.baseFret,
              });
              setError(null);
              await client.invalidateQueries({ queryKey: ["chords"] });
              setEditing(null);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : SAVE_FALLBACK_ERROR);
            }
          }}
          onCancel={() => {
            setError(null);
            setEditing(null);
          }}
        />
        {error ? (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col">
          <span>Neuer Akkord</span>
          <input
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            placeholder="z. B. Dsus4"
            className="mt-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <button
          type="button"
          disabled={newSymbol.trim() === ""}
          onClick={() => setEditing({ symbol: newSymbol.trim(), entry: null })}
          className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50 dark:border-slate-700"
        >
          Anlegen
        </button>
      </div>

      {error ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {error}
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Noch keine eigenen Griffe. Lege hier einen an oder bearbeite ein Griffbild direkt in einem Song.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 p-3 text-sm dark:border-slate-800"
            >
              <span>
                <span className="font-medium">{entry.name ?? entry.symbol}</span>
                <span className="ml-2 text-slate-500">{scopeLabel(entry, shipped, songs.data?.songs ?? [])}</span>
              </span>
              <span className="flex gap-2">
                {entry.scope === "global" ? (
                  <button
                    type="button"
                    onClick={() => setEditing({ symbol: entry.symbol, entry })}
                    className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
                  >
                    Bearbeiten
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => remove(entry)}
                  className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
                >
                  Löschen
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ChordDiagram({ data }: WidgetProps) {
  const [tab, setTab] = useState<"offen" | "eigene">("offen");
  const shipped = (data.flat() as Uebungsstueck[]).filter((s) => s && typeof s.id === "string");
  // Without a song key the hook loads exactly the globally saved shapes, so a griff the
  // user stored for all songs shows here too — the precedence documented in
  // `docs/skills-authoring.md`. Song-scoped shapes stay out: this tab belongs to no song.
  const { overrides } = useChordOverrides();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Akkordgriffe</h1>

      <div className="flex gap-2 text-sm">
        {(["offen", "eigene"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded border px-3 py-1 ${
              tab === value ? "border-slate-900 dark:border-slate-100" : "border-slate-300 dark:border-slate-700"
            }`}
          >
            {value === "offen" ? "Offene Akkorde" : "Eigene Griffe"}
          </button>
        ))}
      </div>

      {tab === "offen" ? (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Von links nach rechts: tiefe E-Saite bis hohe E-Saite. x heißt nicht anschlagen, 0 heißt
            leer spielen. Die Zahl im Punkt ist der Finger: 1 Zeigefinger, 4 kleiner Finger.
          </p>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Object.keys(OPEN_CHORDS).map((name) => (
              <ChordDiagramSingle key={name} name={name} overrides={{ global: overrides.global }} />
            ))}
          </div>
        </>
      ) : (
        <OwnShapes shipped={shipped} />
      )}
    </div>
  );
}
