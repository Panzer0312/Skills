import type { GameState, History } from "@skills/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../../packages/web/src/app/queryClient.js";
import { Chronicle } from "./Chronicle.js";

const state: GameState = {
  day: "2026-11-06",
  placed: true,
  targetSongId: null,
  xp: 0,
  level: 1,
  title: "Novice",
  xpIntoLevel: 0,
  xpForNext: 100,
  streak: 0,
  totalSeconds: 0,
  weekSeconds: 0,
  doneToday: [],
  levels: {},
  lessons: {},
  chosenLessons: [],
  records: {},
  recentQuestIds: [],
  storySeen: [],
  today: null,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function serve(history: History | "error") {
  const mock = vi.fn(async (url: string) => {
    if (String(url).includes("/history")) {
      return history === "error" ? json({ error: { code: "x", message: "kaputt" } }, 500) : json(history);
    }
    return json(state);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

const renderIt = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Chronicle />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const history: History = {
  days: [{ day: "2026-11-05", seconds: 1200 }],
  metrics: [
    { key: "wechsel:Am-C", day: "2026-11-01", value: 20 },
    { key: "wechsel:Am-C", day: "2026-11-05", value: 34 },
    { key: "wechsel:Am-Em", day: "2026-11-03", value: 25 },
  ],
};

describe("Chronicle", () => {
  beforeEach(() => queryClient.clear());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("draws one line per chosen pair", async () => {
    serve(history);
    renderIt();
    const chart = await screen.findByRole("img", { name: "Wechsel Am–C, zuletzt 34" });
    expect(chart.querySelectorAll("polyline")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Wechsel"), { target: { value: "wechsel:Am-Em" } });
    const both = await screen.findByRole("img", { name: /Wechsel Am–C, zuletzt 34; Am–Em, zuletzt 25/ });
    expect(both.querySelectorAll("polyline")).toHaveLength(1);
    expect(both.querySelectorAll("circle")).toHaveLength(3);
    expect(both.querySelectorAll("[data-testid=series]")).toHaveLength(2);
  });

  it("shows a single result as a point", async () => {
    serve({ days: [], metrics: [{ key: "wechsel:Am-C", day: "2026-11-05", value: 12 }] });
    renderIt();
    const chart = await screen.findByRole("img", { name: "Wechsel Am–C, zuletzt 12" });
    expect(chart.querySelectorAll("circle")).toHaveLength(1);
    expect(chart.querySelectorAll("polyline")).toHaveLength(0);
  });

  it("draws the best tempo of a quest as a line", async () => {
    serve({
      days: [],
      metrics: [
        { key: "palm-mute-akzente", day: "2026-11-01", value: 80 },
        { key: "palm-mute-akzente", day: "2026-11-05", value: 96 },
      ],
    });
    renderIt();
    expect(await screen.findByRole("heading", { name: "Sauberes Tempo" })).toBeTruthy();
    const chart = await screen.findByRole("img", { name: /Tempo: .*, zuletzt 96/ });
    expect(chart.querySelectorAll("polyline")).toHaveLength(1);
    expect(chart.querySelectorAll("circle")).toHaveLength(2);
  });

  it("names the note finder rounds in German and shows at most four lines", async () => {
    const keys = ["notenfinder:0", "notenfinder:1", "notenfinder:0-1", "notenfinder:0-1-2-3-4-5", "noten-e-saite"];
    serve({ days: [], metrics: keys.map((key, i) => ({ key, day: `2026-11-0${i + 1}`, value: 10 + i })) });
    renderIt();
    const chart = await screen.findByRole("img", { name: /^Noten finden: / });
    const name = chart.getAttribute("aria-label")!;
    expect(name).toContain("Alle, zuletzt 13");
    expect(name).toContain("E und A, zuletzt 12");
    expect(name).not.toMatch(/notenfinder/);
    expect(chart.querySelectorAll("[data-testid=series]")).toHaveLength(4);
  });

  it("names the note finder records in German", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("/history")
          ? json({ days: [], metrics: [] })
          : json({ ...state, records: { "notenfinder:0-1-2-3-4-5": 21, "notenfinder:1": 9 } }),
      ),
    );
    renderIt();
    expect(await screen.findByText("Noten finden, Alle")).toBeTruthy();
    expect(screen.getByText("Noten finden, A-Saite")).toBeTruthy();
  });

  it("says so when nothing is measured yet", async () => {
    serve({ days: [], metrics: [] });
    renderIt();
    expect(await screen.findByText("Noch keine Messwerte")).toBeTruthy();
  });

  it("shows an error with retry when the history fails", async () => {
    const mock = serve("error");
    renderIt();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Noch keine Messwerte")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    const calls = () => mock.mock.calls.filter(([u]) => String(u).includes("/history")).length;
    const before = calls();
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    await vi.waitFor(() => expect(calls()).toBeGreaterThan(before));
  });

  it("shows nothing false while loading", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    renderIt();
    expect(await screen.findByText(/Verlauf wird geladen/)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText("Noch keine Messwerte")).toBeNull();
  });
});
