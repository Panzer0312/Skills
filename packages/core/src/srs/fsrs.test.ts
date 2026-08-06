import { describe, expect, it } from "vitest";
import { newSchedulingState, previewAll, schedule } from "./fsrs.js";

const T0 = Date.UTC(2026, 0, 1);
const DAY = 86_400_000;

describe("schedule", () => {
  it("puts a new card into learning on Good with a sub-day interval", () => {
    const next = schedule(newSchedulingState(T0), 3, T0);
    expect(next.state).toBe("learning");
    expect(next.reps).toBe(1);
    expect(next.due - T0).toBeLessThan(DAY);
    expect(next.due).toBeGreaterThan(T0);
  });

  it("graduates a new card to review on Easy", () => {
    const next = schedule(newSchedulingState(T0), 4, T0);
    expect(next.state).toBe("review");
    expect(next.due - T0).toBeGreaterThanOrEqual(DAY);
  });

  it("increases stability across successive Good reviews", () => {
    let state = schedule(newSchedulingState(T0), 4, T0);
    const first = state.stability;
    state = schedule(state, 3, state.due);
    expect(state.stability).toBeGreaterThan(first);
    expect(state.state).toBe("review");
  });

  it("sends a review card to relearning and counts a lapse on Again", () => {
    const graduated = schedule(newSchedulingState(T0), 4, T0);
    const lapsed = schedule(graduated, 1, graduated.due);
    expect(lapsed.state).toBe("relearning");
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.due - graduated.due).toBeLessThan(DAY);
    expect(lapsed.stability).toBeLessThan(graduated.stability);
  });

  it("keeps difficulty inside 1..10", () => {
    let state = newSchedulingState(T0);
    for (let i = 0; i < 20; i += 1) {
      state = schedule(state, 1, state.due);
      expect(state.difficulty).toBeGreaterThanOrEqual(1);
      expect(state.difficulty).toBeLessThanOrEqual(10);
    }
  });

  it("is deterministic", () => {
    const a = schedule(newSchedulingState(T0), 3, T0);
    const b = schedule(newSchedulingState(T0), 3, T0);
    expect(a).toEqual(b);
  });

  it("caps the interval at maximumInterval", () => {
    let state = schedule(newSchedulingState(T0), 4, T0);
    for (let i = 0; i < 60; i += 1) state = schedule(state, 4, state.due);
    expect(state.due - state.lastReview!).toBeLessThanOrEqual(36_500 * DAY);
  });
});

describe("previewAll", () => {
  it("returns one candidate per rating, ordered by due date", () => {
    const state = newSchedulingState(T0);
    const preview = previewAll(state, T0);
    expect(preview[1].due).toBeLessThanOrEqual(preview[3].due);
    expect(preview[3].due).toBeLessThanOrEqual(preview[4].due);
  });
});
