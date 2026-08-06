import type { CardState, FsrsParams, Rating, SchedulingState } from "./types.js";

const MINUTE = 60_000;
const DAY = 86_400_000;

/**
 * Weights follow the FSRS-5 default set. Indices 0-3 seed initial stability
 * per rating; the rest drive stability and difficulty updates.
 */
export const DEFAULT_PARAMS: FsrsParams = {
  requestRetention: 0.9,
  maximumInterval: 36_500,
  weights: [
    0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616,
    0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466, 0.5034,
    0.6567,
  ],
  learningStepsMinutes: [1, 10],
  relearningStepsMinutes: [10],
};

const DECAY = -0.5;
const FACTOR = 19 / 81;

function clampDifficulty(value: number): number {
  return Math.min(10, Math.max(1, value));
}

function initialDifficulty(w: readonly number[], rating: Rating): number {
  return clampDifficulty(w[4]! - Math.exp(w[5]! * (rating - 1)) + 1);
}

function initialStability(w: readonly number[], rating: Rating): number {
  return Math.max(0.1, w[rating - 1]!);
}

function nextDifficulty(w: readonly number[], difficulty: number, rating: Rating): number {
  const delta = difficulty - w[6]! * (rating - 3);
  const target = w[7]! * initialDifficulty(w, 4) + (1 - w[7]!) * delta;
  return clampDifficulty(target);
}

function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

function stabilityAfterRecall(
  w: readonly number[],
  difficulty: number,
  stability: number,
  retr: number,
  rating: Rating,
): number {
  const hardPenalty = rating === 2 ? w[15]! : 1;
  const easyBonus = rating === 4 ? w[16]! : 1;
  const growth =
    Math.exp(w[8]!) *
    (11 - difficulty) *
    Math.pow(stability, -w[9]!) *
    (Math.exp((1 - retr) * w[10]!) - 1) *
    hardPenalty *
    easyBonus;
  return Math.max(0.1, stability * (1 + growth));
}

function stabilityAfterLapse(
  w: readonly number[],
  difficulty: number,
  stability: number,
  retr: number,
): number {
  const next =
    w[11]! *
    Math.pow(difficulty, -w[12]!) *
    (Math.pow(stability + 1, w[13]!) - 1) *
    Math.exp((1 - retr) * w[14]!);
  return Math.max(0.1, Math.min(next, stability));
}

function intervalDays(stability: number, params: FsrsParams): number {
  const raw =
    (stability / FACTOR) * (Math.pow(params.requestRetention, 1 / DECAY) - 1);
  return Math.min(params.maximumInterval, Math.max(1, Math.round(raw)));
}

export function newSchedulingState(now: number): SchedulingState {
  return {
    state: "new",
    due: now,
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
  };
}

export function schedule(
  state: SchedulingState,
  rating: Rating,
  now: number,
  params: FsrsParams = DEFAULT_PARAMS,
): SchedulingState {
  const w = params.weights;
  const reps = state.reps + 1;

  if (state.state === "new") {
    const stability = initialStability(w, rating);
    const difficulty = initialDifficulty(w, rating);
    const graduating = rating >= 3;
    const nextState: CardState = graduating && rating === 4 ? "review" : "learning";
    const due =
      nextState === "review"
        ? now + intervalDays(stability, params) * DAY
        : now + params.learningStepsMinutes[rating >= 3 ? 1 : 0]! * MINUTE;
    return { state: nextState, due, stability, difficulty, reps, lapses: 0, lastReview: now };
  }

  const elapsedDays = state.lastReview === null ? 0 : Math.max(0, (now - state.lastReview) / DAY);
  const retr = retrievability(elapsedDays, state.stability);
  const difficulty = nextDifficulty(w, state.difficulty, rating);

  if (rating === 1) {
    const stability = stabilityAfterLapse(w, difficulty, state.stability, retr);
    const lapses = state.state === "review" ? state.lapses + 1 : state.lapses;
    return {
      state: "relearning",
      due: now + params.relearningStepsMinutes[0]! * MINUTE,
      stability,
      difficulty,
      reps,
      lapses,
      lastReview: now,
    };
  }

  const stability = stabilityAfterRecall(w, difficulty, state.stability, retr, rating);

  if (state.state === "learning" || state.state === "relearning") {
    if (rating === 2) {
      const steps =
        state.state === "learning" ? params.learningStepsMinutes : params.relearningStepsMinutes;
      return {
        state: state.state,
        due: now + steps[0]! * MINUTE,
        stability,
        difficulty,
        reps,
        lapses: state.lapses,
        lastReview: now,
      };
    }
    return {
      state: "review",
      due: now + intervalDays(stability, params) * DAY,
      stability,
      difficulty,
      reps,
      lapses: state.lapses,
      lastReview: now,
    };
  }

  return {
    state: "review",
    due: now + intervalDays(stability, params) * DAY,
    stability,
    difficulty,
    reps,
    lapses: state.lapses,
    lastReview: now,
  };
}

export function previewAll(
  state: SchedulingState,
  now: number,
  params: FsrsParams = DEFAULT_PARAMS,
): Record<Rating, SchedulingState> {
  return {
    1: schedule(state, 1, now, params),
    2: schedule(state, 2, now, params),
    3: schedule(state, 3, now, params),
    4: schedule(state, 4, now, params),
  };
}
