import { MDXProvider } from "@mdx-js/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, lazy, useMemo, useState, type ComponentType } from "react";
import { api } from "../api/client.js";
import { mdxComponents } from "../mdx/components.js";
import { isUnlocked, sortLessons, type LessonMeta } from "../mdx/lessons.js";

const lessonModules = import.meta.glob("../../../../skills/*/lessons/*.mdx");
const lessonMeta = import.meta.glob("../../../../skills/*/lessons/*.mdx", {
  eager: true,
  import: "meta",
});

interface ProgressResponse {
  lessons: { lessonId: string; status: string }[];
}

export function CourseRenderer({ skillId, title }: { skillId: string; title: string }) {
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const progress = useQuery({
    queryKey: ["progress", skillId],
    queryFn: () => api.get<ProgressResponse>(`/api/progress/${skillId}`),
  });

  const lessons = useMemo(() => {
    const prefix = `/skills/${skillId}/lessons/`;
    const entries: { meta: LessonMeta; path: string }[] = [];
    for (const [path, meta] of Object.entries(lessonMeta)) {
      if (!path.includes(prefix)) continue;
      entries.push({ meta: meta as LessonMeta, path });
    }
    return sortLessons(entries.map((e) => e.meta)).map((meta) => ({
      meta,
      path: entries.find((e) => e.meta.id === meta.id)!.path,
    }));
  }, [skillId]);

  const done = new Set(
    (progress.data?.lessons ?? []).filter((l) => l.status === "done").map((l) => l.lessonId),
  );

  const openEntry = lessons.find((l) => l.meta.id === openId);
  const Lesson = openEntry
    ? (lazy(lessonModules[openEntry.path] as () => Promise<{ default: ComponentType }>) as ComponentType)
    : null;

  async function markDone(lessonId: string) {
    await api.put(`/api/progress/${skillId}/${lessonId}`, { status: "done", checkpoint: {} });
    await queryClient.invalidateQueries({ queryKey: ["progress", skillId] });
  }

  if (Lesson && openEntry) {
    return (
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={() => setOpenId(null)} className="mb-4 text-sm text-slate-500">
          ← Zurück zur Übersicht
        </button>
        <h1 className="text-2xl font-semibold">{openEntry.meta.title}</h1>
        <MDXProvider components={{ ...mdxComponents, Checkpoint: (props: { children: React.ReactNode }) => (
          <mdxComponents.Checkpoint onDone={() => void markDone(openEntry.meta.id)}>
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
          const unlocked = isUnlocked(meta, done);
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
