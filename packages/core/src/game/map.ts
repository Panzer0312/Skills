import { z } from "zod";
import type { RoadStep } from "./quests.js";

export const PATH_IDS = ["hafen", "rhythmus", "fingerpicking", "theorie", "metal", "lead", "griffbrett"] as const;

export const mapPathSchema = z.object({
  id: z.enum(PATH_IDS),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  color: z.string().min(1),
  label: z.object({ x: z.number(), y: z.number() }),
});

export const songTipSchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  trains: z.string().min(1),
  source: z.string().min(1),
});

export const mapNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  path: z.enum(PATH_IDS),
  rank: z.number(),
  x: z.number(),
  y: z.number(),
  parent: z.string().min(1).nullable(),
  quick: z.boolean(),
  available: z.boolean(),
  knownSong: z.boolean(),
  techniqueId: z.string().min(1).nullable(),
  links: z.array(z.object({ to: z.string().min(1), reason: z.string().min(1) })),
  songs: z.array(songTipSchema),
  targetSong: z.object({ title: z.string().min(1), artist: z.string().min(1) }).nullable(),
  /** The player picks the target song from `songs` on this lesson. */
  chooseTarget: z.boolean().default(false),
});

export type PathId = (typeof PATH_IDS)[number];
export type MapPath = z.infer<typeof mapPathSchema>;
export type SongTip = z.infer<typeof songTipSchema>;
export type MapNode = z.infer<typeof mapNodeSchema>;

export interface NodeRelations {
  buildsOn: MapNode[];
  unlocks: MapNode[];
  linked: { node: MapNode; reason: string }[];
}

/** Parent, children and links of a node; a link counts from both sides. */
export function relations(nodes: MapNode[], id: string): NodeRelations {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const self = byId.get(id);
  if (!self) return { buildsOn: [], unlocks: [], linked: [] };
  const parent = self.parent ? byId.get(self.parent) : undefined;
  const linked: NodeRelations["linked"] = [];
  const add = (node: MapNode | undefined, reason: string) => {
    if (node && node.id !== id && !linked.some((l) => l.node.id === node.id)) linked.push({ node, reason });
  };
  for (const link of self.links) add(byId.get(link.to), link.reason);
  for (const node of nodes) {
    const back = node.links.find((link) => link.to === id);
    if (back) add(node, back.reason);
  }
  return {
    buildsOn: parent ? [parent] : [],
    unlocks: nodes.filter((node) => node.parent === id),
    linked,
  };
}

/** Map positions of the road steps, in road order. */
export function roadPoints(road: RoadStep[], nodes: MapNode[]): { x: number; y: number }[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return road.flatMap((step) => {
    const node = byId.get(step.lessonId);
    return node ? [{ x: node.x, y: node.y }] : [];
  });
}
