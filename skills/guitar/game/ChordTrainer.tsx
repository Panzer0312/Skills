import { useEffect, useRef, useState } from "react";
import { playSignal } from "../../../packages/web/src/audio/signalTone.js";
import { ChordDiagramSingle } from "../../../packages/web/src/music/ChordDiagramSingle.js";
import { useChordOverrides } from "../../../packages/web/src/music/useChordOverrides.js";
import { gameApi, gameContent, useGameState, type LogResult } from "./api.js";

const COUNT_IN_MS = 3000;
const ROUND_MS = 60_000;
const TICK_MS = 100;

type Pair = [string, string];
type Phase = "pick" | "countin" | "run" | "ask" | "done";

/** Metric key for a chord pair, alphabetical so Am-Em equals Em-Am. */
export function changeMetricKey(a: string, b: string): string {
  const [first, second] = [a, b].sort();
  return `wechsel:${first}-${second}`;
}

function pairsFromContent(): Pair[] {
  const quest = gameContent.quests.find((q) => q.id === "wechsel-minute");
  return (quest?.scale?.chordPairs ?? []) as Pair[];
}

export function ChordTrainer({
  pair,
  onResult,
}: {
  pair?: [string, string];
  onResult?: (changes: number) => void;
}) {
  const pairs = pairsFromContent();
  const [index, setIndex] = useState(0);
  const chosen: Pair = pair ?? pairs[index] ?? ["Am", "Em"];
  const [phase, setPhase] = useState<Phase>("pick");
  const [remainingMs, setRemainingMs] = useState(COUNT_IN_MS);
  const [count, setCount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LogResult | null>(null);
  const deadline = useRef(0);
  const { overrides } = useChordOverrides();
  const { data: state } = useGameState();

  const key = changeMetricKey(chosen[0], chosen[1]);
  const record = state?.records[key];

  useEffect(() => {
    if (phase !== "countin" && phase !== "run") return;
    const timer = setInterval(() => {
      const left = deadline.current - Date.now();
      if (left > 0) {
        setRemainingMs(left);
        return;
      }
      if (phase === "countin") {
        playSignal("start");
        deadline.current = Date.now() + ROUND_MS;
        setRemainingMs(ROUND_MS);
        setPhase("run");
      } else {
        playSignal("ende");
        setPhase("ask");
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [phase]);

  function start() {
    deadline.current = Date.now() + COUNT_IN_MS;
    setRemainingMs(COUNT_IN_MS);
    setCount("");
    setError(null);
    setResult(null);
    setPhase("countin");
  }

  async function submit() {
    const value = count.trim() === "" ? Number.NaN : Number(count);
    if (!Number.isInteger(value) || value < 0) {
      setError("Gib eine Zahl ab 0 ein.");
      return;
    }
    setError(null);
    if (onResult) {
      onResult(value);
      setPhase("done");
      return;
    }
    try {
      setResult(
        await gameApi.log({
          kind: "frei",
          seconds: 60,
          level: 1,
          techniqueId: "akkordwechsel",
          metricKey: key,
          metricValue: value,
        }),
      );
      setPhase("done");
    } catch {
      setError("Das Ergebnis konnte nicht gespeichert werden. Bitte später erneut versuchen.");
    }
  }

  const running = phase === "countin" || phase === "run";
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <div className="space-y-4">
      {!pair && (phase === "pick" || phase === "done") ? (
        <label className="block">
          Akkordpaar{" "}
          <select
            value={index}
            onChange={(event) => setIndex(Number(event.target.value))}
            className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          >
            {pairs.map(([a, b], i) => (
              <option key={i} value={i}>
                {a} – {b}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <p>{record === undefined ? "Noch kein Rekord für dieses Paar." : `Rekord: ${record}`}</p>

      <div className="flex flex-wrap gap-4">
        {chosen.map((name) => (
          <div key={name} className={running ? "scale-125 p-4" : ""}>
            <ChordDiagramSingle name={name} overrides={overrides} />
          </div>
        ))}
      </div>

      {running ? (
        <p role="timer" className="text-4xl font-bold">
          {seconds}
        </p>
      ) : null}

      {phase === "pick" || phase === "done" ? (
        <button type="button" onClick={start} className="rounded border px-3 py-1">
          Start
        </button>
      ) : null}
      {running ? (
        <button type="button" onClick={() => setPhase("pick")} className="rounded border px-3 py-1">
          Abbrechen
        </button>
      ) : null}

      {phase === "ask" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="space-y-2"
        >
          <label className="block">
            Wie viele saubere Wechsel?
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={count}
              onChange={(event) => setCount(event.target.value)}
              className="ml-2 w-24 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <button type="submit" className="rounded border px-3 py-1">
            Speichern
          </button>
        </form>
      ) : null}

      {error ? <p role="alert">{error}</p> : null}

      {phase === "done" && result ? (
        <div>
          {result.isRecord ? <p className="font-bold">Neuer Rekord!</p> : null}
          <p>+{result.xpGained} XP</p>
        </div>
      ) : null}
    </div>
  );
}
