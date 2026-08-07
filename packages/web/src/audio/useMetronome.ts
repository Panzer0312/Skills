import { useCallback, useEffect, useRef, useState } from "react";

const MIN_BPM = 20;
const MAX_BPM = 300;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;

export function useMetronome() {
  const [bpm, setBpmRaw] = useState(80);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [running, setRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);

  const contextRef = useRef<AudioContext | null>(null);
  const nextNoteRef = useRef(0);
  const beatRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tapsRef = useRef<number[]>([]);

  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;
  const beatsRef = useRef(beatsPerBar);
  beatsRef.current = beatsPerBar;

  const setBpm = useCallback((value: number) => {
    setBpmRaw(Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value))));
  }, []);

  const click = useCallback((time: number, accented: boolean) => {
    const context = contextRef.current;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = accented ? 1600 : 900;
    gain.gain.setValueAtTime(0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.06);
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
    timerRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    beatRef.current = 0;
    setCurrentBeat(0);
    setRunning(false);
  }, []);

  const start = useCallback(() => {
    if (timerRef.current !== null) return;

    const context = new AudioContext();
    contextRef.current = context;
    void context.resume();
    nextNoteRef.current = context.currentTime + 0.05;
    beatRef.current = 0;

    // Scheduling ahead of time keeps the click steady; setInterval alone drifts.
    timerRef.current = setInterval(() => {
      const ctx = contextRef.current;
      if (!ctx) return;
      while (nextNoteRef.current < ctx.currentTime + SCHEDULE_AHEAD_S) {
        const beat = beatRef.current % beatsRef.current;
        click(nextNoteRef.current, beat === 0);
        setCurrentBeat(beat);
        nextNoteRef.current += 60 / bpmRef.current;
        beatRef.current += 1;
      }
    }, LOOKAHEAD_MS);

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

  return { bpm, setBpm, beatsPerBar, setBeatsPerBar, running, start, stop, tap, currentBeat };
}
