import type { SchedulingState } from "./types.js";

export interface QueueCard {
  cardId: number;
  moduleId: string;
  scheduling: SchedulingState;
}

export interface QueueLimits {
  newPerDay: number;
  reviewsPerDay: number;
  newDoneToday: number;
  reviewsDoneToday: number;
}

const byDue = (a: QueueCard, b: QueueCard) => a.scheduling.due - b.scheduling.due;

export function buildQueue(cards: QueueCard[], limits: QueueLimits, now: number): QueueCard[] {
  const due = cards.filter((c) => c.scheduling.due <= now);

  const steps = due
    .filter((c) => c.scheduling.state === "learning" || c.scheduling.state === "relearning")
    .sort(byDue);

  const reviewBudget = Math.max(0, limits.reviewsPerDay - limits.reviewsDoneToday);
  const reviews = due
    .filter((c) => c.scheduling.state === "review")
    .sort(byDue)
    .slice(0, reviewBudget);

  const newBudget = Math.max(0, limits.newPerDay - limits.newDoneToday);
  const fresh = due
    .filter((c) => c.scheduling.state === "new")
    .sort((a, b) => a.cardId - b.cardId)
    .slice(0, newBudget);

  return [...steps, ...reviews, ...fresh];
}
