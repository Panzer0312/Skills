import { scaleQuest, type GameState, type MapNode, type QuestDefinition, type ScaledQuest } from "@skills/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePracticeKeys } from "../../../packages/web/src/app/usePracticeKeys.js";
import { useWakeLock } from "../../../packages/web/src/app/useWakeLock.js";
import { api } from "../../../packages/web/src/api/client.js";
import { FretOverlay } from "./FretOverlay.js";
import { MetronomePanel } from "./MetronomePanel.js";
import { useMetronome } from "../../../packages/web/src/audio/useMetronome.js";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";
import { GAME_BASE, gameContent, normalizeTitle, questLevel, useGameState } from "./api.js";
import { ChordTrainer, changeMetricKey } from "./ChordTrainer.js";
import { NoteFinder } from "./NoteFinder.js";
import { ToolFrame } from "./Places.js";
import { RiffCard } from "./RiffViewer.js";
import { ResultDialog } from "./ResultDialog.js";
import { Griffbild } from "./visuals/index.js";

const ACTIVE_KEY = "game.activeQuest";

interface QuestClock {
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
}

function readClock(questId: string): QuestClock | null {
  try {
    const active = JSON.parse(sessionStorage.getItem(ACTIVE_KEY) ?? "null") as Record<string, unknown> | null;
    if (active?.questId !== questId || typeof active.startedAt !== "number") return null;
    return {
      startedAt: active.startedAt,
      pausedAt: typeof active.pausedAt === "number" ? active.pausedAt : null,
      pausedMs: typeof active.pausedMs === "number" ? active.pausedMs : 0,
    };
  } catch {
    return null;
  }
}

function writeClock(questId: string, clock: QuestClock) {
  try {
    sessionStorage.setItem(ACTIVE_KEY, JSON.stringify({ questId, ...clock }));
  } catch {
    // The timer still runs in memory.
  }
}

/** Resumes the stored timer of this quest, or starts a new one. */
function beginQuest(questId: string): QuestClock {
  const stored = readClock(questId);
  if (stored) return stored;
  const clock = { startedAt: Date.now(), pausedAt: null, pausedMs: 0 };
  writeClock(questId, clock);
  return clock;
}

function clearQuest() {
  sessionStorage.removeItem(ACTIVE_KEY);
}

function elapsedSeconds({ startedAt, pausedAt, pausedMs }: QuestClock, now = Date.now()): number {
  return Math.max(0, Math.floor((now - startedAt - pausedMs - (pausedAt !== null ? now - pausedAt : 0)) / 1000));
}

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Elapsed({ clock }: { clock: QuestClock }) {
  const [seconds, setSeconds] = useState(() => elapsedSeconds(clock));
  useEffect(() => {
    setSeconds(elapsedSeconds(clock));
    if (clock.pausedAt !== null) return;
    const timer = setInterval(() => setSeconds(elapsedSeconds(clock)), 1000);
    return () => clearInterval(timer);
  }, [clock]);
  return (
    <p role="timer" aria-label="Verstrichene Zeit" className="quest-timer">
      {clock.pausedAt !== null ? "Pausiert" : formatElapsed(seconds)}
    </p>
  );
}

const fetchSongs = () => api.get<{ songs: { id: number; title: string }[] }>("/api/songs");

function useTargetSongTitle(targetSongId: string | null, data: unknown[]) {
  const [source, ...rest] = (targetSongId ?? "").split(":");
  const id = rest.join(":");
  const imported = useQuery({
    queryKey: ["songs"],
    queryFn: fetchSongs,
    enabled: source === "db",
  });
  if (source === "uebung") {
    const shipped = data.flat() as { id?: unknown; titel?: string }[];
    return { title: shipped.find((song) => song?.id === id)?.titel ?? null, loading: false };
  }
  if (source === "db") {
    return {
      title: imported.data?.songs.find((song) => String(song.id) === id)?.title ?? null,
      loading: imported.isPending,
    };
  }
  return { title: null, loading: false };
}

