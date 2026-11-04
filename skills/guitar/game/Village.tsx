import type { GameState, QuestDefinition } from "@skills/core";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { GAME_BASE, todaysQuests, useGameState } from "./api.js";
import { spriteUrl, type SpriteName } from "./assets.js";

export const QUEST_SPRITE: Record<QuestDefinition["kind"], SpriteName> = {
  wechsel: "sword",
  technik: "shield",
  song: "chest",
  theorie: "scroll",
  aufwaermen: "potion",
};

const MENU: { path: string; label: string; hint: string; sprite: SpriteName }[] = [
  { path: "schrein", label: "Shrine", hint: "Stimmgerät", sprite: "ring" },
  { path: "schmiede", label: "Forge", hint: "Akkordgriffe", sprite: "sword" },
  { path: "griffbrett", label: "Griffbrett", hint: "Töne und Skalen", sprite: "bow" },
  { path: "chronik", label: "Chronicle", hint: "dein Fortschritt", sprite: "parchment" },
];

function TodayPanel({ state }: { state: GameState }) {
  const quests = todaysQuests(state);
  return (
    <section className="village-today game-panel" aria-label="Heutige Quests">
      <h2>Heute{state.today && quests.length > 0 ? ` · ${state.today.minutes} min` : ""}</h2>
      {quests.length === 0 ? (
        <Link to={`${GAME_BASE}/quests`} className="game-quest">
          <img src={spriteUrl("scroll")} alt="" />
          <span>Heutige Quests zusammenstellen</span>
        </Link>
      ) : (
        quests.map((quest) => (
          <Link key={quest.id} to={`${GAME_BASE}/quest/${quest.id}`} className="game-quest">
            <img src={spriteUrl(QUEST_SPRITE[quest.kind])} alt="" />
            <span>
              {quest.title}
              <small>
                {quest.minutes} min
                {state.doneToday.includes(quest.id) ? " · erledigt" : ""}
              </small>
            </span>
          </Link>
        ))
      )}
    </section>
  );
}

function Sign({ path, x, y, label, hint }: { path: string; x: number; y: number; label: string; hint: string }) {
  const position = { "--x": `${x}%`, "--y": `${y}%` } as CSSProperties;
  return (
    <Link to={`${GAME_BASE}/${path}`} className="village-sign" style={position}>
      {label}
      <small>{hint}</small>
    </Link>
  );
}

export function Village() {
  const { data: state } = useGameState();
  if (!state) return null;
  const quests = todaysQuests(state);
  const open = quests.filter((quest) => !state.doneToday.includes(quest.id)).length;

  return (
    <div className="village">
      <TodayPanel state={state} />
      <nav className="village-map" aria-label="Dorf">
        <img src={spriteUrl("village")} alt="" />
        <Sign
          path="quests"
          x={22}
          y={24}
          label="Quest Board"
          hint={quests.length > 0 ? `${open} offen heute` : "Quests wählen"}
        />
        <Sign path="taverne" x={57} y={20} label="Tavern" hint="deine Songs" />
        <Sign path="bibliothek" x={87} y={14} label="Library" hint="Lektionen" />
        <Sign path="hafen" x={68} y={72} label="Harbor" hint="die Reise" />
        <Sign path="markt" x={34} y={68} label="Market" hint="öffnet bald" />
      </nav>
      <nav className="village-menu" aria-label="Werkzeuge">
        {MENU.map((item) => (
          <Link key={item.path} to={`${GAME_BASE}/${item.path}`} className="game-quest">
            <img src={spriteUrl(item.sprite)} alt="" />
            <span>
              {item.label}
              <small>{item.hint}</small>
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
