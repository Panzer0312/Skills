import type { PracticeRating, QuestDefinition } from "@skills/core";
import { useRef, useState } from "react";
import { gameApi, type LogResult } from "./api.js";

const RATINGS: { value: PracticeRating; label: string }[] = [
  { value: "zu-leicht", label: "Zu leicht" },
  { value: "passt", label: "Passt" },
  { value: "zu-schwer", label: "Zu schwer" },
];
const MIN_MINUTES = 1;
const MAX_MINUTES = 240;

function failure(error: unknown): string {
  return error instanceof Error ? error.message : "Speichern fehlgeschlagen.";
}

export function LevelPicker({
  techniqueId,
  initial,
  onSaved,
}: {
  techniqueId: string;
  initial: number;
  onSaved: () => void;
}) {
  const [level, setLevel] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  async function save() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await gameApi.setLevel(techniqueId, level);
      onSaved();
    } catch (e) {
      setError(failure(e));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="quest-level">
      <input
        type="range"
        aria-label="Stufe"
        min={1}
        max={10}
        value={level}
        onChange={(event) => setLevel(Number(event.target.value))}
      />
      <output>{level}</output>
      <button type="button" className="game-button" disabled={saving} onClick={() => void save()}>
        Stufe speichern
      </button>
      {error ? (
        <p role="alert" className="game-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ResultDialog({
  quest,
  level,
  seconds,
  metricKey,
  metricPrefill,
  onSaved,
  onCancel,
  onClose,
}: {
  quest: QuestDefinition;
  level: number;
  seconds: number;
  metricKey: string | undefined;
  metricPrefill: number | null;
  onSaved: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const [rating, setRating] = useState<PracticeRating | null>(null);
  const [metric, setMetric] = useState(metricPrefill === null ? "" : String(metricPrefill));
  const [minutes, setMinutes] = useState(() =>
    String(Math.max(MIN_MINUTES, Math.min(Math.round(seconds / 60), quest.minutes * 3))),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LogResult | null>(null);
  const savingRef = useRef(false);

  async function save() {
    if (savingRef.current) return;
    if (rating === null) {
      setError("Wähle aus, wie die Quest war.");
      return;
    }
    const practiced = minutes.trim() === "" ? Number.NaN : Number(minutes);
    if (!Number.isInteger(practiced) || practiced < MIN_MINUTES || practiced > MAX_MINUTES) {
      setError(`Gib die Minuten als ganze Zahl von ${MIN_MINUTES} bis ${MAX_MINUTES} ein.`);
      return;
    }
    const value = metric.trim() === "" ? null : Number(metric);
    if (value !== null && (!Number.isInteger(value) || value < 0)) {
      setError("Gib eine Zahl ab 0 ein.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const logged = await gameApi.log({
        kind: "quest",
        questId: quest.id,
        ...(quest.lessonId !== null ? { lessonId: quest.lessonId } : {}),
        techniqueId: quest.techniqueId,
        seconds: practiced * 60,
        level,
        rating,
        ...(value !== null && metricKey !== undefined ? { metricKey, metricValue: value } : {}),
        ...(quest.masteryTarget !== undefined ? { masteryTarget: quest.masteryTarget } : {}),
      });
      onSaved();
      setResult(logged);
    } catch (e) {
      setError(failure(e));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (result) {
    return (
      <section role="dialog" aria-label="Ergebnis" className="quest-result">
        {result.isRecord ? <p className="font-bold">Neuer Rekord!</p> : null}
        <p className="quest-xp">+{result.xpGained} XP</p>
        {result.suggestion !== null ? (
          <>
            <p>Nächstes Mal Stufe {result.suggestion}?</p>
            <LevelPicker techniqueId={quest.techniqueId} initial={result.suggestion} onSaved={onClose} />
          </>
        ) : null}
        <button type="button" className="game-button" onClick={onClose}>
          Zurück zum Board
        </button>
      </section>
    );
  }

  return (
    <section role="dialog" aria-label="Ergebnis" className="quest-result">
      <h2 className="text-lg font-semibold">Wie war es?</h2>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="space-y-3"
      >
        <div className="quest-buttons">
          {RATINGS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="game-button"
              aria-pressed={rating === option.value}
              onClick={() => setRating(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {quest.metricLabel ? (
          <label className="quest-field">
            <span>{quest.metricLabel}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={metric}
              onChange={(event) => setMetric(event.target.value)}
            />
          </label>
        ) : null}
        <label className="quest-field">
          <span>Geübte Minuten</span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_MINUTES}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </label>
        {error ? (
          <p role="alert" className="game-error">
            {error}
          </p>
        ) : null}
        <div className="quest-buttons">
          <button type="submit" className="game-button" disabled={saving}>
            Speichern
          </button>
          <button type="button" className="game-button" disabled={saving} onClick={onCancel}>
            Abbrechen
          </button>
        </div>
      </form>
    </section>
  );
}
