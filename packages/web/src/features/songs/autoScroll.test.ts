import { describe, expect, it } from "vitest";
import { nextScrollTop } from "./autoScroll.js";

describe("nextScrollTop", () => {
  const song = { start: 0, end: 1000, viewport: 400, loop: false };
  const part = { start: 300, end: 900, viewport: 400, loop: true };
  const short = { start: 300, end: 500, viewport: 400, loop: true };

  it("scrolls the whole song and stops at its end", () => {
    expect(nextScrollTop(100, 1, song)).toEqual({ top: 101, done: false });
    expect(nextScrollTop(600, 1, song)).toEqual({ top: 600, done: true });
  });

  it("jumps into the loop from outside and wraps at its end", () => {
    expect(nextScrollTop(100, 1, part)).toEqual({ top: 300, done: false });
    expect(nextScrollTop(499, 1, part)).toEqual({ top: 500, done: false });
    expect(nextScrollTop(500, 1, part)).toEqual({ top: 300, done: false });
  });

  it("holds still when the loop fits the window", () => {
    expect(nextScrollTop(300, 1, short)).toEqual({ top: 300, done: false });
  });
});
