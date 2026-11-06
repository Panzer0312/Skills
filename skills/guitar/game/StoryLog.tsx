import { currentChapter, reachedBeats, type GameState } from "@skills/core";
import { Link } from "react-router-dom";
import { GAME_BASE, gameContent, isDone, story } from "./api.js";

/** The current chapter, the lessons that fit it and the story so far, atop the library overview. */
export function StoryLog({ state, titles }: { state: GameState; titles: Record<string, string> }) {
  const chapter = currentChapter(story, gameContent.road, state.lessons);
  const beats = reachedBeats(story, gameContent.road, state.lessons);
  return (
    <section className="story-log game-panel" aria-label="Geschichte">
      <h2>{chapter.title}</h2>
      <p>{chapter.intro}</p>
      {chapter.theoryLessons.length > 0 ? (
        <>
          <h3>Passt zu diesem Kapitel</h3>
          <ul>
            {chapter.theoryLessons.map((id) => (
              <li key={id}>
                <Link to={`${GAME_BASE}/bibliothek/${id}`} className="underline">
                  {titles[id] ?? id}
                </Link>
                {isDone(state.lessons[id]) ? <small> · erledigt</small> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {beats.length > 0 ? (
        <details>
          <summary>Bisherige Geschichte</summary>
          <ul>
            {beats.map((beat) => (
              <li key={beat.id}>
                <strong>{beat.title}</strong>
                {beat.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
