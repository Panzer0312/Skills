import type { GameState } from "@skills/core";
import { Link } from "react-router-dom";
import { GAME_BASE } from "./api.js";
import { spriteUrl } from "./assets.js";

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function StatusBar({ state }: { state: GameState | undefined }) {
  return (
    <header className="game-hud">
      {state ? (
        <>
          <span className="game-stat">
            <img src={spriteUrl("helm")} alt="" /> <b>Level {state.level}</b> {state.title}
          </span>
          <span className="game-stat">
            XP{" "}
            <span
              className="game-bar"
              role="progressbar"
              aria-label="Erfahrung"
              aria-valuemin={0}
              aria-valuemax={state.xpForNext}
              aria-valuenow={state.xpIntoLevel}
            >
              <i style={{ width: `${Math.min(100, (state.xpIntoLevel / state.xpForNext) * 100)}%` }} />
            </span>{" "}
            {state.xpIntoLevel}/{state.xpForNext}
          </span>
          <span className="game-stat">
            <img src={spriteUrl("torch")} alt="" /> <b>{state.streak}</b> {state.streak === 1 ? "Tag" : "Tage"} Serie
          </span>
          <span className="game-stat">
            <img src={spriteUrl("goldbag")} alt="" /> <b>{formatTime(state.totalSeconds)}</b> gesamt
          </span>
          <span className="game-stat">
            <b>{formatTime(state.weekSeconds)}</b> diese Woche
          </span>
        </>
      ) : null}
      <Link to={GAME_BASE} className="game-home">
        Zum Dorf
      </Link>
      <Link to="/" className="game-home game-exit">
        Zur App
      </Link>
    </header>
  );
}
