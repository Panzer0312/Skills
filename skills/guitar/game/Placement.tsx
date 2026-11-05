import type { GameState, MapNode } from "@skills/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../packages/web/src/api/client.js";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";
import { DEFAULT_LEVEL, GAME_BASE, gameApi, gameContent, useGameState } from "./api.js";
import { ToolFrame } from "./Places.js";

/** Road order first, nodes the road does not name after it. */
function roadOrder(nodes: MapNode[]): MapNode[] {
  const rank = (node: MapNode) => {
    const at = gameContent.road.findIndex((step) => step.lessonId === node.id);
    return at === -1 ? gameContent.road.length : at;
  };
  return [...nodes].sort((a, b) => rank(a) - rank(b));
}

const available = gameContent.nodes.filter((node) => node.available);
const KNOWN_SONGS = gameContent.nodes.filter((node) => node.knownSong);
const ROAD_NODES = roadOrder(available.filter((node) => !node.knownSong && !node.quick));
const QUICK_NODES = available.filter((node) => node.quick && !node.knownSong);
const LISTED = [...ROAD_NODES, ...KNOWN_SONGS, ...QUICK_NODES];

const KNOWN = new Set(["gelernt", "gemeistert"]);

interface SongOption {
  value: string;
  title: string;
}

function NodeChecklist({
  nodes,
  known,
  setKnown,
}: {
  nodes: MapNode[];
  known: Set<string>;
  setKnown: (next: Set<string>) => void;
}) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => (
        <li key={node.id}>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={known.has(node.id)}
              onChange={(e) => {
                const next = new Set(known);
                if (e.target.checked) next.add(node.id);
                else next.delete(node.id);
                setKnown(next);
              }}
            />
            {node.title}
          </label>
        </li>
      ))}
    </ul>
  );
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
        knownLessonIds: LISTED.filter((node) => known.has(node.id)).map((node) => node.id),
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
          <p className="mb-3 text-sm">Hake „Akkordwechsel“ nur an, wenn deine Wechsel schon flüssig laufen.</p>
          <NodeChecklist nodes={ROAD_NODES} known={known} setKnown={setKnown} />
          {KNOWN_SONGS.length > 0 ? (
            <>
              <h3 className="mb-2 mt-4 font-semibold">Songs, die du schon spielst</h3>
              <NodeChecklist nodes={KNOWN_SONGS} known={known} setKnown={setKnown} />
            </>
          ) : null}
          {QUICK_NODES.length > 0 ? (
            <>
              <h3 className="mb-2 mt-4 font-semibold">Schnelle Erfolge</h3>
              <NodeChecklist nodes={QUICK_NODES} known={known} setKnown={setKnown} />
            </>
          ) : null}
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
