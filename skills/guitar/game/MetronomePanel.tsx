import { defaultAccents, SUBDIVISIONS, type Subdivision } from "@skills/core";
import { useEffect, useRef, useState } from "react";
import { usePersistentState } from "../../../packages/web/src/app/usePersistentState.js";
import type { useMetronome } from "../../../packages/web/src/audio/useMetronome.js";

const BEAT_OPTIONS = [2, 3, 4, 5, 6, 7];

interface StoredMetronome {
  beatsPerBar: number;
  subdivision: Subdivision;
  accents: boolean[];
  stepBpm: number;
  everyBars: number;
}

const DEFAULTS: StoredMetronome = {
  beatsPerBar: 4,
  subdivision: "viertel",
  accents: defaultAccents(4),
  stepBpm: 4,
  everyBars: 2,
};

function isStoredMetronome(raw: unknown): raw is StoredMetronome {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.beatsPerBar === "number" &&
    BEAT_OPTIONS.includes(r.beatsPerBar) &&
    typeof r.subdivision === "string" &&
    r.subdivision in SUBDIVISIONS &&
    Array.isArray(r.accents) &&
    r.accents.every((a) => typeof a === "boolean") &&
    typeof r.stepBpm === "number" &&
    r.stepBpm >= 1 &&
    r.stepBpm <= 50 &&
    typeof r.everyBars === "number" &&
    r.everyBars >= 1 &&
    r.everyBars <= 32
  );
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function MetronomePanel({
  metronome,
}: {
  metronome: ReturnType<typeof useMetronome>;
}) {
  const [targetBpm, setTargetBpm] = useState(() => metronome.bpm + 20);
  const [stored, setStored] = usePersistentState("guitar.metronome", DEFAULTS, isStoredMetronome);
  const [stepBpm, setStepBpmRaw] = useState(stored.stepBpm);
  const [everyBars, setEveryBarsRaw] = useState(stored.everyBars);
  const { bpm, running, speedTrainer, error } = metronome;

  // While a run is on, the live tempo climbs towards the target and must not trigger this.
  const targetTooLow = !speedTrainer && targetBpm <= bpm;
  const valid = !targetTooLow && stepBpm >= 1 && everyBars >= 1;

  // Apply the remembered setup once; setBeatsPerBar resets the accents, so toggle afterwards.
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    metronome.setBeatsPerBar(stored.beatsPerBar);
    metronome.setSubdivision(stored.subdivision);
    if (stored.accents.length === stored.beatsPerBar) {
      const base = defaultAccents(stored.beatsPerBar);
      stored.accents.forEach((on, beat) => {
        if (on !== base[beat]) metronome.toggleAccent(beat);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A half-typed trainer field must not make the whole stored setup invalid.
  const remember = (patch: Partial<StoredMetronome>) => {
    const next = {
      beatsPerBar: metronome.beatsPerBar,
      subdivision: metronome.subdivision,
      accents: metronome.accents,
      stepBpm,
      everyBars,
      ...patch,
    };
    setStored({
      ...next,
      stepBpm: clamp(next.stepBpm, 1, 50, stored.stepBpm),
      everyBars: clamp(next.everyBars, 1, 32, stored.everyBars),
    });
  };
  const setStepBpm = (value: number) => {
    setStepBpmRaw(value);
    remember({ stepBpm: value });
  };
  const setEveryBars = (value: number) => {
    setEveryBarsRaw(value);
    remember({ everyBars: value });
  };

  const startTrainer = () => {
    metronome.setSpeedTrainer({ startBpm: bpm, targetBpm, stepBpm, everyBars });
    if (!running) metronome.start();
  };

  return (
    <section aria-label="Metronom" className="quest-metronome">
      <button
        type="button"
        className="game-button"
        onClick={() => (running ? metronome.stop() : metronome.start())}
      >
        Metronom {running ? "stoppen" : "starten"}
      </button>
      <div className="quest-bpm">
        <input
          type="range"
          aria-label="BPM"
          min={20}
          max={300}
          value={bpm}
          onChange={(event) => metronome.setBpm(Number(event.target.value))}
        />
        <output>{bpm} BPM</output>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" className="game-button" onClick={metronome.tap}>
        Tap
      </button>
      <label className="quest-field">
        Takt
        <select
          value={metronome.beatsPerBar}
          onChange={(event) => {
            const beats = Number(event.target.value);
            metronome.setBeatsPerBar(beats);
            remember({ beatsPerBar: beats, accents: defaultAccents(beats) });
          }}
        >
          {BEAT_OPTIONS.map((beats) => (
            <option key={beats} value={beats}>
              {beats}
            </option>
          ))}
        </select>
      </label>
      <label className="quest-field">
        Unterteilung
        <select
          value={metronome.subdivision}
          onChange={(event) => {
            const subdivision = event.target.value as Subdivision;
            metronome.setSubdivision(subdivision);
            remember({ subdivision });
          }}
        >
          {(Object.keys(SUBDIVISIONS) as Subdivision[]).map((key) => (
            <option key={key} value={key}>
              {SUBDIVISIONS[key].label}
            </option>
          ))}
        </select>
      </label>
      <div className="quest-accents">
        {metronome.accents.map((on, beat) => (
          <button
            // Beats are positional and the list is rebuilt when the beat count changes.
            key={beat}
            type="button"
            className="game-button quest-accent"
            aria-pressed={on}
            aria-label={`Betonung Schlag ${beat + 1}`}
            onClick={() => {
              metronome.toggleAccent(beat);
              remember({
                accents: metronome.accents.map((a, i) => (i === beat ? !a : a)),
              });
            }}
          >
            {beat + 1}
          </button>
        ))}
      </div>
      {speedTrainer ? (
        <div className="quest-field">
          <p>
            Tempotrainer: {bpm} → {speedTrainer.targetBpm} BPM
          </p>
          <button
            type="button"
            className="game-button"
            onClick={() => metronome.setSpeedTrainer(null)}
          >
            Tempotrainer stoppen
          </button>
        </div>
      ) : null}
      {speedTrainer ? null : (
        <details className="quest-trainer">
          <summary>Tempotrainer</summary>

          <div className="quest-field">
            <label>
              Bis
              <input
                type="number"
                min={21}
                max={300}
                value={targetBpm}
                onChange={(event) => setTargetBpm(Number(event.target.value))}
              />
            </label>
            <label>
              Plus
              <input
                type="number"
                min={1}
                max={50}
                value={stepBpm}
                onChange={(event) => setStepBpm(Number(event.target.value))}
              />
            </label>
            <label>
              Alle (Takte)
              <input
                type="number"
                min={1}
                max={32}
                value={everyBars}
                onChange={(event) => setEveryBars(Number(event.target.value))}
              />
            </label>
            {targetTooLow ? (
              <p role="alert">Das Ziel muss über dem aktuellen Tempo liegen.</p>
            ) : null}
            <button
              type="button"
              className="game-button"
              disabled={!valid}
              onClick={startTrainer}
            >
              Tempotrainer starten
            </button>
          </div>
        </details>
      )}
    </section>
  );
}
