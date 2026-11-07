import type { ReactNode } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import type { LessonMeta } from "../../../packages/web/src/mdx/lessons.js";
import { CourseRenderer } from "../../../packages/web/src/renderers/CourseRenderer.js";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";
import ChordDiagram from "../widgets/ChordDiagram.js";
import Fretboard from "../widgets/Fretboard.js";
import SongLibrary from "../widgets/SongLibrary.js";
import Tuner from "../widgets/Tuner.js";
import { ChordTrainer } from "./ChordTrainer.js";
import { NoteFinder } from "./NoteFinder.js";
import { DeviceCheck } from "./devices/DeviceCheck.js";
import { openIntroStep } from "./intro/helpBus.js";
import { StoryLog } from "./StoryLog.js";
import { GAME_BASE, gameContent, useGameState } from "./api.js";

export function ToolFrame({
  title,
  children,
  helpStepId,
}: {
  title: string;
  children: ReactNode;
  /** Intro step the "?" button shows; no button without it. */
  helpStepId?: string;
}) {
  return (
    <section className="tool-frame">
      <h1>{title}</h1>
      {helpStepId ? (
        <button
          type="button"
          className="game-button tool-help"
          aria-label="Hilfe von Meister Orlo"
          title="Hilfe von Meister Orlo"
          onClick={() => openIntroStep(helpStepId)}
        >
          ?
        </button>
      ) : null}
      <div className="tool-frame-inner">{children}</div>
    </section>
  );
}

function SongRecommendations() {
  const nodes = gameContent.nodes.filter(
    (node) => node.available && node.songs.length > 0,
  );
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
                  <small className="text-slate-600">{song.trains}</small>
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

function metaTitles(meta: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.values(meta).map((entry) => [
      (entry as LessonMeta).id,
      (entry as LessonMeta).title,
    ]),
  );
}

const LESSON_TITLES = {
  ...metaTitles(
    import.meta.glob("../lessons/*.mdx", { eager: true, import: "meta" }),
  ),
  ...metaTitles(
    import.meta.glob("../reference/*.mdx", { eager: true, import: "meta" }),
  ),
};

function metaIds(meta: Record<string, unknown>): Set<string> {
  return new Set(Object.values(meta).map((entry) => (entry as LessonMeta).id));
}

const LIBRARY = [
  {
    folder: "lessons",
    title: "Lektionen",
    ids: metaIds(
      import.meta.glob("../lessons/*.mdx", { eager: true, import: "meta" }),
    ),
  },
  {
    folder: "reference",
    title: "Nachschlagen",
    ids: metaIds(
      import.meta.glob("../reference/*.mdx", { eager: true, import: "meta" }),
    ),
  },
];

export function Library() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { data: state } = useGameState();
  const owner = LIBRARY.find(
    ({ ids }) => lessonId !== undefined && ids.has(lessonId),
  );
  return (
    <ToolFrame title="Bibliothek">
      {lessonId === undefined && state ? (
        <StoryLog state={state} titles={LESSON_TITLES} />
      ) : null}
      <div key={lessonId} className="space-y-8">
        {(owner ? [owner] : LIBRARY).map(({ folder, title }) => (
          <CourseRenderer
            key={folder}
            skillId="guitar"
            title={title}
            folder={folder}
            ignoreLocks
            initialLessonId={lessonId}
            onOpen={(id) =>
              navigate(`${GAME_BASE}/bibliothek${id ? `/${id}` : ""}`)
            }
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
    <ToolFrame title="Schrein" helpStepId="werkzeuge">
      {questId ? (
        <Link
          to={`${GAME_BASE}/quest/${encodeURIComponent(questId)}`}
          className="mb-4 inline-block underline"
        >
          Zurück zur Quest
        </Link>
      ) : null}
      <DeviceCheck />
      <Tuner {...props} initialTuning={params.get("stimmung") ?? undefined} />
    </ToolFrame>
  );
}

export function FretboardPlace(props: WidgetProps) {
  return (
    <ToolFrame title="Griffbrett" helpStepId="werkzeuge">
      <Fretboard {...props} />
      <h2 className="mt-6 text-lg font-semibold">Noten finden</h2>
      <NoteFinder />
    </ToolFrame>
  );
}

export function Forge(props: WidgetProps) {
  return (
    <ToolFrame title="Schmiede" helpStepId="werkzeuge">
      <ChordTrainer />
      <ChordDiagram {...props} />
    </ToolFrame>
  );
}
