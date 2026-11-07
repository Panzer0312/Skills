import {
  createHoldDetector,
  detectPitch,
  displayNote,
  inputLevel,
  matchesTarget,
  nextTarget,
  notePitchClass,
  TUNINGS,
  type NoteTarget,
  type Tuning,
} from "@skills/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { playSignal } from "../../../packages/web/src/audio/signalTone.js";
import { usePersistentState } from "../../../packages/web/src/app/usePersistentState.js";
import { useInputDevices } from "../../../packages/web/src/audio/useInputDevices.js";
import { useMicrophone } from "../../../packages/web/src/audio/useMicrophone.js";
import { findTuning, stringLabel, stringsLabel } from "./tuningLabels.js";
import { UndoButton } from "./UndoButton.js";
import { gameApi, type LogResult } from "./api.js";
import { FretboardGrid } from "./FretboardGrid.js";
import { InputControls } from "./InputControls.js";

const ROUND_MS = 60_000;
const TICK_MS = 100;

function isTuningName(raw: unknown): raw is string {
  return typeof raw === "string" && TUNINGS.some((t) => t.name === raw);
}

function tuningFor(name: string): Tuning {
  return findTuning(name) ?? TUNINGS[0]!;
}

const CHOICES = [[0], [1], [0, 1], [0, 1, 2, 3, 4, 5]];

function choicesFor(tuning: Tuning): { label: string; strings: number[] }[] {
  return CHOICES.map((strings) => ({ label: stringsLabel(tuning, strings), strings }));
}

type Phase = "pick" | "run" | "done";

function beep(kind: "start" | "ende") {
  try {
    playSignal(kind);
  } catch {
    // A failed beep must not stop the round.
  }
}

/** The pitch class counts on every fret of the string, so fret 12 is as good as the open string. */
function isRight(tuning: Tuning, target: NoteTarget, stringIndex: number, fret: number): boolean {
  if (stringIndex !== target.stringIndex) return false;
  const open = tuning.strings[stringIndex]!;
  return (notePitchClass(open) + fret) % 12 === notePitchClass(target.note);
}