/** "Abschnitt: Strophe · 3 Durchläufe · 70 % Tempo", whichever parts the quest scales. */
function songLine({ section, runs, tempoPercent }: ScaledQuest): string {
  return [
    section !== null ? `Abschnitt: ${section}` : null,
    runs !== null ? `${runs} ${runs === 1 ? "Durchlauf" : "Durchläufe"}` : null,
    tempoPercent !== null ? `${tempoPercent} % Tempo` : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

function SongPanel({
  targetSongId,
  scaled,
  data,
}: {
  targetSongId: string | null;
  scaled: ScaledQuest;
  data: unknown[];
}) {
  const { title, loading } = useTargetSongTitle(targetSongId, data);
  if (loading) return <p>Wird geladen…</p>;
  if (title === null) {
    return (
      <Link to={`${GAME_BASE}/einstufung`} className="underline">
        Zielsong wählen
      </Link>
    );
  }
  return (
    <div>
      <p className="font-semibold">{title}</p>
      {songLine(scaled) ? <p>{songLine(scaled)}</p> : null}
      <Link to={`${GAME_BASE}/taverne`} className="underline">
        Zur Taverne
      </Link>
    </div>
  );
}

/** A quest of a song lesson practises that song, whatever the target song is. */
function LessonSongPanel({ song, scaled }: { song: NonNullable<MapNode["targetSong"]>; scaled: ScaledQuest }) {
  const imported = useQuery({ queryKey: ["songs"], queryFn: fetchSongs });
  const wanted = normalizeTitle(song.title);
  const found = imported.data?.songs.some((entry) => normalizeTitle(entry.title) === wanted);
  return (
    <div>
      <p className="font-semibold">{song.title}</p>
      {songLine(scaled) ? <p>{songLine(scaled)}</p> : null}
      {imported.isPending ? null : found ? (
        <Link to={`${GAME_BASE}/taverne`} className="underline">
          Zur Taverne
        </Link>
      ) : imported.data ? (
        <Link to="/songs/neu" className="underline">
          Importiere den Song, die Übungen funktionieren auch ohne
        </Link>
      ) : (
        <p role="alert" className="game-error">
          Deine Songs konnten nicht geladen werden.
        </p>
      )}
    </div>
  );
}

interface Finished {
  seconds: number;
  level: number;
  metricKey: string | undefined;
}

function QuestRun({ quest, state, data }: { quest: QuestDefinition; state: GameState; data: unknown[] }) {
  const navigate = useNavigate();
  const metronome = useMetronome();
  const { setBpm, stop, start, running } = metronome;
  const [clock, setClock] = useState(() => beginQuest(quest.id));
  const [trainerValue, setTrainerValue] = useState<number | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);

  const level = questLevel(state, quest);
  const scaled = scaleQuest(quest, level);
  const pair = quest.kind === "wechsel" ? scaled.chordPair : null;
  const riff = gameContent.riffs.find((entry) => entry.id === quest.riffId);
  const lessonSong = gameContent.nodes.find((node) => node.id === quest.lessonId)?.targetSong ?? null;

  useEffect(() => {
    if (scaled.bpm !== null) setBpm(scaled.bpm);
  }, [scaled.bpm, setBpm]);

  const paused = clock.pausedAt !== null;
  useWakeLock(finished === null && !paused);

  function togglePause() {
    const now = Date.now();
    const next: QuestClock =
      clock.pausedAt === null
        ? { ...clock, pausedAt: now }
        : { ...clock, pausedAt: null, pausedMs: clock.pausedMs + (now - clock.pausedAt) };
    if (next.pausedAt !== null) stop();
    writeClock(quest.id, next);
    setClock(next);
  }

  function finish() {
    stop();
    const metricKey = pair ? changeMetricKey(pair[0], pair[1]) : quest.metricLabel ? quest.id : undefined;
    setFinished({ seconds: elapsedSeconds(clock), level, metricKey });
  }

  function backToBoard() {
    navigate(`${GAME_BASE}/quests`);
  }

  function cancel() {
    clearQuest();
    backToBoard();
  }

  usePracticeKeys(
    {
      " ": () => (running ? stop() : paused ? undefined : start()),
      p: togglePause,
      Enter: finish,
    },
    finished === null,
  );

  if (finished) {
    return (
      <ToolFrame title={quest.title}>
        <ResultDialog
          quest={quest}
          level={finished.level}
          seconds={finished.seconds}
          metricKey={finished.metricKey}
          metricPrefill={trainerValue}
          lessons={state.lessons}
          onSaved={clearQuest}
          onCancel={cancel}
          onClose={backToBoard}
        />
      </ToolFrame>
    );
  }

  return (
    <ToolFrame title={quest.title}>
      <div className="quest-view">
        <Elapsed clock={clock} />
        <p>{quest.description}</p>
        <ul className="quest-values">
          <li>Stufe {level} von 10</li>
          {scaled.bpm !== null ? <li>{scaled.bpm} BPM</li> : null}
          {scaled.chordPair ? <li>{scaled.chordPair.join(" – ")}</li> : null}
        </ul>
        {quest.lessonId !== null ? (
          <Link to={`${GAME_BASE}/bibliothek/${quest.lessonId}`} className="underline">
            Lektion lesen
          </Link>
        ) : null}
        {quest.lessonId !== null ? (
          <Link to={`${GAME_BASE}/hafen/${quest.lessonId}`} className="underline">
            Auf der Karte
          </Link>
        ) : null}
        {quest.tuning ? (
          <Link
            to={`${GAME_BASE}/schrein?stimmung=${encodeURIComponent(quest.tuning)}&quest=${encodeURIComponent(quest.id)}`}
            className="underline"
          >
            Stimmung: {quest.tuning}
          </Link>
        ) : null}
        {quest.kind === "song" ? (
          lessonSong ? (
            <LessonSongPanel song={lessonSong} scaled={scaled} />
          ) : (
            <SongPanel targetSongId={state.targetSongId} scaled={scaled} data={data} />
          )
        ) : null}
        {quest.chords ? <Griffbild akkorde={quest.chords} /> : null}
        {riff ? <RiffCard
            riff={riff}
            onTempo={setBpm}
            bpm={scaled.bpm ?? undefined}
            inQuest
            questId={quest.id}
            tuningLinked={Boolean(quest.tuning)}
          /> : null}
        {quest.fretboard ? (
          <FretOverlay
            root={quest.fretboard.root}
            scale={quest.fretboard.scale}
            box={quest.fretboard.box as 1 | 2 | 3 | 4 | 5 | undefined}
            caged={quest.fretboard.caged}
          />
        ) : null}
        {pair ? (
          <ChordTrainer pair={pair} countInBpm={scaled.bpm ?? undefined} onResult={(n) => setTrainerValue((v) => Math.max(v ?? 0, n))} />
        ) : null}
        {quest.noteGame ? (
          <NoteFinder
            strings={quest.noteGame.strings}
            tuning={quest.tuning ?? "Standard"}
            onResult={(n) => setTrainerValue((v) => Math.max(v ?? 0, n))}
          />
        ) : null}
        {trainerValue !== null ? (
          <p>Beste Runde: {trainerValue}. Starte noch eine Runde oder tippe auf Fertig.</p>
        ) : null}
        <MetronomePanel metronome={metronome} />
        <div className="quest-buttons">
          <button type="button" className="game-button" onClick={togglePause}>
            {paused ? "Weiter" : "Pause"}
          </button>
          <button type="button" className="game-button" onClick={finish}>
            Fertig
          </button>
          <button type="button" className="game-button" onClick={cancel}>
            Abbrechen
          </button>
        </div>
        <p className="quest-keys">Tasten: Leertaste Metronom · P Pause · Enter Fertig</p>
      </div>
    </ToolFrame>
  );
}

export function QuestView({ data }: WidgetProps) {
  const { questId } = useParams();
  const { data: state } = useGameState();
  const quest = gameContent.quests.find((q) => q.id === questId);
  if (!state) return null;
  if (!quest) {
    return (
      <ToolFrame title="Quest">
        <p>Diese Quest gibt es nicht.</p>
        <Link to={`${GAME_BASE}/quests`} className="underline">
          Zum Quest Board
        </Link>
      </ToolFrame>
    );
  }
  return <QuestRun key={quest.id} quest={quest} state={state} data={data} />;
}
