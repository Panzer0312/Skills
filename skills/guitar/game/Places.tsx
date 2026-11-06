import type { GameState } from "@skills/core";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { LessonMeta } from "../../../packages/web/src/mdx/lessons.js";
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

function SongRecommendations() {
  const nodes = gameContent.nodes.filter((node) => node.available && node.songs.length > 0);
  if (nodes.length === 0) return null;
  return (
    <>
      <h2 className="mt-6 text-lg font-semibold">Empfehlungen</h2>
      <ul>
        {nodes.map((node) => (
          <li key={node.id} className="mt-2">
            <Link to={`${GAME_BASE}/hafen/${node.id}`} className="underline">
              {node.title}
            </Link>
            <ul>
              {node.songs.map((song) => (
                <li key={`${song.title}-${song.artist}`}>
                  {song.title} · {song.artist}{" "}
                  <small className="text-slate-600 dark:text-slate-400">{song.trains}</small>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Tavern(props: WidgetProps) {
  return (
    <ToolFrame title="Taverne">
      <SongLibrary {...props} />
      <Link to="/songs/neu" className="mt-6 inline-block text-sm underline">
        Song hinzufügen
      </Link>
      <SongRecommendations />
    </ToolFrame>
  );
}

function metaIds(meta: Record<string, unknown>): Set<string> {
  return new Set(Object.values(meta).map((entry) => (entry as LessonMeta).id));
}

const LIBRARY = [
  {
    folder: "lessons",
    title: "Lektionen",
    ids: metaIds(import.meta.glob("../lessons/*.mdx", { eager: true, import: "meta" })),
  },
  {
    folder: "reference",
    title: "Nachschlagen",
    ids: metaIds(import.meta.glob("../reference/*.mdx", { eager: true, import: "meta" })),
  },
];

export function Library() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const owner = LIBRARY.find(({ ids }) => lessonId !== undefined && ids.has(lessonId));
  return (
    <ToolFrame title="Bibliothek">
      <div key={lessonId} className="space-y-8">
        {(owner ? [owner] : LIBRARY).map(({ folder, title }) => (
          <CourseRenderer
            key={folder}
            skillId="guitar"
            title={title}
            folder={folder}
            ignoreLocks
            initialLessonId={lessonId}
            onOpen={(id) => navigate(`${GAME_BASE}/bibliothek${id ? `/${id}` : ""}`)}
          />
        ))}
      </div>
    </ToolFrame>
  );
}

export function Shrine(props: WidgetProps) {
  const [params] = useSearchParams();
  const questId = params.get("quest");
  return (
    <ToolFrame title="Schrein">
      {questId ? (
        <Link to={`${GAME_BASE}/quest/${encodeURIComponent(questId)}`} className="mb-4 inline-block underline">
          Zurück zur Quest
        </Link>
      ) : null}
      <Tuner {...props} initialTuning={params.get("stimmung") ?? undefined} />
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

function Records({ records }: { records: GameState["records"] }) {
  const entries = Object.entries(records);
  return (
    <>
      <h2 className="mt-6 text-lg font-semibold">Rekorde</h2>
      {entries.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">Noch keine Rekorde.</p>
      ) : (
        <ul>
          {entries.map(([key, value]) => (
            <li key={key} className="flex justify-between gap-6">
              <span>{recordLabel(key)}</span>
              <span>{value}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function Chronicle() {
  const { data: state } = useGameState();
  return (
    <ToolFrame title="Chronik">
      {state ? (
        <>
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
          <Records records={state.records} />
        </>
      ) : null}
      <Link to={`${GAME_BASE}/einstufung`} className="mt-6 inline-block underline">
        Einstufung wiederholen
      </Link>
    </ToolFrame>
  );
}
