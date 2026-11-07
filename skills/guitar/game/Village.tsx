import type { GameState, QuestDefinition } from "@skills/core";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { GAME_BASE, useGameState } from "./api.js";
import { spriteUrl, type SpriteName } from "./assets.js";
import { PLACES } from "./placeRegistry.js";
import { MentorCard } from "./MentorCard.js";
import { useTodaySet } from "./useTodaySet.js";

export const QUEST_SPRITE: Record<QuestDefinition["kind"], SpriteName> = {
  wechsel: "sword",
  technik: "shield",
  song: "chest",
  theorie: "scroll",
  aufwaermen: "potion",
};

function TodayPanel({
  state,
  quests,
  failure,
}: {
  state: GameState;
  quests: QuestDefinition[];
  failure: string | null;
}) {
  return (
    <section className="village-today game-panel" aria-label="Heutige Quests">
      <h2>
        Heute
        {state.today && quests.length > 0 ? ` · ${state.today.minutes} min` : ""}
      </h2>
      {failure !== null ? (
        <>
          <p role="alert" className="game-error">
            {failure}
          </p>
          <Link to={`${GAME_BASE}/quests`} className="game-quest">
            <img src={spriteUrl("scroll")} alt="" />
            <span>Heutige Quests zusammenstellen</span>
          </Link>
        </>
      ) : quests.length === 0 ? (
        <p>Wird zusammengestellt…</p>
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

function VillageView({ state, fetching }: { state: GameState; fetching: boolean }) {
  const { quests, failed } = useTodaySet(state, fetching);
  const open = quests.filter((quest) => !state.doneToday.includes(quest.id)).length;

  return (
    <div className="village">
      <TodayPanel state={state} quests={quests} failure={quests.length === 0 ? (failed?.message ?? null) : null} />
      <MentorCard state={state} />
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
        <Sign path="markt" x={34} y={68} label="Market" hint="Ausrüstung" />
      </nav>
      <nav className="village-menu" aria-label="Werkzeuge">
        {PLACES.filter((place) => place.inMenu).map((item) => (
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

export function Village() {
  const { data: state, isFetching } = useGameState();
  if (!state) return null;
  return <VillageView state={state} fetching={isFetching} />;
}
