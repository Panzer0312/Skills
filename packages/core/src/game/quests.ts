import { z } from "zod";
import { NOTES, TUNINGS } from "../music/notes.js";
import { mapNodeSchema, mapPathSchema } from "./map.js";

const scaleSchema = z.object({
  bpm: z.tuple([z.number(), z.number()]).optional(),
  tempoPercent: z.tuple([z.number(), z.number()]).optional(),
  chordPairs: z.array(z.tuple([z.string(), z.string()])).optional(),
  sections: z.array(z.string()).optional(),
  runs: z.tuple([z.number(), z.number()]).optional(),
});

const fretboardSchema = z.object({
  root: z.enum(NOTES),
  scale: z.enum(["dur", "moll", "moll-pentatonik"]),
  box: z.number().int().min(1).max(5).optional(),
  caged: z.enum(["C", "A", "G", "E", "D"]).optional(),
});

const questSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  kind: z.enum(["wechsel", "technik", "song", "theorie", "aufwaermen"]),
  techniqueId: z.string().min(1),
  lessonId: z.string().nullable(),
  minutes: z.number().positive(),
  icon: z.string().min(1),
  metricLabel: z.string().optional(),
  masteryTarget: z.number().positive().optional(),
  scale: scaleSchema,
  fretboard: fretboardSchema.optional(),
  noteGame: z.object({ strings: z.array(z.number().int().min(0).max(5)).min(1) }).optional(),
  tuning: z.string().optional(),
  riffId: z.string().min(1).optional(),
  /** Chords the quest tells the owner to grip, shown as diagrams. Names come from the quest's lesson. */
  chords: z.array(z.string().min(1)).optional(),
});

const riffSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  lessonId: z.string().min(1),
  bpm: z.number().positive(),
  tuning: z.string().optional(),
  zeilen: z
    .array(z.string())
    .length(6, "Eine Tabulatur braucht sechs Zeilen.")
    .refine((lines) => lines.every((line) => line.length === lines[0]!.length), "Alle Zeilen müssen gleich lang sein."),
});

const baseSchema = z.object({
  techniques: z.array(z.object({ id: z.string().min(1), title: z.string().min(1) })),
  quests: z.array(questSchema),
  road: z.array(
    z.object({
      lessonId: z.string().min(1),
      questId: z.string().min(1).nullable(),
      months: z.tuple([z.number(), z.number()]),
      reason: z.string().min(1),
    }),
  ),
  paths: z.array(mapPathSchema),
  nodes: z.array(mapNodeSchema),
  riffs: z.array(riffSchema).default([]),
});

const contentSchema = baseSchema.superRefine((content, ctx) => {
  const fail = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const dupes = (key: string, ids: string[]) =>
    ids.forEach((id, i) => {
      if (ids.indexOf(id) !== i) fail([key, i, "id"], `Die ID "${id}" kommt mehrfach vor.`);
    });
  dupes("nodes", content.nodes.map((n) => n.id));
  dupes("quests", content.quests.map((n) => n.id));
  dupes("techniques", content.techniques.map((n) => n.id));
  dupes("riffs", content.riffs.map((n) => n.id));
  const riffIds = new Set(content.riffs.map((n) => n.id));
  const nodeIds = new Set(content.nodes.map((n) => n.id));
  const questIds = new Set(content.quests.map((n) => n.id));
  const techniqueIds = new Set(content.techniques.map((n) => n.id));
  content.nodes.forEach((node, i) => {
    if (node.parent !== null && !nodeIds.has(node.parent))
      fail(["nodes", i, "parent"], `Der Elternknoten "${node.parent}" existiert nicht.`);
    node.links.forEach((link, j) => {
      if (!nodeIds.has(link.to)) fail(["nodes", i, "links", j, "to"], `Der Verweis auf "${link.to}" ist unbekannt.`);
    });
    if (node.techniqueId !== null && !techniqueIds.has(node.techniqueId))
      fail(["nodes", i, "techniqueId"], `Die Technik "${node.techniqueId}" existiert nicht.`);
  });
  content.quests.forEach((quest, i) => {
    if (quest.lessonId !== null && !nodeIds.has(quest.lessonId))
      fail(["quests", i, "lessonId"], `Die Lektion "${quest.lessonId}" existiert nicht.`);
    if (quest.tuning !== undefined && !TUNINGS.some((t) => t.name === quest.tuning))
      fail(["quests", i, "tuning"], `Die Stimmung "${quest.tuning}" ist unbekannt.`);
    if (quest.riffId !== undefined && !riffIds.has(quest.riffId))
      fail(["quests", i, "riffId"], `Das Riff "${quest.riffId}" existiert nicht.`);
  });
  content.riffs.forEach((riff, i) => {
    if (!nodeIds.has(riff.lessonId)) fail(["riffs", i, "lessonId"], `Die Lektion "${riff.lessonId}" existiert nicht.`);
    if (riff.tuning !== undefined && !TUNINGS.some((t) => t.name === riff.tuning))
      fail(["riffs", i, "tuning"], `Die Stimmung "${riff.tuning}" ist unbekannt.`);
  });
  content.road.forEach((step, i) => {
    if (!nodeIds.has(step.lessonId)) fail(["road", i, "lessonId"], `Die Lektion "${step.lessonId}" existiert nicht.`);
    if (step.questId !== null && !questIds.has(step.questId))
      fail(["road", i, "questId"], `Die Quest "${step.questId}" existiert nicht.`);
  });
});

export type QuestScale = z.infer<typeof scaleSchema>;
export type QuestDefinition = z.infer<typeof questSchema>;
export type GameContent = z.infer<typeof baseSchema>;
export type Riff = GameContent["riffs"][number];
export type Technique = GameContent["techniques"][number];
export type RoadStep = GameContent["road"][number];
export const MAX_CHOSEN = 2;
export type LessonStatus = "offen" | "aktiv" | "gelernt" | "gemeistert";

