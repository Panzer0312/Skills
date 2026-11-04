import type { GameState } from "@skills/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../packages/web/src/app/queryClient.js";
import { playSignal } from "../../../packages/web/src/audio/signalTone.js";
import { changeMetricKey, ChordTrainer } from "./ChordTrainer.js";

vi.mock("../../../packages/web/src/audio/signalTone.js", () => ({ playSignal: vi.fn() }));

const base: GameState = {
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
  records: {},
  recentQuestIds: [],
  today: null,
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function serve(records: Record<string, number> = {}, isRecord = false) {
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes("/state")) return json({ ...base, records });
    if (String(url).includes("/log")) return json({ xpGained: 5, suggestion: null, isRecord });
    if (String(url).startsWith("/api/chords")) return json({ global: [], song: [], entries: [] });
    return json({ ok: true });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function logCalls(fetchMock: ReturnType<typeof serve>) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes("/log"));
}

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function runRound() {
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  await tick(3000);
  await tick(60_000);
}

function renderTrainer(props: Parameters<typeof ChordTrainer>[0] = {}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ChordTrainer {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  queryClient.clear();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  vi.mocked(playSignal).mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ChordTrainer", () => {
  it("normalises the metric key alphabetically", () => {
    expect(changeMetricKey("Em", "Am")).toBe("wechsel:Am-Em");
    expect(changeMetricKey("Am", "Em")).toBe("wechsel:Am-Em");
  });

  it("counts in, runs 60 seconds and asks for the count", async () => {
    serve();
    renderTrainer({ pair: ["Am", "Em"] });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByRole("timer")).toHaveTextContent("3");
    await tick(1000);
    expect(screen.getByRole("timer")).toHaveTextContent("2");
    await tick(2000);
    expect(playSignal).toHaveBeenLastCalledWith("start");
    expect(screen.getByRole("timer")).toHaveTextContent("60");
    await tick(30_000);
    expect(screen.getByRole("timer")).toHaveTextContent("30");
    expect(screen.queryByLabelText("Wie viele saubere Wechsel?")).not.toBeInTheDocument();
    await tick(30_000);
    expect(playSignal).toHaveBeenLastCalledWith("ende");
    expect(screen.getByLabelText("Wie viele saubere Wechsel?")).toBeInTheDocument();
  });

  it("logs a free result with a normalised metric key", async () => {
    const fetchMock = serve();
    renderTrainer();
    fireEvent.change(screen.getByLabelText("Akkordpaar"), { target: { value: "0" } }); // Em, Am
    await runRound();
    fireEvent.change(screen.getByLabelText("Wie viele saubere Wechsel?"), { target: { value: "32" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await tick(0);
    const calls = logCalls(fetchMock);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0]![1].body)).toEqual({
      kind: "frei",
      seconds: 60,
      level: 1,
      techniqueId: "akkordwechsel",
      metricKey: "wechsel:Am-Em",
      metricValue: 32,
    });
  });

  it("shows the personal record for the chosen pair", async () => {
    serve({ "wechsel:Am-Em": 41 });
    renderTrainer({ pair: ["Em", "Am"] });
    await tick(0);
    expect(screen.getByText(/Rekord: 41/)).toBeInTheDocument();
  });

  it("celebrates a new record", async () => {
    serve({}, true);
    renderTrainer({ pair: ["Am", "Em"] });
    await runRound();
    fireEvent.change(screen.getByLabelText("Wie viele saubere Wechsel?"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await tick(0);
    expect(screen.getByText("Neuer Rekord!")).toBeInTheDocument();
  });

  it("hands the number to onResult in a quest and logs nothing", async () => {
    const fetchMock = serve();
    const onResult = vi.fn();
    renderTrainer({ pair: ["Am", "Em"], onResult });
    await runRound();
    fireEvent.change(screen.getByLabelText("Wie viele saubere Wechsel?"), { target: { value: "27" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await tick(0);
    expect(onResult).toHaveBeenCalledWith(27);
    expect(logCalls(fetchMock)).toHaveLength(0);
  });

  it("rejects a negative or empty count", async () => {
    const fetchMock = serve();
    renderTrainer({ pair: ["Am", "Em"] });
    await runRound();
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Gib eine Zahl ab 0 ein.");
    fireEvent.change(screen.getByLabelText("Wie viele saubere Wechsel?"), { target: { value: "-3" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await tick(0);
    expect(logCalls(fetchMock)).toHaveLength(0);
  });

  it("can be cancelled without logging", async () => {
    const fetchMock = serve();
    renderTrainer({ pair: ["Am", "Em"] });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await tick(3000);
    await tick(10_000);
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    await tick(60_000);
    expect(playSignal).not.toHaveBeenCalledWith("ende");
    expect(logCalls(fetchMock)).toHaveLength(0);
  });
});
