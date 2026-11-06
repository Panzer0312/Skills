import { SUBDIVISIONS, type Subdivision } from "@skills/core";
import { useState } from "react";
import type { useMetronome } from "../../../packages/web/src/audio/useMetronome.js";

const BEAT_OPTIONS = [2, 3, 4, 5, 6, 7];

export function MetronomePanel({
  metronome,
}: {
  metronome: ReturnType<typeof useMetronome>;
}) {
  const [targetBpm, setTargetBpm] = useState(100);
  const [stepBpm, setStepBpm] = useState(4);
  const [everyBars, setEveryBars] = useState(2);
  const { bpm, running, speedTrainer } = metronome;

  const targetTooLow = targetBpm <= bpm;
  const valid = !targetTooLow && stepBpm >= 1 && everyBars >= 1;

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
      <button type="button" className="game-button" onClick={metronome.tap}>
        Tap
      </button>
      <label className="quest-field">
        Takt
        <select
          value={metronome.beatsPerBar}
          onChange={(event) =>
            metronome.setBeatsPerBar(Number(event.target.value))
          }
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
          onChange={(event) =>
            metronome.setSubdivision(event.target.value as Subdivision)
          }
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
            onClick={() => metronome.toggleAccent(beat)}
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
    </section>
  );
}
