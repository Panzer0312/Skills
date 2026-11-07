import type { GameState, History, RecentLogEntry } from "@skills/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../../packages/web/src/app/queryClient.js";
import { localDayKey } from "@skills/core";
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

let recent: RecentLogEntry[] = [];

function serve(history: History | "error") {
  const mock = vi.fn(async (url: string) => {
    if (String(url).includes("/log/recent")) return json({ entries: recent });
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
  beforeEach(() => {
    queryClient.clear();
    recent = [];
  });
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

  it("calendar shades a 30 minute day darkest", async () => {
    const today = localDayKey(Date.now());
    serve({ days: [{ day: today, seconds: 1800 }], metrics: [] });
    renderIt();
    expect(await screen.findByRole("heading", { name: "Übungstage" })).toBeTruthy();
    const cell = (await screen.findAllByTitle(/: 30 min$/))[0]!;
    expect(cell.getAttribute("aria-label")).toMatch(/^\d+\. \S+ \d{4}: 30 min$/);
    expect(cell.getAttribute("data-shade")).toBe("3");
    expect(document.querySelector("[data-shade='0']")).toBeTruthy();
  });

  it("chart point shows tooltip on focus", async () => {
    serve(history);
    renderIt();
    const chart = await screen.findByRole("img", { name: /Wechsel Am–C/ });
    const point = chart.querySelectorAll("circle")[1]!;
    expect(point.getAttribute("tabindex")).toBe("0");
    fireEvent.focus(point);
    expect(screen.getByRole("status").textContent).toContain("34 am 05.11.26");
    fireEvent.blur(point);
    fireEvent.pointerDown(chart.querySelectorAll("circle")[0]!);
    expect(screen.getByRole("status").textContent).toContain("20 am 01.11.26");
  });

  it("x labels show the year", async () => {
    serve(history);
    renderIt();
    const chart = await screen.findByRole("img", { name: /Wechsel Am–C/ });
    expect(chart.textContent).toContain("01.11.26");
    expect(chart.textContent).toContain("05.11.26");
  });

  it("recent entry delete calls the route after confirm", async () => {
    recent = [
      { id: 7, at: 1, day: "2026-11-05", kind: "frei", questId: null, techniqueId: "jam", seconds: 600, metricKey: null, metricValue: null },
    ];
    const mock = serve({ days: [], metrics: [] });
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    renderIt();
    expect(await screen.findByRole("heading", { name: "Letzte Einträge" })).toBeTruthy();
    expect(await screen.findByText(/Jam Room/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Löschen" }));
    expect(confirm).toHaveBeenCalledWith("Diesen Eintrag löschen?");
    await vi.waitFor(() =>
      expect(mock.mock.calls.some(([u, init]) => String(u).endsWith("/log/7") && (init as RequestInit)?.method === "DELETE")).toBe(true),
    );
  });

  it("export link points at the export route", async () => {
    serve({ days: [], metrics: [] });
    renderIt();
    const link = await screen.findByRole("link", { name: "Daten exportieren" });
    expect(link.getAttribute("href")).toBe("/api/game/guitar/export");
    expect(link.hasAttribute("download")).toBe(true);
  });
});
