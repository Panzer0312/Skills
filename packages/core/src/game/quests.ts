import { z } from "zod";
import { mapNodeSchema, mapPathSchema } from "./map.js";

const scaleSchema = z.object({
  bpm: z.tuple([z.number(), z.number()]).optional(),
  tempoPercent: z.tuple([z.number(), z.number()]).optional(),
  chordPairs: z.array(z.tuple([z.string(), z.string()])).optional(),
  sections: z.array(z.string()).optional(),
  runs: z.tuple([z.number(), z.number()]).optional(),
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
  chosenLessonIds: string[];
}): string[] {
  const { content, minutes } = input;
  const byId = new Map(content.quests.map((quest) => [quest.id, quest]));
  const next = bestNext(content.road, input.statuses);
  const nextIndex = next ? content.road.indexOf(next) : -1;
  const recent = (quest: QuestDefinition) => input.recentQuestIds.includes(quest.id);
  // A lesson is reached when the road is at or past it, or finished.
  const reached = (quest: QuestDefinition) => {
    if (quest.lessonId === null || nextIndex === -1) return true;
    const at = content.road.findIndex((step) => step.lessonId === quest.lessonId);
    return at !== -1 && at <= nextIndex;
  };
  const slot = (kind: QuestDefinition["kind"]) => {
    const ofKind = content.quests.filter((quest) => quest.kind === kind);
    return (
      ofKind.find(
        (quest) =>
          quest.lessonId !== null && isUnfinished(input.statuses[quest.lessonId]) && reached(quest) && !recent(quest),
      ) ??
      ofKind.find((quest) => reached(quest) && !recent(quest)) ??
      ofKind.find(reached)
    );
  };

  const candidates: (QuestDefinition | undefined)[] = [
    next?.questId ? byId.get(next.questId) : undefined,
    content.quests.find((quest) => quest.kind === "wechsel"),
    ...input.chosenLessonIds.map((id) => content.quests.find((quest) => quest.lessonId === id)),
    input.hasTargetSong ? content.quests.find((quest) => quest.kind === "song") : undefined,
    slot("theorie"),
    slot("aufwaermen"),
    ...content.quests.filter(
      (quest) => !recent(quest) && !((quest.kind === "theorie" || quest.kind === "aufwaermen") && !reached(quest)),
    ),
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
