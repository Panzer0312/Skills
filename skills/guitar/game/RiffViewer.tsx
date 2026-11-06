import type { Riff } from "@skills/core";
import { Link } from "react-router-dom";
import { useMetronome } from "../../../packages/web/src/audio/useMetronome.js";
import { GAME_BASE, gameContent } from "./api.js";
import { MetronomePanel } from "./MetronomePanel.js";
import { ToolFrame } from "./Places.js";
import { Tab } from "./visuals/index.js";

/**
 * `bpm` overrides the riff's own tempo. `inQuest` leaves out what the quest page already shows:
 * the title and the lesson link.
 */
export function RiffCard({
  riff,
  onTempo,
  bpm = riff.bpm,
  inQuest = false,
}: {
  riff: Riff;
  onTempo: (bpm: number) => void;
  bpm?: number;
  inQuest?: boolean;
}) {
  return (
    <article className="riff-card" aria-label={riff.title}>
      {inQuest ? null : <h2>{riff.title}</h2>}
      <p>{riff.description}</p>
      <Tab titel={inQuest ? undefined : riff.title} zeilen={riff.zeilen} />
      <button type="button" className="game-button" onClick={() => onTempo(bpm)}>
        Metronom auf {bpm} BPM stellen
      </button>
      {inQuest ? null : (
        <Link to={`${GAME_BASE}/bibliothek/${riff.lessonId}`} className="underline">
          Lektion lesen
        </Link>
      )}
      {riff.tuning ? (
        <Link to={`${GAME_BASE}/schrein?stimmung=${encodeURIComponent(riff.tuning)}`} className="underline">
          Stimmung: {riff.tuning}
        </Link>
      ) : null}
    </article>
  );
}

export function Riffs() {
  const metronome = useMetronome();
  return (
    <ToolFrame title="Riffs">
      <div className="quest-view">
        <MetronomePanel metronome={metronome} />
        {gameContent.riffs.map((riff) => (
          <RiffCard key={riff.id} riff={riff} onTempo={metronome.setBpm} />
        ))}
      </div>
    </ToolFrame>
  );
}
