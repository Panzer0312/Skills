import { buildTips, type GameState, type QuestDefinition } from "@skills/core";
import { useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GAME_BASE, gameContent, questLevel, useGameState } from "./api.js";
import { spriteUrl } from "./assets.js";
import { MORE_COMING } from "./map/TipsBoard.js";
import { LevelPicker } from "./ResultDialog.js";
import { DEFAULT_MINUTES, plannedSet, SESSION_LENGTHS, useTodaySet } from "./useTodaySet.js";
import { QUEST_SPRITE } from "./Village.js";

const ROAD_DONE_REASON = "Der Hauptweg ist geschafft. Flüssige Wechsel bleiben dein bester täglicher Schritt.";

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
        {quest.lessonId !== null ? (
          <Link to={`${GAME_BASE}/hafen/${quest.lessonId}`} className="underline">
            Auf der Karte
          </Link>
        ) : null}
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
  const { quests, missing, minutes, saving, writing, failed, save, build } = useTodaySet(state, fetching);
  const busy = saving || writing;

  const navigate = useNavigate();
  const { best: next, moreComing } = buildTips(gameContent, state.lessons, state.chosenLessons);
  const nextQuest = gameContent.quests.find((quest) => (next ? quest.id === next.questId : quest.kind === "wechsel"));
  const chosen = new Set(quests.map((quest) => quest.id));
  const others = gameContent.quests.filter((quest) => !chosen.has(quest.id));
  const ids = quests.map((quest) => quest.id);
  // A new day starts at the default length, and a chosen quest may not fit into it.
  const tomorrow = plannedSet(state, DEFAULT_MINUTES, state.doneToday);

  /** A missing set is being built and always holds the best next quest. */
  async function startNext(event: MouseEvent, quest: QuestDefinition) {
    if (missing || chosen.has(quest.id)) return;
    event.preventDefault();
    if (await save(minutes, [...ids, quest.id])) navigate(`${GAME_BASE}/quest/${quest.id}`);
  }

  // Chosen lessons join a set that is already built only on request, otherwise tomorrow's.
  const sideRoads = state.chosenLessons.filter((id) => id !== next?.lessonId).flatMap((lessonId) => {
    const node = gameContent.nodes.find((n) => n.id === lessonId);
    if (!node) return [];
    const sideQuest = gameContent.quests.find((q) => q.lessonId === lessonId);
    return [{ node, quest: sideQuest, today: sideQuest ? chosen.has(sideQuest.id) : false }];
  });

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
            disabled={busy}
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
        <p>{next ? next.reason : moreComing ? MORE_COMING : ROAD_DONE_REASON}</p>
        {nextQuest ? (
          <Link
            to={`${GAME_BASE}/quest/${nextQuest.id}`}
            className="underline"
            onClick={(event) => void startNext(event, nextQuest)}
          >
            Quest starten
          </Link>
        ) : null}
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
            canRemove={quests.length > 1 && !busy}
            onRemove={() =>
              void save(
                minutes,
                ids.filter((id) => id !== quest.id),
              )
            }
          />
        ))}
      </ul>

      {sideRoads.length > 0 ? (
        <div className="quest-side">
          <h2>Nebenwege</h2>
          <ul>
            {sideRoads.map(({ node, quest: sideQuest, today }) => (
              <li key={node.id}>
                <Link to={`${GAME_BASE}/hafen/${node.id}`} className="underline">
                  {node.title}
                </Link>
                {sideQuest && !today ? (
                  <>
                    {" "}
                    {tomorrow.includes(sideQuest.id) ? <small>Morgen dabei</small> : null}{" "}
                    <button
                      type="button"
                      className="game-button"
                      aria-label={`${node.title} heute dazunehmen`}
                      disabled={busy}
                      onClick={() => void save(minutes, [...ids, sideQuest.id])}
                    >
                      Heute dazunehmen
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
                disabled={busy}
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
