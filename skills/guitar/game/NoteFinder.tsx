import {
  createHoldDetector,
  detectPitch,
  displayNote,
  inputLevel,
  matchesTarget,
  nextTarget,
  noteToSemitone,
  TUNINGS,
  type NoteTarget,
} from "@skills/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { playSignal } from "../../../packages/web/src/audio/signalTone.js";
import { useInputDevices } from "../../../packages/web/src/audio/useInputDevices.js";
import { useMicrophone } from "../../../packages/web/src/audio/useMicrophone.js";
import { gameApi, type LogResult } from "./api.js";
import { FretboardGrid } from "./FretboardGrid.js";
import { InputControls } from "./InputControls.js";

const ROUND_MS = 60_000;
const TICK_MS = 100;
const TUNING = TUNINGS[0]!;
const STRING_NAMES = ["E", "A", "D", "G", "H", "e"];

const CHOICES: { label: string; strings: number[] }[] = [
  { label: "E-Saite", strings: [0] },
  { label: "A-Saite", strings: [1] },
  { label: "E und A", strings: [0, 1] },
  { label: "Alle", strings: [0, 1, 2, 3, 4, 5] },
];

type Phase = "pick" | "run" | "done";

function beep(kind: "start" | "ende") {
  try {
    playSignal(kind);
  } catch {
    // A failed beep must not stop the round.
  }
}

function pitchClass(note: string): number {
  return noteToSemitone(note.replace(/-?\d+$/, ""));
}

/** The pitch class counts on every fret of the string, so fret 12 is as good as the open string. */
function isRight(target: NoteTarget, stringIndex: number, fret: number): boolean {
  if (stringIndex !== target.stringIndex) return false;
  const open = TUNING.strings[stringIndex]!;
  return (pitchClass(open) + fret) % 12 === pitchClass(target.note);
}

export function NoteFinder({
  strings: fixedStrings,
  onResult,
}: {
  strings?: number[];
  onResult?: (hits: number) => void;
}) {
  const [choice, setChoice] = useState(0);
  const strings = fixedStrings ?? CHOICES[choice]!.strings;
  const stringsKey = strings.join(",");

  const [phase, setPhase] = useState<Phase>("pick");
  const [target, setTarget] = useState<NoteTarget | null>(null);
  const [hits, setHits] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [remainingMs, setRemainingMs] = useState(ROUND_MS);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LogResult | null>(null);

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

  function score() {
    hitsRef.current += 1;
    setHits(hitsRef.current);
    showTarget(nextTarget(strings, targetRef.current, TUNING));
  }

  const onBuffer = useCallback((buffer: Float32Array, sampleRate: number) => {
    const current = targetRef.current;
    if (phaseRef.current !== "run" || !current) return;
    setLevel(inputLevel(buffer));
    const frequency = detectPitch(buffer, sampleRate);
    const matching = frequency !== null && matchesTarget(frequency, current);
    if (holdRef.current(matching, Date.now())) {
      hitsRef.current += 1;
      setHits(hitsRef.current);
      const next = nextTarget(stringsRef.current, current, TUNING);
      targetRef.current = next;
      holdRef.current = createHoldDetector();
      setTarget(next);
      setRevealed(false);
    }
  }, []);
  const stringsRef = useRef(strings);
  stringsRef.current = strings;

  const mic = useMicrophone({ onBuffer, deviceId: inputs.deviceId, onDeviceLost: () => select(null) });
  useEffect(() => {
    if (mic.state === "running") void refresh();
  }, [mic.state, refresh]);

  async function finish() {
    phaseRef.current = "done";
    setPhase("done");
    setLevel(0);
    mic.stop();
    beep("ende");
    const total = hitsRef.current;
    if (onResult) {
      onResult(total);
      return;
    }
    try {
      setResult(
        await gameApi.log({
          kind: "frei",
          seconds: 60,
          level: 1,
          techniqueId: "theorie",
          metricKey: `notenfinder:${strings.join("-")}`,
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
    deadline.current = Date.now() + ROUND_MS;
    setRemainingMs(ROUND_MS);
    phaseRef.current = "run";
    setPhase("run");
    showTarget(nextTarget(strings, null, TUNING));
    beep("start");
  }

  function cancel() {
    phaseRef.current = "pick";
    setPhase("pick");
    setLevel(0);
    mic.stop();
    showTarget(null);
  }

  function click(stringIndex: number, fret: number) {
    if (phase !== "run" || !target) return;
    if (isRight(target, stringIndex, fret)) score();
    else setRevealed(true);
  }

  const running = phase === "run";
  const micOn = mic.state === "running";
  const prompt = target
    ? `Finde ${displayNote(target.note.replace(/-?\d+$/, ""))} auf der ${STRING_NAMES[target.stringIndex]}-Saite`
    : "";

  return (
    <div className="space-y-4">
      {!fixedStrings && !running ? (
        <label className="block">
          Saiten{" "}
          <select
            value={choice}
            onChange={(event) => setChoice(Number(event.target.value))}
            className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          >
            {CHOICES.map((c, i) => (
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
        tuning={TUNING}
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
      {phase === "done" && result ? (
        <div>
          {result.isRecord ? <p className="font-bold">Neuer Rekord!</p> : null}
          <p>+{result.xpGained} XP</p>
        </div>
      ) : null}
    </div>
  );
}
