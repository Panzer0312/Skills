import { useEffect, useRef, useState } from "react";
import { chordShape } from "@skills/core";
import { usePracticeKeys } from "../../../packages/web/src/app/usePracticeKeys.js";
import {
  playClick,
  playSignal,
} from "../../../packages/web/src/audio/signalTone.js";
import { ChordDiagramSingle } from "../../../packages/web/src/music/ChordDiagramSingle.js";
import { useChordOverrides } from "../../../packages/web/src/music/useChordOverrides.js";
import { UndoButton } from "./UndoButton.js";
import { usePref } from "./usePref.js";
import { gameApi, gameContent, useGameState, type LogResult } from "./api.js";

const COUNT_IN_BEATS = 4;
const DEFAULT_COUNT_IN_BPM = 80;
const CUSTOM = "custom";
const ROUND_MS = 60_000;
const TICK_MS = 100;

function beep(kind: "start" | "ende") {
  try {
    playSignal(kind);
  } catch {
    // A failed beep must not stop the round.
  }
}

function click(accent: boolean) {
  try {
    playClick(accent);
  } catch {
    // A failed click must not stop the count-in.
  }
}

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
  countInBpm,
  onRunningChange,
  cancelSignal,
}: {
  pair?: [string, string];
  onResult?: (changes: number) => void;
  countInBpm?: number;
  onRunningChange?: (running: boolean) => void;
  cancelSignal?: number;
}) {
  const bpm =
    countInBpm !== undefined && Number.isFinite(countInBpm) && countInBpm > 0
      ? countInBpm
      : DEFAULT_COUNT_IN_BPM;
  const beatMs = 60_000 / bpm;
  const countInMs = COUNT_IN_BEATS * beatMs;
  const pairs = pairsFromContent();
  const [index, setIndex] = useState(0);
  const [custom, setCustom] = useState(false);
  const [customPair, setCustomPair] = usePref("werkzeuge.akkordtrainer.eigenesPaar");
  const useCustom = !pair && custom;
  const rawChosen: Pair =
    pair ?? (custom ? customPair : (pairs[index] ?? ["Am", "Em"]));
  const chosen: Pair = [rawChosen[0].trim(), rawChosen[1].trim()];
  const known = chosen.every((name) => chordShape(name) !== null);
  const distinct = chosen[0] !== chosen[1];
  const chosenValid = known && distinct;
  const [phase, setPhase] = useState<Phase>("pick");
  const [remainingMs, setRemainingMs] = useState(countInMs);
  const [count, setCount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LogResult | null>(null);
  const [undone, setUndone] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const deadline = useRef(0);
  const { overrides } = useChordOverrides();
  const { data: state } = useGameState();

  const key = changeMetricKey(chosen[0], chosen[1]);
  const record = state?.records[key];

  useEffect(() => {
    if (phase !== "countin") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let beat = 1; beat < COUNT_IN_BEATS; beat += 1) {
      timers.push(setTimeout(() => click(false), beat * beatMs));
    }
    timers.push(
      setTimeout(() => {
        beep("start");
        deadline.current = Date.now() + ROUND_MS;
        setRemainingMs(ROUND_MS);
        setPhase("run");
      }, countInMs),
    );
    return () => timers.forEach(clearTimeout);
  }, [phase, countInMs, beatMs]);

  useEffect(() => {
    if (phase !== "countin" && phase !== "run") return;
    const timer = setInterval(() => {
      const left = deadline.current - Date.now();
      if (left > 0) {
        setRemainingMs(left);
        return;
      }
      if (phase === "run") {
        beep("ende");
        setPhase("ask");
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [phase]);

  function start() {
    if (!chosenValid) return;
    deadline.current = Date.now() + countInMs;
    click(true);
    setRemainingMs(countInMs);
    setCount("");
    setError(null);
    setResult(null);
    setUndone(false);
    setPhase("countin");
  }

  async function submit() {
    if (savingRef.current) return;
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
    savingRef.current = true;
    setSaving(true);
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
      setError(
        "Das Ergebnis konnte nicht gespeichert werden. Bitte später erneut versuchen.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const running = phase === "countin" || phase === "run";
  const shown =
    phase === "countin"
      ? Math.max(1, Math.ceil(remainingMs / beatMs))
      : Math.ceil(remainingMs / 1000);
  const canStart = phase === "pick" || phase === "done";
  usePracticeKeys({ s: start }, canStart && chosenValid);

  const runningChangeRef = useRef(onRunningChange);
  runningChangeRef.current = onRunningChange;
  useEffect(() => {
    if (!running) return;
    runningChangeRef.current?.(true);
    return () => runningChangeRef.current?.(false);
  }, [running]);

  const seenCancel = useRef(cancelSignal);
  useEffect(() => {
    if (seenCancel.current === cancelSignal) return;
    seenCancel.current = cancelSignal;
    setPhase((current) => (current === "countin" || current === "run" ? "pick" : current));
  }, [cancelSignal]);

  return (
    <div className="space-y-4">
      {!pair && (phase === "pick" || phase === "done") ? (
        <label className="block">
          Akkordpaar{" "}
          <select
            value={custom ? CUSTOM : index}
            onChange={(event) => {
              if (event.target.value === CUSTOM) {
                setCustom(true);
              } else {
                setCustom(false);
                setIndex(Number(event.target.value));
              }
            }}
            className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          >
            {pairs.map(([a, b], i) => (
              <option key={i} value={i}>
                {a} – {b}
              </option>
            ))}
            <option value={CUSTOM}>Eigenes Paar…</option>
          </select>
        </label>
      ) : null}

      {useCustom && canStart ? (
        <div className="flex flex-wrap gap-2">
          {[0, 1].map((i) => (
            <input
              key={i}
              type="text"
              aria-label={i === 0 ? "Erster Akkord" : "Zweiter Akkord"}
              value={customPair[i]}
              onChange={(event) => {
                const next: Pair = [customPair[0], customPair[1]];
                next[i] = event.target.value;
                setCustomPair(next);
              }}
              className="w-24 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
            />
          ))}
        </div>
      ) : null}

      <p>
        {record === undefined
          ? "Noch kein Rekord für dieses Paar."
          : `Rekord: ${record}`}
      </p>

      <div className="flex flex-wrap gap-4">
        {chosen.map((name, i) =>
          chordShape(name.trim()) === null ? null : (
            <div
              key={`${i}-${name}`}
              className={running ? "scale-125 p-4" : ""}
            >
              <ChordDiagramSingle name={name} overrides={overrides} />
            </div>
          ),
        )}
      </div>

      {running ? (
        <p role="timer" className="text-4xl font-bold">
          {shown}
        </p>
      ) : null}

      {phase === "pick" || phase === "done" ? (
        <button
          type="button"
          onClick={start}
          disabled={!chosenValid}
          className="rounded border px-3 py-1 disabled:opacity-50"
        >
          Start
        </button>
      ) : null}
      {canStart && !known ? <p>Unbekannter Akkord</p> : null}
      {canStart && known && !distinct ? (
        <p>Zwei verschiedene Akkorde wählen</p>
      ) : null}
      {running ? (
        <button
          type="button"
          onClick={() => setPhase("pick")}
          className="rounded border px-3 py-1"
        >
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
          <button
            type="submit"
            disabled={saving}
            className="rounded border px-3 py-1"
          >
            Speichern
          </button>
        </form>
      ) : null}

      {error ? <p role="alert">{error}</p> : null}

      {phase === "done" && result ? (
        <div>
          {undone ? null : (
            <>
              {result.isRecord ? <p className="font-bold">Neuer Rekord!</p> : null}
              <p>+{result.xpGained} XP</p>
              {result.goldGained > 0 ? <p>+{result.goldGained} Gold</p> : null}
            </>
          )}
          <UndoButton logId={result.logId} onUndone={() => setUndone(true)} />
        </div>
      ) : null}
    </div>
  );
}
