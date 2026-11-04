import { z } from "zod";

const scaleSchema = z.object({
  bpm: z.tuple([z.number(), z.number()]).optional(),
  tempoPercent: z.tuple([z.number(), z.number()]).optional(),
  chordPairs: z.array(z.tuple([z.string(), z.string()])).optional(),
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
});

const contentSchema = z.object({
  techniques: z.array(z.object({ id: z.string().min(1), title: z.string().min(1) })),
  quests: z.array(questSchema),
  road: z.array(
    z.object({
      lessonId: z.string().min(1),
      questId: z.string().min(1),
      months: z.tuple([z.number(), z.number()]),
      reason: z.string().min(1),
    }),
  ),
});

export type QuestScale = z.infer<typeof scaleSchema>;
export type QuestDefinition = z.infer<typeof questSchema>;
export type GameContent = z.infer<typeof contentSchema>;
export type Technique = GameContent["techniques"][number];
export type RoadStep = GameContent["road"][number];
export type LessonStatus = "offen" | "aktiv" | "gelernt" | "gemeistert";

export function parseGameContent(input: unknown): GameContent {
  const result = contentSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    throw new Error(`Ungültiger Spielinhalt bei "${issue.path.join(".") || "Wurzel"}": ${issue.message}`);
  }
  return result.data;
}

function isUnfinished(status: LessonStatus | undefined): boolean {
  return status === undefined || status === "offen" || status === "aktiv";
}

export function bestNext(road: RoadStep[], statuses: Record<string, LessonStatus>): RoadStep | null {
  return road.find((step) => isUnfinished(statuses[step.lessonId])) ?? null;
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
}): string[] {
  const { content, minutes } = input;
  const byId = new Map(content.quests.map((quest) => [quest.id, quest]));
  const firstOfKind = (kind: QuestDefinition["kind"]) => content.quests.find((quest) => quest.kind === kind);
  const freshOfKind = (kind: QuestDefinition["kind"]) =>
    content.quests.find(
      (quest) =>
        quest.kind === kind &&
        quest.lessonId !== null &&
        isUnfinished(input.statuses[quest.lessonId]) &&
        !input.recentQuestIds.includes(quest.id),
    ) ?? firstOfKind(kind);

  const next = bestNext(content.road, input.statuses);
  const candidates: (QuestDefinition | undefined)[] = [
    next ? byId.get(next.questId) : undefined,
    firstOfKind("wechsel"),
    input.hasTargetSong ? firstOfKind("song") : undefined,
    freshOfKind("theorie"),
    freshOfKind("aufwaermen"),
    ...content.quests.filter((quest) => !input.recentQuestIds.includes(quest.id)),
  ];

  const chosen: QuestDefinition[] = [];
  let total = 0;
  for (const quest of candidates) {
    if (!quest || chosen.some((c) => c.id === quest.id)) continue;
    if (chosen.length === 0 || total + quest.minutes <= minutes) {
      chosen.push(quest);
      total += quest.minutes;
    }
  }
  return chosen.map((quest) => quest.id);
}
