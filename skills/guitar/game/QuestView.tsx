import { scaleQuest, type GameState, type QuestDefinition, type ScaledQuest } from "@skills/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../packages/web/src/api/client.js";
import { useMetronome } from "../../../packages/web/src/audio/useMetronome.js";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";
import { GAME_BASE, gameContent, questLevel, useGameState } from "./api.js";
import { ChordTrainer, changeMetricKey } from "./ChordTrainer.js";
import { ToolFrame } from "./Places.js";
import { ResultDialog } from "./ResultDialog.js";

const ACTIVE_KEY = "game.activeQuest";

function storedStart(questId: string): number | null {
  try {
    const active = JSON.parse(sessionStorage.getItem(ACTIVE_KEY) ?? "null") as {
      questId?: unknown;
      startedAt?: unknown;
    } | null;
    return active?.questId === questId && typeof active.startedAt === "number" ? active.startedAt : null;
  } catch {
    return null;
  }
}

/** Resumes the stored timer of this quest, or starts a new one. */
function beginQuest(questId: string): number {
  const stored = storedStart(questId);
  if (stored !== null) return stored;
  const startedAt = Date.now();
  sessionStorage.setItem(ACTIVE_KEY, JSON.stringify({ questId, startedAt }));
  return startedAt;
}

function clearQuest() {
  sessionStorage.removeItem(ACTIVE_KEY);
}

function secondsSince(startedAt: number): number {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Elapsed({ startedAt }: { startedAt: number }) {
  const [seconds, setSeconds] = useState(() => secondsSince(startedAt));
  useEffect(() => {
    const timer = setInterval(() => setSeconds(secondsSince(startedAt)), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  return (
    <p role="timer" aria-label="Verstrichene Zeit" className="quest-timer">
      {formatElapsed(seconds)}
    </p>
  );
}

function Metronome({ metronome }: { metronome: ReturnType<typeof useMetronome> }) {
  return (
    <section aria-label="Metronom" className="quest-metronome">
      <button
        type="button"
        className="game-button"
        onClick={() => (metronome.running ? metronome.stop() : metronome.start())}
      >
        Metronom {metronome.running ? "stoppen" : "starten"}
      </button>
      <div className="quest-bpm">
        <input
          type="range"
          aria-label="BPM"
          min={20}
          max={300}
          value={metronome.bpm}
          onChange={(event) => metronome.setBpm(Number(event.target.value))}
        />
        <output>{metronome.bpm} BPM</output>
      </div>
      <button type="button" className="game-button" onClick={metronome.tap}>
        Tap
      </button>
    </section>
  );
}

function useTargetSongTitle(targetSongId: string | null, data: unknown[]) {
  const [source, ...rest] = (targetSongId ?? "").split(":");
  const id = rest.join(":");
  const imported = useQuery({
    queryKey: ["songs"],
    queryFn: () => api.get<{ songs: { id: number; title: string }[] }>("/api/songs"),
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

interface Finished {
  seconds: number;
  level: number;
  metricKey: string | undefined;
}

function QuestRun({ quest, state, data }: { quest: QuestDefinition; state: GameState; data: unknown[] }) {
  const navigate = useNavigate();
  const metronome = useMetronome();
  const { setBpm, stop } = metronome;
  const [startedAt] = useState(() => beginQuest(quest.id));
  const [trainerValue, setTrainerValue] = useState<number | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);

  const level = questLevel(state, quest);
  const scaled = scaleQuest(quest, level);
  const pair = quest.kind === "wechsel" ? scaled.chordPair : null;

  useEffect(() => {
    if (scaled.bpm !== null) setBpm(scaled.bpm);
  }, [scaled.bpm, setBpm]);

  function finish() {
    stop();
    const metricKey = pair ? changeMetricKey(pair[0], pair[1]) : quest.metricLabel ? quest.id : undefined;
    setFinished({ seconds: secondsSince(startedAt), level, metricKey });
  }

  function backToBoard() {
    navigate(`${GAME_BASE}/quests`);
  }

  function cancel() {
    clearQuest();
    backToBoard();
  }

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
        <Elapsed startedAt={startedAt} />
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
        {quest.kind === "song" ? (
          <SongPanel targetSongId={state.targetSongId} scaled={scaled} data={data} />
        ) : null}
        {pair ? (
          <ChordTrainer pair={pair} onResult={(n) => setTrainerValue((v) => Math.max(v ?? 0, n))} />
        ) : null}
        {trainerValue !== null ? (
          <p>Beste Runde: {trainerValue}. Starte noch eine Runde oder tippe auf Fertig.</p>
        ) : null}
        <Metronome metronome={metronome} />
        <div className="quest-buttons">
          <button type="button" className="game-button" onClick={finish}>
            Fertig
          </button>
          <button type="button" className="game-button" onClick={cancel}>
            Abbrechen
          </button>
        </div>
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
