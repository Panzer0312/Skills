import { describe, expect, it } from "vitest";
import { dayGrid, metricGroup, metricSeries, weeklyMinutes } from "./chronicle.js";
import type { QuestDefinition } from "./quests.js";

const quest = (extra: object) => ({ id: "q", ...extra }) as unknown as QuestDefinition;

describe("weeklyMinutes", () => {
  it("returns 12 weeks, oldest first, with empty weeks as 0", () => {
    const weeks = weeklyMinutes([], "2026-11-06");
    expect(weeks).toHaveLength(12);
    expect(weeks[11]).toEqual({ weekStart: "2026-11-02", minutes: 0 });
    expect(weeks[0]!.weekStart).toBe("2026-08-17");
    expect(weeks.every((w) => w.minutes === 0)).toBe(true);
  });
  it("sums days into their week and rounds seconds to minutes", () => {
    const weeks = weeklyMinutes(
      [
        { day: "2026-11-02", seconds: 100 },
        { day: "2026-11-05", seconds: 80 },
        { day: "2026-10-27", seconds: 600 },
      ],
      "2026-11-06",
    );
    expect(weeks[11]!.minutes).toBe(3);
    expect(weeks[10]).toEqual({ weekStart: "2026-10-26", minutes: 10 });
  });
  it("ignores a day before the window", () => {
    const weeks = weeklyMinutes([{ day: "2026-08-16", seconds: 6000 }], "2026-11-06");
    expect(weeks.reduce((s, w) => s + w.minutes, 0)).toBe(0);
  });
  it("honours a custom week count", () => {
    expect(weeklyMinutes([], "2026-11-06", 4)).toHaveLength(4);
  });
});

describe("metricGroup", () => {
  it("sorts keys into groups", () => {
    expect(metricGroup("wechsel:Am-C", [])).toBe("wechsel");
    expect(metricGroup("tempo", [quest({ id: "tempo", metricLabel: "Sauberes Tempo (BPM)" })])).toBe("bpm");
    expect(metricGroup("notenfinder:0", [])).toBe("noten");
    expect(metricGroup("nf", [quest({ id: "nf", noteGame: { x: 1 } })])).toBe("noten");
    expect(metricGroup("unbekannt", [])).toBe("andere");
    expect(metricGroup("runs", [quest({ id: "runs", metricLabel: "Ganze Durchläufe" })])).toBe("andere");
  });
});

describe("metricSeries", () => {
  it("sorts by day and does not invent days", () => {
    const series = metricSeries(
      [
        { key: "a", day: "2026-11-05", value: 3 },
        { key: "b", day: "2026-11-01", value: 9 },
        { key: "a", day: "2026-11-01", value: 2 },
      ],
      "a",
    );
    expect(series).toEqual([
      { day: "2026-11-01", value: 2 },
      { day: "2026-11-05", value: 3 },
    ]);
  });
});

describe("dayGrid", () => {
  it("groups by monday weeks and omits future days", () => {
    const grid = dayGrid([{ day: "2026-11-03", seconds: 1500 }], "2026-11-04", 2);
    expect(grid).toHaveLength(2);
    expect(grid[0]!.map((d) => d.day)).toEqual([
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01",
    ]);
    expect(grid[1]!.map((d) => d.day)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
    expect(grid[1]![1]).toEqual({ day: "2026-11-03", minutes: 25 });
    expect(grid[0]![0]!.minutes).toBe(0);
  });
});
