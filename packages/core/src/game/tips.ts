import type { MapNode } from "./map.js";
import { bestNext, isUnfinished, type GameContent, type LessonStatus, type RoadStep } from "./quests.js";

export interface QuickTip {
  node: MapNode;
  refine: boolean;
}

export interface Tips {
  best: RoadStep | null;
  quick: QuickTip | null;
  stayOnTrack: string;
}

/** An unfinished quick lesson first, else a learned one worth refining. */
export function quickWin(nodes: MapNode[], statuses: Record<string, LessonStatus>): QuickTip | null {
  const quick = nodes.filter((node) => node.quick && node.available);
  const open = quick.find((node) => isUnfinished(statuses[node.id]));
  if (open) return { node: open, refine: false };
  const learned = quick.find((node) => statuses[node.id] === "gelernt");
  return learned ? { node: learned, refine: true } : null;
}

function stayOnTrackText(chosen: number): string {
  if (chosen >= 2) return "Zwei Nebenwege reichen. Bring erst einen davon zu Ende.";
  if (chosen === 1) return "Neben dem Hauptweg läuft ein Nebenweg. Das ist ein gutes Maß.";
  return "Bleib beim Hauptweg und nimm dir bei Lust einen Nebenweg dazu.";
}

export function buildTips(content: GameContent, statuses: Record<string, LessonStatus>, chosen: string[]): Tips {
  const best = bestNext(content.road, statuses);
  return {
    best,
    quick: quickWin(content.nodes, statuses),
    // The lesson on the gold road is the main way, not a side road.
    stayOnTrack: stayOnTrackText(chosen.filter((id) => id !== best?.lessonId).length),
  };
}
