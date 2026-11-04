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

export function bestNext(road: RoadStep[], statuses: Record<string, LessonStatus>): RoadStep | null {
  for (const step of road) {
    const status = statuses[step.lessonId];
    if (status === undefined || status === "offen" || status === "aktiv") return step;
  }
  return null;
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

  const next = bestNext(content.road, input.statuses);
  const candidates: (QuestDefinition | undefined)[] = [
    next ? byId.get(next.questId) : undefined,
    firstOfKind("wechsel"),
    input.hasTargetSong ? firstOfKind("song") : undefined,
    firstOfKind("theorie"),
    firstOfKind("aufwaermen"),
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
