import type { SchedulingState } from "@skills/core";

export interface ReviewCard {
  id: number;
  skillId: string;
  moduleId: string;
  cardKey: string;
  front: { text: string };
  back: { text: string; reading: string | null; note: string | null; example: string | null };
  tags: string[];
  scheduling: SchedulingState;
  preview: Record<"1" | "2" | "3" | "4", { due: number }>;
}

export interface StatsResponse {
  heatmap: { day: string; count: number }[];
  retention: number;
  states: Record<string, number>;
  forecast: { day: string; count: number }[];
  streak: number;
}

export interface SeedResult {
  created: number;
  updated: number;
  archived: number;
  unchanged: number;
}

export interface SeedCard {
  moduleId: string;
  cardKey: string;
  front: string;
  back: string;
  reading?: string;
  note?: string;
  example?: string;
  tags: string[];
}

export interface SeedRequest {
  skillId: string;
  name: string;
  modules: { id: string; type: string; title: string }[];
  cards: SeedCard[];
}