export function NoteFinder({
  strings: fixedStrings,
  tuning: fixedTuning,
  onResult,
  onRunningChange,
  cancelSignal,
}: {
  strings?: number[];
  tuning?: string;
  onResult?: (hits: number) => void;
  onRunningChange?: (running: boolean) => void;
  cancelSignal?: number;
}) {
  const [choice, setChoice] = useState(0);
  const [storedTuning, setStoredTuning] = usePersistentState("guitar.notefinder.tuning", "Standard", isTuningName);
  const tuningName =
    fixedTuning !== undefined ? (isTuningName(fixedTuning) ? fixedTuning : "Standard") : storedTuning;
  const tuning = tuningFor(tuningName);
  const tuningRef = useRef(tuning);
  tuningRef.current = tuning;
  const choices = choicesFor(tuning);
  const strings = fixedStrings ?? choices[choice]!.strings;
  const stringsKey = strings.join(",");

  const [phase, setPhase] = useState<Phase>("pick");
  const [target, setTarget] = useState<NoteTarget | null>(null);
  const [hits, setHits] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [remainingMs, setRemainingMs] = useState(ROUND_MS);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LogResult | null>(null);
  const [undone, setUndone] = useState(false);

  const deadline = useRef(0);
  const hitsRef = useRef(0);
  const targetRef = useRef<NoteTarget | null>(null);
  const phaseRef = useRef<Phase>("pick");
  const holdRef = useRef(createHoldDetector());

  const inputs = useInputDevices();
  const { select, refresh } = inputs;

  function showTarget(next: NoteTarget | null) {
    targetRef.current = next;
    holdRef.current = createHoldDetector();
    setTarget(next);
    setRevealed(false);
  }

  const stringsRef = useRef(strings);
  stringsRef.current = strings;

  /** The one scoring path, for a click and for a held pitch alike. */
  const score = useCallback(() => {
    hitsRef.current += 1;
    setHits(hitsRef.current);
    showTarget(nextTarget(stringsRef.current, targetRef.current, tuningRef.current));
  }, []);

  const onBuffer = useCallback(
    (buffer: Float32Array, sampleRate: number) => {
      // The meter also moves before Start, so the owner can set the level first.
      setLevel(inputLevel(buffer));
      const current = targetRef.current;
      if (phaseRef.current !== "run" || !current) return;
      const frequency = detectPitch(buffer, sampleRate);
      const matching = frequency !== null && matchesTarget(frequency, current);
      if (holdRef.current(matching, Date.now())) score();
    },
    [score],
  );

  const mic = useMicrophone({ onBuffer, deviceId: inputs.deviceId, onDeviceLost: () => select(null) });
  useEffect(() => {
    if (mic.state === "running") void refresh();
  }, [mic.state, refresh]);

  async function finish() {
    phaseRef.current = "done";
    setPhase("done");
    beep("ende");
    const total = hitsRef.current;
    if (onResult) {
      onResult(total);
      return;
    }
    // Starting a round and walking away earns nothing, not even the time.
    if (total === 0) return;
    try {
      setResult(
        await gameApi.log({
          kind: "frei",
          seconds: ROUND_MS / 1000,
          level: 1,
          techniqueId: "theorie",
          metricKey: `notenfinder:${tuning.name === "Standard" ? "" : `${tuning.name}:`}${strings.join("-")}`,
          metricValue: total,
        }),
      );
    } catch {
      setError("Das Ergebnis konnte nicht gespeichert werden. Bitte später erneut versuchen.");
    }
  }
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    if (phase !== "run") return;
    const timer = setInterval(() => {
      const left = deadline.current - Date.now();
      if (left > 0) {
        setRemainingMs(left);
        return;
      }
      clearInterval(timer);
      setRemainingMs(0);
      void finishRef.current();
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [phase]);

  function start() {
    hitsRef.current = 0;
    setHits(0);
    setError(null);
    setResult(null);
    setUndone(false);
    deadline.current = Date.now() + ROUND_MS;
    setRemainingMs(ROUND_MS);
    phaseRef.current = "run";
    setPhase("run");
    showTarget(nextTarget(strings, null, tuning));
    beep("start");
  }

  function cancel() {
    phaseRef.current = "pick";
    setPhase("pick");
    showTarget(null);
  }
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;

  const runningChangeRef = useRef(onRunningChange);
  runningChangeRef.current = onRunningChange;
  const running = phase === "run";
  useEffect(() => {
    if (!running) return;
    runningChangeRef.current?.(true);
    return () => runningChangeRef.current?.(false);
  }, [running]);

  const seenCancel = useRef(cancelSignal);
  useEffect(() => {
    if (seenCancel.current === cancelSignal) return;
    seenCancel.current = cancelSignal;
    if (phaseRef.current === "run") cancelRef.current();
  }, [cancelSignal]);

  function click(stringIndex: number, fret: number) {
    if (phase !== "run" || !target) return;
    if (isRight(tuning, target, stringIndex, fret)) score();
    else setRevealed(true);
  }

  const micOn = mic.state === "running";
  const prompt = target
    ? `Finde ${displayNote(target.note.replace(/-?\d+$/, ""))} auf der ${stringLabel(tuning, target.stringIndex)}-Saite`
    : "";

  return (
    <div className="space-y-4">
      {fixedTuning === undefined && !running ? (
        <label className="block">
          Stimmung{" "}
          <select
            value={tuning.name}
            onChange={(event) => setStoredTuning(event.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          >
            {TUNINGS.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {!fixedStrings && !running ? (
        <label className="block">
          Saiten{" "}
          <select
            value={choice}
            onChange={(event) => setChoice(Number(event.target.value))}
            className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          >
            {choices.map((c, i) => (
              <option key={c.label} value={i}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {running ? (
        <>
          <p data-testid="prompt" className="text-xl font-bold">
            {prompt}
          </p>
          <p role="timer">{Math.ceil(remainingMs / 1000)}</p>
        </>
      ) : null}
      <p>Treffer: {hits}</p>

      <FretboardGrid
        key={stringsKey}
        tuning={tuning}
        testIdPrefix="finder"
        onFret={click}
        mark={(stringIndex, fret) => {
          const place = revealed && target && target.stringIndex === stringIndex && target.fret === fret;
          return {
            label: place ? displayNote(target.note.replace(/-?\d+$/, "")) : "",
            state: place ? "root" : strings.includes(stringIndex) ? "normal" : "dim",
          };
        }}
      />

      <div className="flex flex-wrap gap-2">
        {!running ? (
          <button type="button" onClick={start} className="rounded border px-3 py-1">
            Start
          </button>
        ) : (
          <button type="button" onClick={cancel} className="rounded border px-3 py-1">
            Abbrechen
          </button>
        )}
        <button
          type="button"
          onClick={() => (micOn ? mic.stop() : void mic.start())}
          className="rounded border px-3 py-1"
        >
          {micOn ? "Mikrofon aus" : "Mit Gitarre spielen"}
        </button>
      </div>

      {micOn ? (
        <InputControls devices={inputs.devices} deviceId={inputs.deviceId} onSelect={select} level={level} />
      ) : null}
      {mic.error ? <p role="alert">{mic.error} Du kannst weiter auf das Griffbrett klicken.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {phase === "done" && hits === 0 ? <p>Keine Treffer in dieser Runde. Beim nächsten Mal klappt es.</p> : null}
      {phase === "done" && result ? (
        <div>
          {undone ? null : (
            <>
              {result.isRecord && hits > 0 ? <p className="font-bold">Neuer Rekord!</p> : null}
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
