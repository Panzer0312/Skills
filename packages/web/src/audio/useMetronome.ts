import {
  clickLevel,
  defaultAccents,
  speedTrainerBpm,
  SUBDIVISIONS,
  type ClickLevel,
  type SpeedTrainer,
  type Subdivision,
} from "@skills/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { startLookahead } from "./lookahead.js";

const MIN_BPM = 20;
const MAX_BPM = 300;

const CLICKS: Record<
  Exclude<ClickLevel, "stumm">,
  { frequency: number; gain: number }
> = {
  betont: { frequency: 1600, gain: 0.6 },
  schlag: { frequency: 900, gain: 0.6 },
  unter: { frequency: 600, gain: 0.3 },
};

export function useMetronome() {
  const [bpm, setBpmRaw] = useState(80);
  const [beatsPerBar, setBeatsPerBarRaw] = useState(4);
  const [running, setRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [subdivision, setSubdivision] = useState<Subdivision>("viertel");
  const [accents, setAccents] = useState<boolean[]>(() => defaultAccents(4));
  const [speedTrainer, setSpeedTrainerRaw] = useState<SpeedTrainer | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);

  const contextRef = useRef<AudioContext | null>(null);
  const stopLookaheadRef = useRef<(() => void) | null>(null);
  const tapsRef = useRef<number[]>([]);

  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;
  const beatsRef = useRef(beatsPerBar);
  beatsRef.current = beatsPerBar;
  const subdivisionRef = useRef(subdivision);
  subdivisionRef.current = subdivision;
  const accentsRef = useRef(accents);
  accentsRef.current = accents;
  const trainerRef = useRef(speedTrainer);
  trainerRef.current = speedTrainer;

  const barsRef = useRef(0);
  const trainerStartBarRef = useRef(0);

  const setSpeedTrainer = useCallback((value: SpeedTrainer | null) => {
    trainerRef.current = value;
    trainerStartBarRef.current = barsRef.current;
    setSpeedTrainerRaw(value);
  }, []);

  // A tempo chosen by hand always wins over the speed trainer.
  const setBpm = useCallback(
    (value: number) => {
      setSpeedTrainer(null);
      setBpmRaw(Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value))));
    },
    [setSpeedTrainer],
  );

  const setBeatsPerBar = useCallback((value: number) => {
    setBeatsPerBarRaw(value);
    setAccents(defaultAccents(value));
  }, []);

  const toggleAccent = useCallback((beat: number) => {
    setAccents((current) =>
      current.map((on, index) => (index === beat ? !on : on)),
    );
  }, []);

  const click = useCallback((time: number, level: ClickLevel) => {
    const context = contextRef.current;
    if (!context || level === "stumm") return;
    const { frequency, gain: volume } = CLICKS[level];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.06);
  }, []);

  const stop = useCallback(() => {
    stopLookaheadRef.current?.();
    stopLookaheadRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    // A trainer left set would restart at its start tempo on the next start.
    setSpeedTrainer(null);
    setCurrentBeat(0);
    setRunning(false);
  }, [setSpeedTrainer]);

  const start = useCallback(() => {
    if (stopLookaheadRef.current) return;

    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      contextRef.current = context;
      void context.resume();

      let stepInBeat = 0;
      let beat = 0;
      barsRef.current = 0;
      trainerStartBarRef.current = 0;
      stopLookaheadRef.current = startLookahead({
        context,
        stepSeconds: () =>
          60 /
          bpmRef.current /
          SUBDIVISIONS[subdivisionRef.current].pattern.length,
        onStep: (time) => {
          const stepsPerBeat =
            SUBDIVISIONS[subdivisionRef.current].pattern.length;
          if (stepInBeat >= stepsPerBeat) {
            stepInBeat = 0;
            beat += 1;
          }
          if (beat >= beatsRef.current) {
            beat = 0;
            barsRef.current += 1;
          }
          const trainer = trainerRef.current;
          if (trainer && beat === 0 && stepInBeat === 0) {
            const next = speedTrainerBpm(
              trainer,
              barsRef.current - trainerStartBarRef.current,
            );
            if (next !== bpmRef.current) {
              bpmRef.current = next;
              setBpmRaw(next);
            }
          }
          click(
            time,
            clickLevel(beat * stepsPerBeat + stepInBeat, {
              beatsPerBar: beatsRef.current,
              subdivision: subdivisionRef.current,
              accents: accentsRef.current,
            }),
          );
          if (stepInBeat === 0) setCurrentBeat(beat);
          stepInBeat += 1;
        },
      });
    } catch {
      stopLookaheadRef.current?.();
      stopLookaheadRef.current = null;
      void context?.close();
      contextRef.current = null;
      setRunning(false);
      setError("Der Ton konnte nicht gestartet werden. Prüfe die Audioausgabe des Browsers.");
      return;
    }

    setError(null);
    setRunning(true);
  }, [click]);

  const tap = useCallback(() => {
    const now = Date.now();
    const taps = tapsRef.current.filter((t) => now - t < 3000);
    taps.push(now);
    tapsRef.current = taps;

    if (taps.length < 2) return;
    const gaps: number[] = [];
    for (let i = 1; i < taps.length; i += 1) gaps.push(taps[i]! - taps[i - 1]!);
    const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    if (average > 0) setBpm(60_000 / average);
  }, [setBpm]);

  useEffect(() => stop, [stop]);

  return {
    bpm,
    setBpm,
    beatsPerBar,
    setBeatsPerBar,
    running,
    start,
    stop,
    tap,
    currentBeat,
    subdivision,
    setSubdivision,
    accents,
    toggleAccent,
    speedTrainer,
    setSpeedTrainer,
    error,
  };
}
