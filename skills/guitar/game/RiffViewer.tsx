import type { Riff } from "@skills/core";
import { Link } from "react-router-dom";
import { useMetronome } from "../../../packages/web/src/audio/useMetronome.js";
import { GAME_BASE, gameContent } from "./api.js";
import { MetronomePanel } from "./MetronomePanel.js";
import { ToolFrame } from "./Places.js";
import { Tab } from "./visuals/index.js";

export function RiffCard({ riff, onTempo }: { riff: Riff; onTempo: (bpm: number) => void }) {
  return (
    <article className="riff-card" aria-label={riff.title}>
      <h2>{riff.title}</h2>
      <p>{riff.description}</p>
      <Tab titel={riff.title} zeilen={riff.zeilen} />
      <button type="button" className="game-button" onClick={() => onTempo(riff.bpm)}>
        Metronom auf {riff.bpm} BPM stellen
      </button>
      <Link to={`${GAME_BASE}/bibliothek/${riff.lessonId}`} className="underline">
        Lektion lesen
      </Link>
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
