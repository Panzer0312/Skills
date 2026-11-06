import { jamBar, jamChord, JAM_STYLES, type JamHit, type JamSettings, type JamStyle } from "@skills/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { startLookahead } from "../../../../packages/web/src/audio/lookahead.js";
import { gameApi } from "../api.js";

const MAX_SECONDS = 3600;
const MIN_LOG_SECONDS = 60;

export interface JamInput {
  root: string;
  style: JamStyle;
  bpm: number;
  volume: number;
}

const midiToFrequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Fills half a second of white noise, shared by snare and hat. */
function noiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * 0.5);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function envelope(context: AudioContext, destination: AudioNode, time: number, peak: number, length: number) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(peak, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + length);
  gain.connect(destination);
  return gain;
}

function noiseBurst(
  context: AudioContext,
  master: AudioNode,
  noise: AudioBuffer,
  time: number,
  filterType: BiquadFilterType,
  frequency: number,
  peak: number,
  length: number,
) {
  const source = context.createBufferSource();
  source.buffer = noise;
  const filter = context.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  source.connect(filter);
  filter.connect(envelope(context, master, time, peak, length));
  source.start(time);
  source.stop(time + length + 0.02);
}

function play(context: AudioContext, master: AudioNode, noise: AudioBuffer, hit: JamHit, time: number) {
  switch (hit.voice) {
    case "kick": {
      const osc = context.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(50, time + 0.12);
      osc.connect(envelope(context, master, time, 0.7, 0.25));
      osc.start(time);
      osc.stop(time + 0.27);
      return;
    }
    case "snare":
      noiseBurst(context, master, noise, time, "bandpass", 1800, 0.35, 0.15);
      return;
    case "hat":
      noiseBurst(context, master, noise, time, "highpass", 7000, 0.12, 0.05);
      return;
    case "bass": {
      const osc = context.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = midiToFrequency(hit.midi ?? 40);
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 800;
      osc.connect(filter);
      filter.connect(envelope(context, master, time, 0.3, 0.2));
      osc.start(time);
      osc.stop(time + 0.22);
    }
  }
}

/**
 * Generated drums and bass for the Jam Room. Key and style are read at each bar line,
 * so a change never cuts a bar in half; tempo and volume apply at once.
 */
export function useJamEngine({ root, style, bpm, volume }: JamInput) {
  const [running, setRunning] = useState(false);
  const [chord, setChord] = useState<string | null>(null);
  const [nextChord, setNextChord] = useState<string | null>(null);

  const rootRef = useRef(root);
  rootRef.current = root;
  const styleRef = useRef(style);
  styleRef.current = style;
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const contextRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const stopLookaheadRef = useRef<(() => void) | null>(null);
  const limitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (masterRef.current) masterRef.current.gain.value = volume * 0.8;
  }, [volume]);

  const stop = useCallback(() => {
    if (!stopLookaheadRef.current) return;
    stopLookaheadRef.current();
    stopLookaheadRef.current = null;
    if (limitRef.current) clearTimeout(limitRef.current);
    limitRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    masterRef.current = null;
    setRunning(false);
    setChord(null);
    setNextChord(null);

    const seconds = Math.min(MAX_SECONDS, Math.round((Date.now() - startedAtRef.current) / 1000));
    if (seconds >= MIN_LOG_SECONDS) {
      // A failed log must never keep the music on or surface as an unhandled rejection.
      try {
        void Promise.resolve(gameApi.log({ kind: "frei", seconds, level: 1, techniqueId: "jam" })).catch(() => {});
      } catch {
        /* ignore */
      }
    }
  }, []);

  const start = useCallback(() => {
    if (stopLookaheadRef.current || typeof AudioContext === "undefined") return;
    const context = new AudioContext();
    contextRef.current = context;
    void context.resume();
    const master = context.createGain();
    master.gain.value = volumeRef.current * 0.8;
    master.connect(context.destination);
    masterRef.current = master;
    const noise = noiseBuffer(context);

    let settings: JamSettings = { root: rootRef.current, style: styleRef.current };
    let hits: JamHit[] = [];
    let stepsPerBar = JAM_STYLES[settings.style].stepsPerBar;
    let stepInBar = 0;
    let bar = -1;

    startedAtRef.current = Date.now();
    limitRef.current = setTimeout(stop, MAX_SECONDS * 1000);
    stopLookaheadRef.current = startLookahead({
      context,
      stepSeconds: () => 60 / bpmRef.current / (stepsPerBar / 4),
      onStep: (time) => {
        if (stepInBar === 0) {
          bar += 1;
          settings = { root: rootRef.current, style: styleRef.current };
          stepsPerBar = JAM_STYLES[settings.style].stepsPerBar;
          hits = jamBar(settings, bar);
          setChord(jamChord(settings, bar));
          setNextChord(jamChord(settings, bar + 1));
        }
        for (const hit of hits) if (hit.step === stepInBar) play(context, master, noise, hit, time);
        stepInBar = (stepInBar + 1) % stepsPerBar;
      },
    });
    setRunning(true);
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { running, start, stop, chord, nextChord };
}