export function parseGameContent(input: unknown): GameContent {
  const result = contentSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    throw new Error(`Ungültiger Spielinhalt bei "${issue.path.join(".") || "Wurzel"}": ${issue.message}`);
  }
  return result.data;
}

export function isUnfinished(status: LessonStatus | undefined): boolean {
  return status === undefined || status === "offen" || status === "aktiv";
}

export function bestNext(road: RoadStep[], statuses: Record<string, LessonStatus>): RoadStep | null {
  return road.find((step) => step.questId !== null && isUnfinished(statuses[step.lessonId])) ?? null;
}

/** The highest target of any quest on this lesson, so every quest of a lesson masters it alike. */
export function lessonMasteryTarget(quests: QuestDefinition[], lessonId: string): number | undefined {
  const targets = quests.flatMap((quest) =>
    quest.lessonId === lessonId && quest.masteryTarget !== undefined ? [quest.masteryTarget] : [],
  );
  return targets.length > 0 ? Math.max(...targets) : undefined;
}

export function buildDailyQuests(input: {
  minutes: number;
  content: GameContent;
  statuses: Record<string, LessonStatus>;
  hasTargetSong: boolean;
  recentQuestIds: string[];
  /** Quest id to the last local day it was logged. Without it, only yesterday's quests count as done. */
  questDays?: Record<string, string>;
  chosenLessonIds: string[];
}): string[] {
  const { content, minutes } = input;
  const byId = new Map(content.quests.map((quest) => [quest.id, quest]));
  const next = bestNext(content.road, input.statuses);
  const nextIndex = next ? content.road.indexOf(next) : -1;
  const nextQuest = next?.questId ? byId.get(next.questId) : undefined;
  // One song per session: a song on the road takes the place of the target song.
  const songSlot = input.hasTargetSong && nextQuest?.kind !== "song";
  const recent = (quest: QuestDefinition) => input.recentQuestIds.includes(quest.id);
  // Day keys sort as text. Never done sorts first; a quest known only from yesterday sorts last.
  const lastDone = (quest: QuestDefinition) => input.questDays?.[quest.id] ?? (recent(quest) ? "~" : "");
  const leastRecent = (quests: QuestDefinition[]) =>
    quests
      .map((quest, order) => ({ quest, order }))
      .sort((a, b) => lastDone(a.quest).localeCompare(lastDone(b.quest)) || a.order - b.order)
      .map(({ quest }) => quest);
  const nodeById = new Map(content.nodes.map((node) => [node.id, node]));
  const done = (id: string) => input.statuses[id] === "gelernt" || input.statuses[id] === "gemeistert";
  const roadIndex = (quest: QuestDefinition) =>
    quest.lessonId === null ? -1 : content.road.findIndex((step) => step.lessonId === quest.lessonId);
  // A road lesson is reached when the road is at or past it. An off-road lesson is reached when it is
  // chosen, or its parent is done. A finished road reaches everything.
  const reached = (quest: QuestDefinition) => {
    if (quest.lessonId === null || nextIndex === -1) return true;
    const at = roadIndex(quest);
    if (at !== -1) return at <= nextIndex;
    const lesson = nodeById.get(quest.lessonId);
    if (!lesson || input.chosenLessonIds.includes(lesson.id)) return true;
    return lesson.parent === null || done(lesson.parent);
  };
  const fillable = (quest: QuestDefinition) => (quest.kind === "song" && !songSlot ? false : reached(quest));
  const slot = (kind: QuestDefinition["kind"]) => {
    const ofKind = content.quests.filter((quest) => quest.kind === kind && reached(quest));
    const unfinished = (quest: QuestDefinition) =>
      quest.lessonId !== null && isUnfinished(input.statuses[quest.lessonId]) && !recent(quest);
    return [...leastRecent(ofKind.filter(unfinished)), ...leastRecent(ofKind.filter((quest) => !unfinished(quest)))];
  };
  const ofLesson = (lessonId: string) => content.quests.filter((quest) => quest.lessonId === lessonId);
  const siblings = (lessonId: string | null | undefined) =>
    lessonId ? leastRecent(ofLesson(lessonId).filter(fillable)) : [];
  // Filler: the newest reached road step first, then off-road lessons.
  const filler = leastRecent(content.quests.filter((quest) => !recent(quest) && fillable(quest)))
    .map((quest, order) => ({ quest, order }))
    .sort((a, b) => roadIndex(b.quest) - roadIndex(a.quest) || a.order - b.order)
    .map(({ quest }) => quest);

  // Each entry offers alternatives in order; the first that fits the remaining minutes is added.
  const candidates: QuestDefinition[][] = [
    nextQuest ? [nextQuest] : [],
    content.quests.filter((quest) => quest.kind === "wechsel").slice(0, 1),
    ...input.chosenLessonIds.map((id) => leastRecent(ofLesson(id))),
    songSlot ? content.quests.filter((quest) => quest.kind === "song").slice(0, 1) : [],
    slot("theorie"),
    slot("aufwaermen"),
    siblings(next?.lessonId),
    ...input.chosenLessonIds.map((id) => siblings(id)),
    ...filler.map((quest) => [quest]),
  ];

  const chosen: QuestDefinition[] = [];
  let total = 0;
  for (const alternatives of candidates) {
    const quest = alternatives.find(
      (alternative) =>
        !chosen.some((c) => c.id === alternative.id) &&
        (chosen.length === 0 || total + alternative.minutes <= minutes),
    );
    if (quest) {
      chosen.push(quest);
      total += quest.minutes;
    }
  }
  return chosen.map((quest) => quest.id);
}
