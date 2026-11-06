import { pendingBeat, reachedBeats, type GameState } from "@skills/core";
import { useState } from "react";
import { gameApi, gameContent, story } from "./api.js";

/** The mentor's newest unseen line. It sits below the quest controls and never blocks them. */
export function MentorCard({ state }: { state: GameState }) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  let beat;
  let unseen: string[];
  try {
    const seen = state.storySeen ?? [];
    beat = pendingBeat(story, gameContent.road, state.lessons, seen);
    unseen = reachedBeats(story, gameContent.road, state.lessons)
      .map((b) => b.id)
      .filter((id) => !seen.includes(id));
  } catch {
    return null;
  }
  if (!beat) return null;

  const confirm = async () => {
    setSaving(true);
    setFailed(false);
    try {
      await gameApi.markStorySeen(unseen);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mentor-card game-panel" aria-label="Mentor">
      <h2>
        {story.mentor.name}
        <small> · {story.mentor.role}</small>
      </h2>
      <h3>{beat.title}</h3>
      {beat.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {failed ? (
        <p role="alert" className="game-error">
          Das Speichern hat nicht geklappt. Versuche es noch einmal.
        </p>
      ) : null}
      <button type="button" className="game-button" disabled={saving} onClick={confirm}>
        Weiter
      </button>
    </section>
  );
}
