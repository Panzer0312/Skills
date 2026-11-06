import type { GameState } from "@skills/core";
import { localDayKey } from "@skills/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { frequencyOf } from "@skills/core";
import { queryClient } from "../../../packages/web/src/app/queryClient.js";
import { NoteFinder } from "./NoteFinder.js";

const mic = vi.hoisted(() => ({
  state: "idle" as string,
  error: null as string | null,
  start: vi.fn(),
  stop: vi.fn(),
  onBuffer: null as null | ((buffer: Float32Array, sampleRate: number) => void),
}));
vi.mock("../../../packages/web/src/audio/useMicrophone.js", () => ({
  useMicrophone: (options: { onBuffer: (buffer: Float32Array, sampleRate: number) => void }) => {
    mic.onBuffer = options.onBuffer;
    return mic;
  },
}));
vi.mock("../../../packages/web/src/audio/signalTone.js", () => ({ playSignal: vi.fn() }));

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
  chosenLessons: [],
  today: null,
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function serve() {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (String(url).includes("/state")) return json(base);
    if (String(url).includes("/log")) return json({ xpGained: 5, suggestion: null, isRecord: false });
    return json({ ok: true });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function renderFinder(props: Parameters<typeof NoteFinder>[0] = { strings: [0] }) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NoteFinder {...props} />
    </QueryClientProvider>,
  );
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H"];
const OPEN_E = 4;

/** Fret on the low E string of the asked note, read from the prompt. */
function targetFret(): number {
  const name = /Finde (\S+) auf/.exec(screen.getByTestId("prompt").textContent!)![1]!;
  return (NOTE_NAMES.indexOf(name) - OPEN_E + 12) % 12;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  queryClient.clear();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  mic.state = "idle";
  mic.error = null;
  mic.start.mockClear();
  mic.stop.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("NoteFinder", () => {
  it("asks for a note in German", () => {
    serve();
    renderFinder();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByTestId("prompt")).toHaveTextContent(/^Finde \S+ auf der E-Saite$/);
  });

  it("scores a click on the right fret", () => {
    serve();
    renderFinder();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    const before = screen.getByTestId("prompt").textContent;
    fireEvent.click(screen.getByTestId(`finder-0-${targetFret()}`));
    expect(screen.getByText("Treffer: 1")).toBeInTheDocument();
    expect(screen.getByTestId("prompt").textContent).not.toBe(before);
  });

  it("shows the right place after a wrong click", () => {
    serve();
    renderFinder();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    const right = targetFret();
    fireEvent.click(screen.getByTestId(`finder-0-${(right + 1) % 12}`));
    expect(screen.getByText("Treffer: 0")).toBeInTheDocument();
    expect(screen.getByTestId(`finder-0-${right}`)).toHaveAttribute("data-root", "true");
  });

  it("hides note names during the round", () => {
    serve();
    renderFinder();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    for (const cell of screen.getAllByTestId(/^finder-/)) expect(cell).toHaveTextContent("");
  });

  it("offers the click mode when the microphone is denied", () => {
    serve();
    mic.state = "denied";
    mic.error = "Der Zugriff auf das Mikrofon wurde abgelehnt.";
    renderFinder();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByText(/abgelehnt/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`finder-0-${targetFret()}`));
    expect(screen.getByText("Treffer: 1")).toBeInTheDocument();
  });

  it("turns the microphone on only on request", () => {
    serve();
    renderFinder();
    expect(mic.start).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mit Gitarre spielen" }));
    expect(mic.start).toHaveBeenCalled();
  });

  it("ends after 60 seconds and logs free time", async () => {
    const fetchMock = serve();
    renderFinder();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByTestId(`finder-0-${targetFret()}`));
    await tick(60_000);
    const calls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/log"));
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0]![1]?.body))).toEqual({
      kind: "frei",
      seconds: 60,
      level: 1,
      techniqueId: "theorie",
      metricKey: "notenfinder:0",
      metricValue: 3,
    });
  });

  it("hands the result to the quest", async () => {
    const fetchMock = serve();
    const onResult = vi.fn();
    renderFinder({ strings: [0], onResult });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    fireEvent.click(screen.getByTestId(`finder-0-${targetFret()}`));
    await tick(60_000);
    expect(onResult).toHaveBeenCalledWith(1);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/log"))).toHaveLength(0);
  });

  it("releases the microphone when the round ends", async () => {
    serve();
    renderFinder();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    mic.stop.mockClear();
    await tick(59_000);
    expect(mic.stop).not.toHaveBeenCalled();
    await tick(1_000);
    expect(mic.stop).toHaveBeenCalledTimes(1);
  });

  it("scores a pitch held on the microphone", async () => {
    serve();
    renderFinder();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    const name = /Finde (\S+) auf/.exec(screen.getByTestId("prompt").textContent!)![1]!;
    const sampleRate = 44100;
    // The octave does not matter: the match accepts one octave either way.
    const frequency = frequencyOf(`${name === "H" ? "B" : name}2`);
    const buffer = new Float32Array(4096);
    for (let i = 0; i < buffer.length; i += 1) buffer[i] = 0.5 * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    for (let ms = 0; ms <= 300; ms += 50) {
      act(() => mic.onBuffer!(buffer, sampleRate));
      await tick(50);
    }
    expect(screen.getByText("Treffer: 1")).toBeInTheDocument();
  });
  it("moves the level meter before the round starts", () => {
    serve();
    mic.state = "running";
    renderFinder();
    const loud = new Float32Array(4096).fill(0.5);
    act(() => mic.onBuffer!(loud, 44100));
    expect(Number(screen.getByRole("meter").getAttribute("aria-valuenow"))).toBeGreaterThan(0);
  });

  it("logs nothing for a round without hits and shows no record", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes("/state")) return json(base);
      if (String(url).includes("/log")) return json({ xpGained: 5, suggestion: null, isRecord: true });
      return json({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderFinder();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await tick(60_000);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/log"))).toHaveLength(0);
    expect(screen.queryByText("Neuer Rekord!")).toBeNull();
    expect(screen.getByText("Keine Treffer in dieser Runde. Beim nächsten Mal klappt es.")).toBeInTheDocument();
  });
});
