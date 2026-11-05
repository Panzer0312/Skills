import { describe, expect, it } from "vitest";
import { clampView, FULL_VIEW, panBy, screenToMap, zoomAt } from "./viewport.js";

const c = { x: 800, y: 550 };

describe("zoomAt", () => {
  it("keeps the point under the cursor fixed while zooming", () => {
    const view = { x: 400, y: 275, width: 800, height: 550 };
    const point = { x: 600, y: 400 };
    const zoomed = zoomAt(view, 0.75, point);
    expect(zoomed.width).toBe(600);
    expect((point.x - zoomed.x) / zoomed.width).toBeCloseTo((point.x - view.x) / view.width);
    expect((point.y - zoomed.y) / zoomed.height).toBeCloseTo((point.y - view.y) / view.height);
  });

  it("clamps zoom at both ends", () => {
    expect(zoomAt(FULL_VIEW, 4, c).width).toBe(1600); // cannot exceed the map
    expect(zoomAt(zoomAt(FULL_VIEW, 0.1, c), 0.1, c).width).toBe(400);
  });

  it("keeps the aspect of the map", () => {
    const zoomed = zoomAt(FULL_VIEW, 0.5, { x: 100, y: 900 });
    expect(zoomed.height / zoomed.width).toBeCloseTo(1100 / 1600);
  });
});

describe("panBy", () => {
  it("moves the view", () => {
    expect(panBy({ x: 100, y: 100, width: 800, height: 550 }, 30, -20)).toEqual({ x: 130, y: 80, width: 800, height: 550 });
  });

  it("cannot pan outside the map", () => {
    const view = { x: 100, y: 100, width: 800, height: 550 };
    expect(panBy(view, -500, -500)).toEqual({ x: 0, y: 0, width: 800, height: 550 });
    expect(panBy(view, 5000, 5000)).toEqual({ x: 800, y: 550, width: 800, height: 550 });
    expect(panBy(FULL_VIEW, 50, 50)).toEqual(FULL_VIEW);
  });
});

describe("clampView", () => {
  it("limits the width and derives the height from it", () => {
    expect(clampView({ x: 0, y: 0, width: 100, height: 900 })).toEqual({ x: 0, y: 0, width: 400, height: 275 });
    expect(clampView({ x: -9, y: 9, width: 4000, height: 10 })).toEqual(FULL_VIEW);
  });
});

describe("screenToMap", () => {
  const rect = { left: 10, top: 20, width: 800, height: 550 };

  it("turns a screen position into a map position", () => {
    expect(screenToMap(FULL_VIEW, rect, 410, 295)).toEqual({ x: 800, y: 550 });
  });

  it("accounts for bars when the box has another shape than the view", () => {
    const wide = { left: 0, top: 0, width: 1000, height: 550 };
    expect(screenToMap(FULL_VIEW, wide, 100, 0)).toEqual({ x: 0, y: 0 });
    expect(screenToMap(FULL_VIEW, wide, 500, 275)).toEqual({ x: 800, y: 550 });
  });

  it("falls back to the middle of the view without a measured box", () => {
    expect(screenToMap(FULL_VIEW, { left: 0, top: 0, width: 0, height: 0 }, 5, 5)).toEqual({ x: 800, y: 550 });
  });
});
