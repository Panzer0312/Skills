export type Rating = 1 | 2 | 3 | 4;
export type CardState = "new" | "learning" | "review" | "relearning";

export interface SchedulingState {
  state: CardState;
  due: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReview: number | null;
}

export interface FsrsParams {
  requestRetention: number;
  maximumInterval: number;
  weights: readonly number[];
  learningStepsMinutes: readonly number[];
  relearningStepsMinutes: readonly number[];
}
