import { z } from "zod";
import { bestNext, isUnfinished, type GameContent, type LessonStatus, type RoadStep } from "./quests.js";

export const storySchema = z.object({
  mentor: z.object({ name: z.string().min(1), role: z.string().min(1) }),
  chapters: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        months: z.tuple([z.number(), z.number()]),
        intro: z.string().min(1),
        theoryLessons: z.array(z.string().min(1)),
      }),
    )
    .min(1),
  beats: z.array(
    z.object({
      id: z.string().min(1),
      chapterId: z.string().min(1),
      when: z.enum(["next", "done"]),
      lessonId: z.string().min(1),
      title: z.string().min(1),
      lines: z.array(z.string().min(1)).min(1).max(4),
    }),
  ),
});

export type Story = z.infer<typeof storySchema>;
export type Chapter = Story["chapters"][number];
export type Beat = Story["beats"][number];

export function parseStory(input: unknown, content: GameContent): Story {
  const result = storySchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    throw new Error(`Ungültige Geschichte bei "${issue.path.join(".") || "Wurzel"}": ${issue.message}`);
  }
  const story = result.data;
  const lessons = new Set(content.road.map((step) => step.lessonId));
  const chapterIds = new Set<string>();
  for (const chapter of story.chapters) {
    if (chapterIds.has(chapter.id)) throw new Error(`Ungültige Geschichte: Kapitel "${chapter.id}" doppelt.`);
    chapterIds.add(chapter.id);
  }
  const beatIds = new Set<string>();
  for (const beat of story.beats) {
    if (beatIds.has(beat.id)) throw new Error(`Ungültige Geschichte: Szene "${beat.id}" doppelt.`);
    beatIds.add(beat.id);
    if (!chapterIds.has(beat.chapterId)) {
      throw new Error(`Ungültige Geschichte: Szene "${beat.id}" nennt das unbekannte Kapitel "${beat.chapterId}".`);
    }
    if (!lessons.has(beat.lessonId)) {
      throw new Error(`Ungültige Geschichte: Szene "${beat.id}" nennt die Lektion "${beat.lessonId}" ausserhalb der Route.`);
    }
  }
  return story;
}

export function reachedBeats(story: Story, road: RoadStep[], statuses: Record<string, LessonStatus>): Beat[] {
  const next = bestNext(road, statuses);
  const nextIndex = next ? road.findIndex((step) => step.lessonId === next.lessonId) : Infinity;
  const reached: Beat[] = [];
  road.forEach((step, index) => {
    const here = story.beats.filter((beat) => beat.lessonId === step.lessonId);
    for (const beat of here.filter((b) => b.when === "next")) if (index <= nextIndex) reached.push(beat);
    for (const beat of here.filter((b) => b.when === "done")) {
      if (!isUnfinished(statuses[step.lessonId])) reached.push(beat);
    }
  });
  return reached;
}

export function pendingBeat(
  story: Story,
  road: RoadStep[],
  statuses: Record<string, LessonStatus>,
  seen: string[],
): Beat | null {
  const open = reachedBeats(story, road, statuses).filter((beat) => !seen.includes(beat.id));
  return open[open.length - 1] ?? null;
}

export function currentChapter(story: Story, road: RoadStep[], statuses: Record<string, LessonStatus>): Chapter {
  const last = story.chapters[story.chapters.length - 1]!;
  const next = bestNext(road, statuses);
  if (!next) return last;
  const month = next.months[0];
  const inside = story.chapters.find((c) => c.months[0] <= month && month <= c.months[1]);
  if (inside) return inside;
  const before = story.chapters.filter((c) => c.months[0] <= month);
  return before[before.length - 1] ?? story.chapters[0]!;
}
