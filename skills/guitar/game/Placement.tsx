import type { GameState } from "@skills/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../packages/web/src/api/client.js";
import { sortLessons, type LessonMeta } from "../../../packages/web/src/mdx/lessons.js";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";
import { DEFAULT_LEVEL, GAME_BASE, gameApi, gameContent, useGameState } from "./api.js";
import { ToolFrame } from "./Places.js";

const lessonMeta = import.meta.glob("../lessons/*.mdx", { eager: true, import: "meta" });
const lessons = sortLessons(Object.values(lessonMeta) as LessonMeta[]);

const KNOWN = new Set(["gelernt", "gemeistert"]);

interface SongOption {
  value: string;
  title: string;
}

function PlacementForm({ state, songs }: { state: GameState; songs: SongOption[] }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [known, setKnown] = useState(
    () => new Set(Object.entries(state.lessons).filter(([, status]) => KNOWN.has(status)).map(([id]) => id)),
  );
  const [levels, setLevels] = useState<Record<string, number>>(() =>
    Object.fromEntries(gameContent.techniques.map((t) => [t.id, state.levels[t.id] ?? DEFAULT_LEVEL])),
  );
  const [target, setTarget] = useState(
    () => state.targetSongId ?? songs.find((s) => /bard/i.test(s.title))?.value ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await gameApi.placement({
        knownLessonIds: lessons.filter((l) => known.has(l.id)).map((l) => l.id),
        levels,
        targetSongId: target === "" ? null : target,
      });
      navigate(`${GAME_BASE}/quests`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      setSaving(false);
    }
  }

  return (
    <ToolFrame title="Einstufung">
      <p className="mb-4 text-sm text-slate-500">Schritt {step + 1} von 3</p>
      {step === 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Was kannst du schon?</h2>
          <ul className="space-y-1">
            {lessons.map((lesson) => (
              <li key={lesson.id}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={known.has(lesson.id)}
                    onChange={(e) => {
                      const next = new Set(known);
                      if (e.target.checked) next.add(lesson.id);
                      else next.delete(lesson.id);
                      setKnown(next);
                    }}
                  />
                  {lesson.title}
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {step === 1 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Wie sicher fühlst du dich?</h2>
          <ul className="space-y-3">
            {gameContent.techniques.map((t) => (
              <li key={t.id} className="flex items-center gap-3">
                <label htmlFor={`level-${t.id}`} className="w-48">
                  {t.title}
                </label>
                <input
                  id={`level-${t.id}`}
                  type="range"
                  min={1}
                  max={10}
                  value={levels[t.id]}
                  onChange={(e) => setLevels({ ...levels, [t.id]: Number(e.target.value) })}
                />
                <output>{levels[t.id]}</output>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {step === 2 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Welchen Song willst du als Nächstes schaffen?</h2>
          <ul className="space-y-1">
            {[...songs, { value: "", title: "Noch keinen" }].map((song) => (
              <li key={song.value}>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="target-song"
                    value={song.value}
                    checked={target === song.value}
                    onChange={() => setTarget(song.value)}
                  />
                  {song.title}
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {error ? (
        <p role="alert" className="game-error mt-4">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex gap-3">
        {step > 0 ? (
          <button type="button" className="game-button" disabled={saving} onClick={() => setStep(step - 1)}>
            Zurück
          </button>
        ) : null}
        {step < 2 ? (
          <button type="button" className="game-button" onClick={() => setStep(step + 1)}>
            Weiter
          </button>
        ) : (
          <button type="button" className="game-button" disabled={saving} onClick={() => void finish()}>
            Fertig
          </button>
        )}
      </div>
    </ToolFrame>
  );
}

interface Uebungsstueck {
  id: string;
  titel: string;
}

export function Placement({ data }: Pick<WidgetProps, "data">) {
  const state = useGameState();
  const imported = useQuery({
    queryKey: ["songs"],
    queryFn: () => api.get<{ songs: { id: number; title: string }[] }>("/api/songs"),
  });
  if (state.isPending || imported.isPending) return <p className="game-note">Wird geladen…</p>;
  if (!state.data) return null;
  const songs: SongOption[] = [
    ...(imported.data?.songs ?? []).map((s) => ({ value: `db:${s.id}`, title: s.title })),
    ...(data.flat() as Uebungsstueck[])
      .filter((s) => s && typeof s.id === "string")
      .map((s) => ({ value: `uebung:${s.id}`, title: s.titel })),
  ];
  return <PlacementForm state={state.data} songs={songs} />;
}
