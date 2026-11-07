import { displayNote, JAM_STYLES, NOTES, SCALES, type JamStyle } from "@skills/core";
import { usePersistentState } from "../../../../packages/web/src/app/usePersistentState.js";
import { usePracticeKeys } from "../../../../packages/web/src/app/usePracticeKeys.js";
import { useWakeLock } from "../../../../packages/web/src/app/useWakeLock.js";
import { FretOverlay } from "../FretOverlay.js";
import { ToolFrame } from "../Places.js";
import { useJamEngine } from "./useJamEngine.js";

const MIN_BPM = 50;
const MAX_BPM = 220;
const BOXES = [1, 2, 3, 4, 5] as const;

type Box = (typeof BOXES)[number];

interface StoredJam {
  root: string;
  style: JamStyle;
  bpm: number;
  box?: Box;
  volume: number;
}

const DEFAULTS: StoredJam = { root: "E", style: "rock", bpm: 90, volume: 0.7 };

function isStoredJam(raw: unknown): raw is StoredJam {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.root === "string" &&
    (NOTES as readonly string[]).includes(r.root) &&
    typeof r.style === "string" &&
    r.style in JAM_STYLES &&
    typeof r.bpm === "number" &&
    r.bpm >= MIN_BPM &&
    r.bpm <= MAX_BPM &&
    (r.box === undefined || (BOXES as readonly unknown[]).includes(r.box)) &&
    typeof r.volume === "number" &&
    r.volume >= 0 &&
    r.volume <= 1
  );
}

export function JamRoom() {
  const [settings, setSettings] = usePersistentState("guitar.jam", DEFAULTS, isStoredJam);
  const { root, style, bpm, volume, box } = settings;
  const update = (patch: Partial<StoredJam>) => setSettings({ ...settings, ...patch });
  const setRoot = (value: string) => update({ root: value });
  const setStyle = (value: JamStyle) => update({ style: value });
  const setBpm = (value: number) => update({ bpm: value });
  const setVolume = (value: number) => update({ volume: value });
  const setBox = (value: Box | undefined) => update({ box: value });

  const { running, start, stop, chord, nextChord, error } = useJamEngine({ root, style, bpm, volume });
  useWakeLock(running);
  usePracticeKeys({ " ": () => (running ? stop() : start()) });
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
