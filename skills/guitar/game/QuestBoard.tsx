import { bestNext, type GameState, type QuestDefinition } from "@skills/core";
import { useState } from "react";
import { Link } from "react-router-dom";
import { GAME_BASE, gameContent, questLevel, useGameState } from "./api.js";
import { spriteUrl } from "./assets.js";
import { LevelPicker } from "./ResultDialog.js";
import { SESSION_LENGTHS, useTodaySet } from "./useTodaySet.js";
import { QUEST_SPRITE } from "./Village.js";

const ROAD_DONE_REASON = "Die Hauptstraße ist geschafft. Flüssige Wechsel bleiben dein bester täglicher Schritt.";

function LevelDots({ level }: { level: number }) {
  return (
    <span role="img" aria-label={`Stufe ${level} von 10`} className="quest-dots">
      {Array.from({ length: 10 }, (_, index) => (
        <i key={index} className={index < level ? "on" : undefined} />
      ))}
    </span>
  );
}

function QuestRow({
  quest,
  state,
  canRemove,
  onRemove,
}: {
  quest: QuestDefinition;
  state: GameState;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const level = questLevel(state, quest);
  return (
    <li className="quest-row">
      <div className="quest-row-main">
        <Link to={`${GAME_BASE}/quest/${quest.id}`} className="game-quest">
          <img src={spriteUrl(QUEST_SPRITE[quest.kind])} alt="" />
          <span>
            {quest.title}
            <small>
              {quest.minutes} min
              {state.doneToday.includes(quest.id) ? " · erledigt" : ""}
            </small>
          </span>
        </Link>
        <LevelDots level={level} />
        <div className="quest-buttons">
          <button
            type="button"
            className="game-button"
            aria-label={`Stufe von ${quest.title} ändern`}
            aria-expanded={editing}
            onClick={() => setEditing(!editing)}
          >
            Stufe
          </button>
          <button
            type="button"
            className="game-button"
            aria-label={`${quest.title} entfernen`}
            disabled={!canRemove}
            onClick={onRemove}
          >
            Entfernen
          </button>
        </div>
      </div>
      {editing ? (
        <LevelPicker techniqueId={quest.techniqueId} initial={level} onSaved={() => setEditing(false)} />
      ) : null}
    </li>
  );
}

function Board({ state, fetching }: { state: GameState; fetching: boolean }) {
  const { quests, missing, minutes, saving, failed, save, build } = useTodaySet(state, fetching);

  const next = bestNext(gameContent.road, state.lessons);
  const nextQuest = gameContent.quests.find((quest) => (next ? quest.id === next.questId : quest.kind === "wechsel"));
  const chosen = new Set(quests.map((quest) => quest.id));
  const others = gameContent.quests.filter((quest) => !chosen.has(quest.id));
  const ids = quests.map((quest) => quest.id);

  return (
    <section className="game-panel quest-board">
      <h1>Quest Board</h1>
      <div className="quest-buttons" role="group" aria-label="Sitzungslänge">
        {SESSION_LENGTHS.map((length) => (
          <button
            key={length}
            type="button"
            className="game-button"
            aria-pressed={length === minutes}
            disabled={saving}
            onClick={() => {
              if (length !== minutes) void build(length);
            }}
          >
            {length} min
          </button>
        ))}
      </div>

      {failed ? (
        <div role="alert" className="game-error">
          <p>{failed.message}</p>
          <button
            type="button"
            className="game-button"
            onClick={() => void save(failed.minutes, failed.questIds)}
          >
            Erneut versuchen
          </button>
        </div>
      ) : null}

      <div className="quest-next">
        <h2>Bester nächster Schritt</h2>
        {nextQuest ? <p>{nextQuest.title}</p> : null}
        <p>{next ? next.reason : ROAD_DONE_REASON}</p>
        {next && state.lessons[next.lessonId] === "aktiv" ? (
          <Link to={`${GAME_BASE}/bibliothek/${next.lessonId}`} className="underline">
            Checkpoint bestätigen
          </Link>
        ) : null}
      </div>

      {missing && !failed ? <p>Wird zusammengestellt…</p> : null}
      <ul className="quest-list">
        {quests.map((quest) => (
          <QuestRow
            key={quest.id}
            quest={quest}
            state={state}
            canRemove={quests.length > 1 && !saving}
            onRemove={() =>
              void save(
                minutes,
                ids.filter((id) => id !== quest.id),
              )
            }
          />
        ))}
      </ul>

      <details className="quest-swap">
        <summary>Quest hinzufügen</summary>
        <ul>
          {others.map((quest) => (
            <li key={quest.id}>
              <span>
                {quest.title} · {quest.minutes} min
              </span>
              <button
                type="button"
                className="game-button"
                aria-label={`${quest.title} hinzufügen`}
                disabled={saving}
                onClick={() => void save(minutes, [...ids, quest.id])}
              >
                Hinzufügen
              </button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

export function QuestBoard() {
  const { data: state, isFetching } = useGameState();
  if (!state) return null;
  return <Board state={state} fetching={isFetching} />;
}
