import { relations, type GameState, type MapNode, type MapPath, type RoadStep } from "@skills/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../../../packages/web/src/api/client.js";
import { DEFAULT_LEVEL, GAME_BASE, gameApi, isDone, normalizeTitle } from "../api.js";

const LEVEL_SAVE_DELAY = 300;

function NodeList({
  title,
  nodes,
  onSelect,
}: {
  title: string;
  nodes: MapNode[];
  onSelect: (id: string) => void;
}) {
  if (nodes.length === 0) return null;
  return (
    <div className="lesson-block">
      <h3>{title}</h3>
      <ul>
        {nodes.map((node) => (
          <li key={node.id}>
            <button type="button" className="map-text-button" onClick={() => onSelect(node.id)}>
              {node.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LevelSlider({ saved, onChange }: { saved: number; onChange: (level: number) => Promise<boolean> }) {
  const [level, setLevel] = useState(saved);
  const id = useId();
  const latest = useRef({ saved, onChange });
  latest.current = { saved, onChange };
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  function flush() {
    clearTimeout(timer.current);
    const next = pending.current;
    if (next === null) return;
    pending.current = null;
    void latest.current.onChange(next).then((ok) => {
      if (!ok) setLevel(latest.current.saved);
    });
  }

  // Selecting another node unmounts the slider, and that step must not get lost.
  useEffect(() => flush, []);

  function change(next: number) {
    setLevel(next);
    pending.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, LEVEL_SAVE_DELAY);
  }

  return (
    <div className="lesson-level">
      <label htmlFor={id}>Deine Stufe</label>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        value={level}
        onChange={(event) => change(Number(event.target.value))}
      />
      <output htmlFor={id}>{level}</output>
    </div>
  );
}

function TargetSong({
  song,
  targetSongId,
  busy,
  onSet,
  heading = true,
}: {
  song: NonNullable<MapNode["targetSong"]>;
  targetSongId: string | null;
  busy: boolean;
  onSet: (id: string) => void;
  /** Off where a list of songs already sits under one heading. */
  heading?: boolean;
}) {
  const imported = useQuery({
    queryKey: ["songs"],
    queryFn: () => api.get<{ songs: { id: number; title: string }[] }>("/api/songs"),
  });
  if (imported.isPending) return null;
  if (!imported.data) {
    return (
      <p role="alert" className="game-error">
        Deine Songs konnten nicht geladen werden.
      </p>
    );
  }
  const wanted = normalizeTitle(song.title);
  const ids = imported.data.songs
    .filter((entry) => normalizeTitle(entry.title) === wanted)
    .map((entry) => `db:${entry.id}`);
  const first = ids[0];
  return (
    <div className={heading ? "lesson-block" : "lesson-song"}>
      {heading ? <h3>Zielsong</h3> : null}
      <p>
        {song.title} · {song.artist}
      </p>
      {targetSongId !== null && ids.includes(targetSongId) ? (
        <p className="lesson-tag">Ist dein Zielsong</p>
      ) : first !== undefined ? (
        <button type="button" className="game-button" disabled={busy} onClick={() => onSet(first)}>
          Als Zielsong setzen
        </button>
      ) : (
        <Link to="/songs/neu" className="map-text-button">
          Importiere den Song, die Übungen funktionieren auch ohne
        </Link>
      )}
    </div>
  );
}

function PauseDialog({
  chosen,
  busy,
  error,
  onPick,
  onCancel,
}: {
  chosen: { id: string; title: string }[];
  busy: boolean;
  error: string | null;
  onPick: (id: string) => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  return (
    <div className="map-dialog-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="game-panel map-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <h2 id={titleId}>Welche Lektion pausierst du?</h2>
        <ul>
          {chosen.map(({ id, title }) => (
            <li key={id}>
              <button type="button" className="game-button" disabled={busy} onClick={() => onPick(id)}>
                {title}
              </button>
            </li>
          ))}
        </ul>
        {error ? (
          <p role="alert" className="game-error">
            {error}
          </p>
        ) : null}
        <button type="button" className="game-button" autoFocus onClick={onCancel}>
          Abbrechen
        </button>
      </section>
    </div>
  );
}

export function LessonPanel({
  node,
  nodes,
  paths,
  state,
  best,
  onSelect,
}: {
  node: MapNode;
  nodes: MapNode[];
  paths: MapPath[];
  state: GameState;
  best: RoadStep | null;
  onSelect: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const navigate = useNavigate();

  async function run(write: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await write();
      setAsking(false);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.code === "limit") setAsking(true);
      else setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const { buildsOn, unlocks, linked } = relations(nodes, node.id);
  const status = state.lessons[node.id];
  const chosen = state.chosenLessons.includes(node.id);
  const isBest = best?.lessonId === node.id;
  const mainRoad = best?.lessonId;
  const actionable = node.available && !node.knownSong;
  const region = paths.find((path) => path.id === node.path);
  // An unwritten parent cannot be finished, so it must not hold a note open.
  const missingBasics =
    node.quick || node.knownSong
      ? []
      : buildsOn.filter((parent) => parent.available && !isDone(state.lessons[parent.id]));

  /** Without a set for today the next build includes the best next quest anyway. */
  async function startBest(event: MouseEvent, questId: string) {
    const today = state.today;
    if (!today || today.questIds.includes(questId)) return;
    event.preventDefault();
    if (busy) return;
    if (await run(() => gameApi.setToday(today.minutes, [...today.questIds, questId]))) {
      navigate(`${GAME_BASE}/quest/${questId}`);
    }
  }

  return (
    <section className="lesson-panel game-panel" aria-label="Lektion">
      <h2>{node.title}</h2>
      <p className="lesson-meta">
        {region?.title} · Schwierigkeit {node.rank} von 10
      </p>
      <p>{node.description}</p>

      {node.quick && status === "gelernt" ? (
        <p className="lesson-note">Schneller Erfolg geschafft. Komm zurück und verfeinere ihn.</p>
      ) : null}

      {node.knownSong ? (
        <p className="lesson-tag">Bekannter Song</p>
      ) : !node.available ? (
        <p className="lesson-tag">In Vorbereitung</p>
      ) : (
        <div className="lesson-actions">
          <Link to={`${GAME_BASE}/bibliothek/${node.id}`} className="game-button">
            Lektion öffnen
          </Link>
          {isBest ? <span className="lesson-tag">Hauptweg</span> : null}
          {best?.questId && isBest ? (
            <Link
              to={`${GAME_BASE}/quest/${best.questId}`}
              className="game-button"
              onClick={(event) => void startBest(event, best.questId!)}
            >
              Quest starten
            </Link>
          ) : null}
          {chosen ? (
            <button
              type="button"
              className="game-button"
              disabled={busy}
              onClick={() => void run(() => gameApi.pauseLesson(node.id))}
            >
              Pausieren
            </button>
          ) : isBest || isDone(status) ? null : (
            <button
              type="button"
              className="game-button"
              disabled={busy}
              onClick={() => void run(() => gameApi.chooseLesson(node.id, undefined, mainRoad))}
            >
              Als Quest annehmen
            </button>
          )}
        </div>
      )}

      {error && !asking ? (
        <p role="alert" className="game-error">
          {error}
        </p>
      ) : null}

      {actionable && node.techniqueId ? (
        <LevelSlider
          saved={state.levels[node.techniqueId] ?? DEFAULT_LEVEL}
          onChange={(level) => run(() => gameApi.setLevel(node.techniqueId!, level))}
        />
      ) : null}

      {missingBasics.map((parent) => (
        <p key={parent.id} className="lesson-note">
          Dir fehlen noch Grundlagen:{" "}
          <button type="button" className="map-text-button" onClick={() => onSelect(parent.id)}>
            {parent.title}
          </button>
        </p>
      ))}

      <NodeList title="Baut auf" nodes={buildsOn} onSelect={onSelect} />
      <NodeList title="Schaltet frei" nodes={unlocks} onSelect={onSelect} />

      {linked.length > 0 ? (
        <details open className="lesson-block">
          <summary>Verbindungen ({linked.length})</summary>
          <ul>
            {linked.map((link) => (
              <li key={link.node.id}>
                <button type="button" className="map-text-button" onClick={() => onSelect(link.node.id)}>
                  {link.node.title}
                </button>
                <small>{link.reason}</small>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {node.chooseTarget && node.songs.length > 0 ? (
        <div className="lesson-block">
          <h3>Zielsong wählen</h3>
          {node.songs.map((song) => (
            <TargetSong
              key={`${song.title}-${song.artist}`}
              song={song}
              heading={false}
              targetSongId={state.targetSongId}
              busy={busy}
              onSet={(id) => void run(() => gameApi.setTargetSong(id))}
            />
          ))}
        </div>
      ) : node.songs.length > 0 ? (
        <div className="lesson-block">
          <h3>Songs dafür</h3>
          <ul>
            {node.songs.map((song) => (
              <li key={`${song.title}-${song.artist}`}>
                {song.title} · {song.artist}
                <small>{song.trains}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {actionable && node.targetSong ? (
        <TargetSong
          song={node.targetSong}
          targetSongId={state.targetSongId}
          busy={busy}
          onSet={(id) => void run(() => gameApi.setTargetSong(id))}
        />
      ) : null}

      {asking ? (
        <PauseDialog
          chosen={state.chosenLessons
            .filter((id) => id !== mainRoad)
            .map((id) => ({
              id,
              title: nodes.find((entry) => entry.id === id)?.title ?? id,
            }))}
          busy={busy}
          error={error}
          onPick={(id) => void run(() => gameApi.chooseLesson(node.id, id, mainRoad))}
          onCancel={() => {
            setAsking(false);
            setError(null);
          }}
        />
      ) : null}
    </section>
  );
}
