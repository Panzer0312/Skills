import { describe, expect, it } from "vitest";
import { buildQueue, type QueueCard } from "./queue.js";
import type { CardState, SchedulingState } from "./types.js";

const NOW = Date.UTC(2026, 0, 10);
const DAY = 86_400_000;

function card(cardId: number, state: CardState, due: number): QueueCard {
  const scheduling: SchedulingState = {
    state,
    due,
    stability: 1,
    difficulty: 5,
    reps: 1,
    lapses: 0,
    lastReview: due - DAY,
  };
  return { cardId, moduleId: "m", scheduling };
}

const limits = { newPerDay: 20, reviewsPerDay: 200, newDoneToday: 0, reviewsDoneToday: 0 };

describe("buildQueue", () => {
  it("puts due learning steps before due reviews and new cards", () => {
    const queue = buildQueue(
      [card(1, "new", NOW), card(2, "review", NOW - DAY), card(3, "learning", NOW - 60_000)],
      limits,
      NOW,
    );
    expect(queue.map((c) => c.cardId)).toEqual([3, 2, 1]);
  });

  it("orders due reviews by due date ascending", () => {
    const queue = buildQueue([card(1, "review", NOW - DAY), card(2, "review", NOW - 3 * DAY)], limits, NOW);
    expect(queue.map((c) => c.cardId)).toEqual([2, 1]);
  });

  it("drops cards that are not due yet", () => {
    const queue = buildQueue([card(1, "review", NOW + DAY)], limits, NOW);
    expect(queue).toHaveLength(0);
  });

  it("applies the daily new-card limit, accounting for cards already done", () => {
    const cards = [card(1, "new", NOW), card(2, "new", NOW), card(3, "new", NOW)];
    const queue = buildQueue(cards, { ...limits, newPerDay: 2, newDoneToday: 1 }, NOW);
    expect(queue).toHaveLength(1);
  });

  it("never limits learning steps", () => {
    const cards = [card(1, "learning", NOW), card(2, "relearning", NOW)];
    const queue = buildQueue(cards, { ...limits, newPerDay: 0, reviewsPerDay: 0 }, NOW);
    expect(queue).toHaveLength(2);
  });
});
