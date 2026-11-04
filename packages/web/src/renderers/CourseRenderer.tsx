import { MDXProvider } from "@mdx-js/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, lazy, useMemo, useState, type ComponentType } from "react";
import { api } from "../api/client.js";
import { mdxComponents } from "../mdx/components.js";
import { isUnlocked, sortLessons, type LessonMeta } from "../mdx/lessons.js";

const lessonModules = import.meta.glob("../../../../skills/*/*/*.mdx");
const lessonMeta = import.meta.glob("../../../../skills/*/*/*.mdx", {
  eager: true,
  import: "meta",
});

interface ProgressResponse {
  lessons: { lessonId: string; status: string }[];
}

const FINISHED = new Set(["done", "gelernt", "gemeistert"]);

export function CourseRenderer({
  skillId,
  title,
  folder = "lessons",
  ignoreLocks = false,
  initialLessonId,
}: {
  skillId: string;
  title: string;
  folder?: string;
  ignoreLocks?: boolean;
  initialLessonId?: string;
}) {
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(initialLessonId ?? null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);

  const progressQuery = {
    queryKey: ["progress", skillId],
    queryFn: () => api.get<ProgressResponse>(`/api/progress/${skillId}`),
  };
  const progress = useQuery(progressQuery);

  const lessons = useMemo(() => {
    const prefix = `/skills/${skillId}/${folder}/`;
    const entries: { meta: LessonMeta; path: string }[] = [];
    for (const [path, meta] of Object.entries(lessonMeta)) {
      if (!path.includes(prefix)) continue;
      entries.push({ meta: meta as LessonMeta, path });
    }
    return sortLessons(entries.map((e) => e.meta)).map((meta) => ({
      meta,
      path: entries.find((e) => e.meta.id === meta.id)!.path,
    }));
  }, [skillId, folder]);

  const done = new Set(
    (progress.data?.lessons ?? []).filter((l) => FINISHED.has(l.status)).map((l) => l.lessonId),
  );

  const openEntry = lessons.find((l) => l.meta.id === openId);
  // Kept stable: a new lazy would remount the lesson and scroll the confirmation out of view.
  const Lesson = useMemo(
    () =>
      openEntry
        ? (lazy(lessonModules[openEntry.path] as () => Promise<{ default: ComponentType }>) as ComponentType)
        : null,
    [openEntry],
  );

  async function markDone(lessonId: string) {
    // Read fresh: a quest may have mastered this lesson since the progress was cached.
    const current = await queryClient.fetchQuery({ ...progressQuery, staleTime: 0 });
    if (current.lessons.some((l) => l.lessonId === lessonId && l.status === "gemeistert")) return;
    await api.put(`/api/progress/${skillId}/${lessonId}`, { status: "done", checkpoint: {} });
    await queryClient.invalidateQueries({ queryKey: ["progress", skillId] });
    await queryClient.invalidateQueries({ queryKey: ["game", skillId] });
  }

  async function confirm(lessonId: string) {
    await markDone(lessonId);
    setConfirmedId(lessonId);
  }

  if (Lesson && openEntry) {
    return (
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={() => setOpenId(null)} className="mb-4 text-sm text-slate-500">
          ← Zurück zur Übersicht
        </button>
        <h1 className="text-2xl font-semibold">{openEntry.meta.title}</h1>
        <MDXProvider components={{ ...mdxComponents, Checkpoint: (props: { children: React.ReactNode }) => (
          <mdxComponents.Checkpoint
            onDone={() => void confirm(openEntry.meta.id)}
            confirmed={confirmedId === openEntry.meta.id}
          >
            {props.children}
          </mdxComponents.Checkpoint>
        ) }}>
          <Suspense fallback={<p>Lektion wird geladen…</p>}>
            <article className="prose prose-slate mt-4 dark:prose-invert">
              <Lesson />
            </article>
          </Suspense>
        </MDXProvider>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <ol className="space-y-2">
        {lessons.map(({ meta }) => {
          const unlocked = ignoreLocks || isUnlocked(meta, done);
          return (
            <li key={meta.id}>
              <button
                type="button"
                disabled={!unlocked}
                onClick={() => setOpenId(meta.id)}
                className="flex w-full items-center justify-between rounded border border-slate-200 px-4 py-3 text-left disabled:opacity-40 dark:border-slate-800"
              >
                <span>{meta.title}</span>
                <span className="text-sm text-slate-500">
                  {done.has(meta.id) ? "abgeschlossen" : unlocked ? "offen" : "gesperrt"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
