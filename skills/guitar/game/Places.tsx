import { bestNext } from "@skills/core";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { CourseRenderer } from "../../../packages/web/src/renderers/CourseRenderer.js";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";
import ChordDiagram from "../widgets/ChordDiagram.js";
import Fretboard from "../widgets/Fretboard.js";
import SongLibrary from "../widgets/SongLibrary.js";
import Tuner from "../widgets/Tuner.js";
import { ChordTrainer } from "./ChordTrainer.js";
import { GAME_BASE, gameContent, useGameState } from "./api.js";
import { formatTime } from "./StatusBar.js";

export function ToolFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tool-frame">
      <h1>{title}</h1>
      <div className="tool-frame-inner bg-white p-4 font-sans text-base text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </div>
    </section>
  );
}

export function Tavern(props: WidgetProps) {
  return (
    <ToolFrame title="Taverne">
      <SongLibrary {...props} />
      <Link to="/songs/neu" className="mt-6 inline-block text-sm underline">
        Song hinzufügen
      </Link>
    </ToolFrame>
  );
}

export function Library() {
  const { lessonId } = useParams();
  return (
    <ToolFrame title="Bibliothek">
      <div key={lessonId} className="space-y-8">
        <CourseRenderer skillId="guitar" title="Lektionen" ignoreLocks initialLessonId={lessonId} />
        <CourseRenderer
          skillId="guitar"
          title="Nachschlagen"
          folder="reference"
          ignoreLocks
          initialLessonId={lessonId}
        />
      </div>
    </ToolFrame>
  );
}

export function Shrine(props: WidgetProps) {
  return (
    <ToolFrame title="Schrein">
      <Tuner {...props} />
    </ToolFrame>
  );
}

export function FretboardPlace(props: WidgetProps) {
  return (
    <ToolFrame title="Griffbrett">
      <Fretboard {...props} />
    </ToolFrame>
  );
}

export function Forge(props: WidgetProps) {
  return (
    <ToolFrame title="Schmiede">
      <ChordTrainer />
      <ChordDiagram {...props} />
    </ToolFrame>
  );
}

export function Harbor() {
  const { data: state } = useGameState();
  const lessons = state?.lessons ?? {};
  const next = bestNext(gameContent.road, lessons);
  return (
    <ToolFrame title="Hafen">
      <p className="mb-4">Die Karte öffnet bald</p>
      <ol className="space-y-2">
        {gameContent.road.map((step) => {
          const isNext = step === next;
          const quest = gameContent.quests.find((q) => q.id === step.questId);
          return (
            <li
              key={step.lessonId}
              aria-current={isNext ? "step" : undefined}
              className={`rounded border p-3 ${isNext ? "border-amber-500 bg-amber-50 dark:bg-amber-950" : "border-slate-200 dark:border-slate-800"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <Link to={`${GAME_BASE}/bibliothek/${step.lessonId}`} className="underline">
                  {quest?.title ?? step.lessonId}
                </Link>
                <span className="text-sm text-slate-500">{lessons[step.lessonId] ?? "offen"}</span>
              </div>
              {isNext ? (
                <>
                  <div className="mt-1 text-sm font-semibold">Bester nächster Schritt</div>
                  <p className="text-sm">{step.reason}</p>
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
    </ToolFrame>
  );
}

export function Market() {
  return (
    <ToolFrame title="Markt">
      <p>Der Markt öffnet bald</p>
    </ToolFrame>
  );
}

function recordLabel(key: string): string {
  if (key.startsWith("wechsel:")) return `Wechsel ${key.slice("wechsel:".length)}`;
  return gameContent.quests.find((quest) => quest.id === key)?.title ?? key;
}

export function Chronicle() {
  const { data: state } = useGameState();
  const records = Object.entries(state?.records ?? {});
  return (
    <ToolFrame title="Chronik">
      {state ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          <dt>Gesamt</dt>
          <dd>{formatTime(state.totalSeconds)}</dd>
          <dt>Diese Woche</dt>
          <dd>{formatTime(state.weekSeconds)}</dd>
          <dt>Serie</dt>
          <dd>
            {state.streak} {state.streak === 1 ? "Tag" : "Tage"}
          </dd>
          <dt>Level</dt>
          <dd>
            {state.level} · {state.title}
          </dd>
        </dl>
      ) : null}
      <h2 className="mt-6 text-lg font-semibold">Rekorde</h2>
      {records.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">Noch keine Rekorde.</p>
      ) : (
        <ul>
          {records.map(([key, value]) => (
            <li key={key} className="flex justify-between gap-6">
              <span>{recordLabel(key)}</span>
              <span>{value}</span>
            </li>
          ))}
        </ul>
      )}
      <Link to={`${GAME_BASE}/einstufung`} className="mt-6 inline-block underline">
        Einstufung wiederholen
      </Link>
    </ToolFrame>
  );
}
