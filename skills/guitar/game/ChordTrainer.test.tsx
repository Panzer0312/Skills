import type { GameState } from "@skills/core";
import { localDayKey } from "@skills/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../packages/web/src/app/queryClient.js";
import {
  playClick,
  playSignal,
} from "../../../packages/web/src/audio/signalTone.js";
import GameApp from "../widgets/GameApp.js";
vi.mock("./usePref.js", async () => ({ usePref: (await import("./testPrefs.js")).usePref }));
import { resetTestPrefs, testPref } from "./testPrefs.js";
import { changeMetricKey, ChordTrainer } from "./ChordTrainer.js";

vi.mock("../../../packages/web/src/audio/signalTone.js", () => ({
  playSignal: vi.fn(),
  playClick: vi.fn(),
}));

const base: GameState = {
  day: localDayKey(Date.now()),
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
  storySeen: [],
  today: null,
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function serve(records: Record<string, number> = {}, isRecord = false) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (String(url).includes("/state")) return json({ ...base, records });
    if (String(url).includes("/log"))
      return json({ logId: 7, xpGained: 5, suggestion: null, isRecord });
    if (String(url).startsWith("/api/chords"))
      return json({ global: [], song: [], entries: [] });
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
  vi.mocked(playClick).mockClear();
  resetTestPrefs();
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
    expect(screen.getByRole("timer")).toHaveTextContent("4");
    await tick(1000);
    expect(screen.getByRole("timer")).toHaveTextContent("3");
    await tick(2000);
    expect(playSignal).toHaveBeenLastCalledWith("start");
    expect(screen.getByRole("timer")).toHaveTextContent("60");
    await tick(30_000);
    expect(screen.getByRole("timer")).toHaveTextContent("30");
    expect(
      screen.queryByLabelText("Wie viele saubere Wechsel?"),
    ).not.toBeInTheDocument();
    await tick(30_000);
    expect(playSignal).toHaveBeenLastCalledWith("ende");
    expect(
      screen.getByLabelText("Wie viele saubere Wechsel?"),
    ).toBeInTheDocument();
  });

  it("logs a free result with a normalised metric key", async () => {
    const fetchMock = serve();
    renderTrainer();
    fireEvent.change(screen.getByLabelText("Akkordpaar"), {
      target: { value: "0" },
    }); // Em, Am
    await runRound();
    fireEvent.change(screen.getByLabelText("Wie viele saubere Wechsel?"), {
      target: { value: "32" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await tick(0);
    const calls = logCalls(fetchMock);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0]![1]?.body))).toEqual({
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
    fireEvent.change(screen.getByLabelText("Wie viele saubere Wechsel?"), {
      target: { value: "40" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await tick(0);
    expect(screen.getByText("Neuer Rekord!")).toBeInTheDocument();
  });

  it("hides the gains once the result is undone", async () => {
    serve({}, true);
    renderTrainer({ pair: ["Am", "Em"] });
    await runRound();
    fireEvent.change(screen.getByLabelText("Wie viele saubere Wechsel?"), {
      target: { value: "40" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await tick(0);
    expect(screen.getByText("+5 XP")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    await tick(0);
    expect(screen.getByText("Eintrag entfernt.")).toBeInTheDocument();
    expect(screen.queryByText("+5 XP")).toBeNull();
    expect(screen.queryByText("Neuer Rekord!")).toBeNull();
  });

  it("hands the number to onResult in a quest and logs nothing", async () => {
    const fetchMock = serve();
    const onResult = vi.fn();
    renderTrainer({ pair: ["Am", "Em"], onResult });
    await runRound();
    fireEvent.change(screen.getByLabelText("Wie viele saubere Wechsel?"), {
      target: { value: "27" },
    });
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
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Gib eine Zahl ab 0 ein.",
    );
    fireEvent.change(screen.getByLabelText("Wie viele saubere Wechsel?"), {
      target: { value: "-3" },
    });
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

  it("logs only once on a double submit", async () => {
    const fetchMock = serve();
    renderTrainer({ pair: ["Am", "Em"] });
    await runRound();
    fireEvent.change(screen.getByLabelText("Wie viele saubere Wechsel?"), {
      target: { value: "30" },
    });
    const button = screen.getByRole("button", { name: "Speichern" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    await tick(0);
    expect(logCalls(fetchMock)).toHaveLength(1);
  });

  it("shows an error and allows a retry when saving fails", async () => {
    const fetchMock = serve();
    renderTrainer({ pair: ["Am", "Em"] });
    await runRound();
    fireEvent.change(screen.getByLabelText("Wie viele saubere Wechsel?"), {
      target: { value: "30" },
    });
    fetchMock.mockImplementationOnce(
      async () =>
        new Response("{}", {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
    );
    // first fetch after this point is the log call
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await tick(0);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "konnte nicht gespeichert",
    );
    expect(screen.getByRole("button", { name: "Speichern" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await tick(0);
    expect(screen.getByText(/XP/)).toBeInTheDocument();
  });

  it("still reaches the question when the signal throws", async () => {
    serve();
    vi.mocked(playSignal).mockImplementation(() => {
      throw new Error("no audio");
    });
    renderTrainer({ pair: ["Am", "Em"] });
    await runRound();
    expect(
      screen.getByLabelText("Wie viele saubere Wechsel?"),
    ).toBeInTheDocument();
    vi.mocked(playSignal).mockReset();
  });
});

describe("ChordTrainer count-in and custom pair", () => {
  it("count-in clicks four times before the start signal", async () => {
    serve();
    renderTrainer({ pair: ["Am", "Em"] });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await tick(3000);
    const calls = vi.mocked(playClick).mock.calls;
    expect(calls).toEqual([[true], [false], [false], [false]]);
    expect(playSignal).toHaveBeenLastCalledWith("start");
  });

  it("count-in follows countInBpm", async () => {
    serve();
    renderTrainer({ pair: ["Am", "Em"], countInBpm: 120 });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await tick(1800);
    expect(playSignal).not.toHaveBeenCalledWith("start");
    await tick(300);
    expect(playSignal).toHaveBeenCalledWith("start");
    expect(playClick).toHaveBeenCalledTimes(4);
  });

  async function pickCustom(a: string, b: string) {
    fireEvent.change(screen.getByLabelText("Akkordpaar"), {
      target: { value: "custom" },
    });
    fireEvent.change(screen.getByLabelText("Erster Akkord"), {
      target: { value: a },
    });
    fireEvent.change(screen.getByLabelText("Zweiter Akkord"), {
      target: { value: b },
    });
  }

  it("tools read and write prefs: custom pair", async () => {
    serve();
    resetTestPrefs({ "werkzeuge.akkordtrainer.eigenesPaar": ["D", "A"] });
    renderTrainer();
    fireEvent.change(screen.getByLabelText("Akkordpaar"), { target: { value: "custom" } });
    expect(screen.getByLabelText("Erster Akkord")).toHaveValue("D");
    fireEvent.change(screen.getByLabelText("Zweiter Akkord"), { target: { value: "E" } });
    expect(testPref("werkzeuge.akkordtrainer.eigenesPaar")).toEqual(["D", "E"]);
  });

  it("custom pair logs its metric key", async () => {
    const fetchMock = serve();
    renderTrainer();
    await pickCustom("C", "G7");
    await runRound();
    fireEvent.change(screen.getByLabelText("Wie viele saubere Wechsel?"), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await tick(0);
    const calls = logCalls(fetchMock);
    expect(JSON.parse(String(calls[0]![1]?.body)).metricKey).toBe(
      "wechsel:C-G7",
    );
  });

  it("trims whitespace around custom chords", async () => {
    const fetchMock = serve();
    renderTrainer();
    await pickCustom(" C", "G7 ");
    await runRound();
    fireEvent.change(screen.getByLabelText("Wie viele saubere Wechsel?"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await tick(0);
    expect(JSON.parse(String(logCalls(fetchMock)[0]![1]?.body)).metricKey).toBe(
      "wechsel:C-G7",
    );
  });

  it("rejects identical custom chords", async () => {
    serve();
    renderTrainer();
    await pickCustom("C", " C");
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(
      screen.getByText("Zwei verschiedene Akkorde wählen"),
    ).toBeInTheDocument();
  });

  it("clicks at exact beat times at 80 BPM", async () => {
    serve();
    renderTrainer({ pair: ["Am", "Em"] });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(playClick).toHaveBeenCalledTimes(1);
    await tick(749);
    expect(playClick).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(playClick).toHaveBeenCalledTimes(2);
    await tick(750);
    expect(playClick).toHaveBeenCalledTimes(3);
    await tick(749);
    expect(playClick).toHaveBeenCalledTimes(3);
    await tick(1);
    expect(playClick).toHaveBeenCalledTimes(4);
    expect(playSignal).not.toHaveBeenCalledWith("start");
    await tick(750);
    expect(playSignal).toHaveBeenCalledWith("start");
  });

  it("cancel during count-in stops clicks and the start signal", async () => {
    serve();
    renderTrainer({ pair: ["Am", "Em"] });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await tick(800);
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    await tick(5000);
    expect(playClick).toHaveBeenCalledTimes(2);
    expect(playSignal).not.toHaveBeenCalled();
  });

  it("unknown custom chord disables start", async () => {
    serve();
    renderTrainer();
    await pickCustom("C", "Qx9");
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(screen.getByText("Unbekannter Akkord")).toBeInTheDocument();
  });

  it("s key starts a round", async () => {
    serve();
    renderTrainer({ pair: ["Am", "Em"] });
    fireEvent.keyDown(window, { key: "s" });
    expect(screen.getByRole("timer")).toBeInTheDocument();
  });
});

describe("ChordTrainer in a quest", () => {
  const progress = { record: vi.fn(), get: () => null, complete: vi.fn() };

  async function renderQuest() {
    // The intro is done, so the deep link to the quest is not sent to the village.
    resetTestPrefs({ "intro.gesehen": true });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={["/vollbild/guitar/spiel/quest/wechsel-minute"]}
        >
          <Routes>
            <Route
              path="/vollbild/:skillId/:moduleId/*"
              element={<GameApp data={[]} progress={progress} settings={{}} />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await tick(0);
  }

  async function playRound(changes: number) {
    await runRound();
    fireEvent.change(screen.getByLabelText("Wie viele saubere Wechsel?"), {
      target: { value: String(changes) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await tick(0);
  }

  it("keeps the best of two rounds for the log", async () => {
    const fetchMock = serve();
    await renderQuest();
    expect(screen.queryByText(/Beste Runde/)).not.toBeInTheDocument();

    await playRound(14);
    expect(screen.getByText(/Beste Runde: 14/)).toHaveTextContent("Fertig");

    await playRound(9);
    expect(screen.getByText(/Beste Runde: 14/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fertig" }));
    await tick(0);
    expect(screen.getByLabelText("Wechsel pro Minute")).toHaveValue(14);
    fireEvent.click(screen.getByRole("button", { name: "Passt" }));
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await tick(0);
    const calls = logCalls(fetchMock);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0]![1]?.body))).toMatchObject({
      metricValue: 14,
    });
  });

  it("raises the best round when a later one beats it", async () => {
    serve();
    await renderQuest();
    await playRound(9);
    await playRound(14);
    expect(screen.getByText(/Beste Runde: 14/)).toBeInTheDocument();
  });

  it("onRunningChange reports start and end", async () => {
    serve();
    const onRunningChange = vi.fn();
    const view = renderTrainer({ pair: ["Am", "Em"], onRunningChange });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(onRunningChange).toHaveBeenLastCalledWith(true);
    await tick(3000);
    await tick(60_000);
    expect(onRunningChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(screen.getByLabelText("Wie viele saubere Wechsel?"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await tick(0);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(onRunningChange).toHaveBeenLastCalledWith(true);
    view.unmount();
    expect(onRunningChange).toHaveBeenLastCalledWith(false);
  });

  it("cancels the round when cancelSignal changes", async () => {
    serve();
    const onRunningChange = vi.fn();
    const props = { pair: ["Am", "Em"] as [string, string], onRunningChange };
    const view = renderTrainer({ ...props, cancelSignal: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await tick(3000);
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <ChordTrainer {...props} cancelSignal={1} />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(onRunningChange).toHaveBeenLastCalledWith(false);
  });
});
