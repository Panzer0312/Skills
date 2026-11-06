import { displayNote, JAM_STYLES, NOTES, SCALES, type JamStyle } from "@skills/core";
import { useState } from "react";
import { FretOverlay } from "../FretOverlay.js";
import { ToolFrame } from "../Places.js";
import { useJamEngine } from "./useJamEngine.js";

const MIN_BPM = 50;
const MAX_BPM = 220;
const BOXES = [1, 2, 3, 4, 5] as const;

export function JamRoom() {
  const [root, setRoot] = useState("E");
  const [style, setStyle] = useState<JamStyle>("rock");
  const [bpm, setBpm] = useState(90);
  const [volume, setVolume] = useState(0.7);
  const [box, setBox] = useState<(typeof BOXES)[number] | undefined>(undefined);

  const { running, start, stop, chord, nextChord, error } = useJamEngine({ root, style, bpm, volume });
  const supported = typeof AudioContext !== "undefined";
  const scale = JAM_STYLES[style].scale;
  const pentatonic = scale === "moll-pentatonik";

  return (
    <ToolFrame title="Jam Room">
      <section aria-label="Begleitung" className="jam-room">
        {error && (
          <p role="alert" className="game-error">
            {error}
          </p>
        )}
        {!supported && (
          <p role="alert" className="game-error">
            Dein Browser kann keinen Ton erzeugen. Probiere einen aktuellen Browser auf dem PC.
          </p>
        )}
        <div className="jam-controls">
          <label className="quest-field">
            Tonart
            <select value={root} onChange={(event) => setRoot(event.target.value)}>
              {NOTES.map((note) => (
                <option key={note} value={note}>
                  {displayNote(note)}
                </option>
              ))}
            </select>
          </label>
          <label className="quest-field">
            Stil
            <select value={style} onChange={(event) => setStyle(event.target.value as JamStyle)}>
              {Object.entries(JAM_STYLES).map(([id, info]) => (
                <option key={id} value={id}>
                  {info.label}
                </option>
              ))}
            </select>
          </label>
          {pentatonic && (
            <label className="quest-field">
              Box
              <select
                value={box ?? ""}
                onChange={(event) =>
                  setBox(event.target.value === "" ? undefined : (Number(event.target.value) as (typeof BOXES)[number]))
                }
              >
                <option value="">Ganze Tonleiter</option>
                {BOXES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="quest-bpm">
            <input
              type="range"
              aria-label="Tempo"
              min={MIN_BPM}
              max={MAX_BPM}
              value={bpm}
              onChange={(event) => setBpm(Number(event.target.value))}
            />
            <output>{bpm} BPM</output>
          </div>
          <label className="quest-field">
            Lautstärke
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            className="game-button"
            disabled={!supported}
            onClick={() => (running ? stop() : start())}
          >
            {running ? "Stoppen" : "Starten"}
          </button>
        </div>
        <p className="jam-chords" aria-live="off">
          Akkord: <strong data-testid="jam-chord">{chord ? displayNote(chord) : "–"}</strong> · Danach:{" "}
          <span data-testid="jam-next">{nextChord ? displayNote(nextChord) : "–"}</span>
        </p>
        <p>
          Spiele dazu: {displayNote(root)} {SCALES[scale].label}
        </p>
        <FretOverlay root={root} scale={scale} box={pentatonic ? box : undefined} />
      </section>
    </ToolFrame>
  );
}
