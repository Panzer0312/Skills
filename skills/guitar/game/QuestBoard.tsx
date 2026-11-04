import { bestNext, buildDailyQuests, type GameState, type QuestDefinition } from "@skills/core";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GAME_BASE, gameApi, gameContent, questLevel, todaysQuests, useGameState } from "./api.js";
import { spriteUrl } from "./assets.js";
import { LevelPicker } from "./ResultDialog.js";
import { QUEST_SPRITE } from "./Village.js";

const SESSION_LENGTHS = [10, 20, 30, 45];
const DEFAULT_MINUTES = 30;

interface FailedSave {
  message: string;
  minutes: number;
  questIds: string[];
}

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
  const quests = todaysQuests(state);
  const missing = quests.length === 0;
  const minutes =
    state.today && SESSION_LENGTHS.includes(state.today.minutes) ? state.today.minutes : DEFAULT_MINUTES;
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<FailedSave | null>(null);
  const savingRef = useRef(false);
  const built = useRef(false);

  async function save(length: number, questIds: string[]) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFailed(null);
    try {
      await gameApi.setToday(length, questIds);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
      setFailed({ message, minutes: length, questIds });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function build(length: number) {
    return save(
      length,
      buildDailyQuests({
        minutes: length,
        content: gameContent,
        statuses: state.lessons,
        hasTargetSong: state.targetSongId !== null,
        recentQuestIds: state.recentQuestIds,
      }),
    );
  }

  useEffect(() => {
    // A cached state may be from yesterday, so only a finished fetch can decide.
    if (!missing || fetching || built.current) return;
    built.current = true;
    void build(minutes);
  });

  const next = bestNext(gameContent.road, state.lessons);
  const nextQuest = next ? gameContent.quests.find((quest) => quest.id === next.questId) : undefined;
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

      {next ? (
        <div className="quest-next">
          <h2>Bester nächster Schritt</h2>
          {nextQuest ? <p>{nextQuest.title}</p> : null}
          <p>{next.reason}</p>
        </div>
      ) : null}

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
        <summary>Quest tauschen</summary>
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
