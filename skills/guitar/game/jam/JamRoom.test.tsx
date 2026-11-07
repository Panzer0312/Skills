import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JamRoom } from "./JamRoom.js";

vi.mock("../api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api.js")>()),
  gameApi: { log: vi.fn(async () => ({ xpGained: 0, suggestion: null, isRecord: false })) },
}));

const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
});

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "AudioContext",
    class {
      currentTime = 0;
      sampleRate = 8000;
      destination = {};
      createOscillator = () => ({ frequency: param(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() });
      createGain = () => ({ gain: param(), connect: vi.fn() });
      createBuffer = (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) });
      createBufferSource = () => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn() });
      createBiquadFilter = () => ({ frequency: param(), connect: vi.fn() });
      close = vi.fn(async () => {});
      resume = vi.fn(async () => {});
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("JamRoom", () => {
  it("shows the matching scale on the fretboard", async () => {
    const user = userEvent.setup();
    render(<JamRoom />);
    await user.selectOptions(screen.getByLabelText("Tonart"), "A");
    await user.selectOptions(screen.getByLabelText("Stil"), "metal");
    // F on the low E string is in A natural minor, but not in its pentatonic.
    expect(screen.getByTestId("fret-0-1")).toHaveAttribute("data-in-scale", "true");
    expect(screen.getByTestId("fret-0-5")).toHaveAttribute("data-root", "true");
  });

  it("narrows the scale to a box", async () => {
    const user = userEvent.setup();
    render(<JamRoom />);
    await user.selectOptions(screen.getByLabelText("Tonart"), "A");
    expect(screen.getByTestId("fret-0-10")).toHaveAttribute("data-in-scale", "true");
    await user.selectOptions(screen.getByLabelText("Box"), "1");
    expect(screen.getByTestId("fret-0-10")).toHaveAttribute("data-in-scale", "false");
    expect(screen.getByLabelText("Box")).toHaveValue("1");
    await user.selectOptions(screen.getByLabelText("Stil"), "metal");
    expect(screen.queryByLabelText("Box")).not.toBeInTheDocument();
  });

  it("shows the current and next chord while playing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<JamRoom />);
    await user.click(screen.getByRole("button", { name: "Starten" }));
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId("jam-chord")).toHaveTextContent("Em");
    expect(screen.getByTestId("jam-next")).toHaveTextContent("C");
    expect(screen.getByRole("button", { name: "Stoppen" })).toBeInTheDocument();
  });

  it("keeps playing when the key changes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<JamRoom />);
    await user.click(screen.getByRole("button", { name: "Starten" }));
    await user.selectOptions(screen.getByLabelText("Tonart"), "A");
    expect(screen.getByRole("button", { name: "Stoppen" })).toBeInTheDocument();
    expect(screen.getByTestId("fret-0-5")).toHaveAttribute("data-root", "true");
  });

  it("shows German note names for B", async () => {
    const user = userEvent.setup();
    render(<JamRoom />);
    expect(screen.getByRole("option", { name: "H" })).toHaveValue("B");
    await user.selectOptions(screen.getByLabelText("Tonart"), "B");
    await user.selectOptions(screen.getByLabelText("Stil"), "blues");
    expect(screen.getByText(/Spiele dazu: H /)).toBeInTheDocument();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await user.click(screen.getByRole("button", { name: "Starten" }));
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId("jam-chord")).toHaveTextContent("H7");
  });

  it("says an unsupported browser cannot play", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("AudioContext", undefined);
    render(<JamRoom />);
    expect(screen.getByRole("alert")).toHaveTextContent("Dein Browser kann keinen Ton erzeugen");
    expect(screen.getByRole("button", { name: "Starten" })).toBeDisabled();
  });

  it("jam restores style and bpm", () => {
    localStorage.setItem(
      "guitar.jam",
      JSON.stringify({ root: "A", style: "blues", bpm: 120, volume: 0.4 }),
    );
    render(<JamRoom />);
    expect(screen.getByLabelText("Tonart")).toHaveValue("A");
    expect(screen.getByLabelText("Stil")).toHaveValue("blues");
    expect(screen.getByText("120 BPM")).toBeInTheDocument();
  });

  it("jam ignores unknown stored style", () => {
    localStorage.setItem(
      "guitar.jam",
      JSON.stringify({ root: "A", style: "polka", bpm: 120, volume: 0.4 }),
    );
    render(<JamRoom />);
    expect(screen.getByLabelText("Stil")).toHaveValue("rock");
    expect(screen.getByText("90 BPM")).toBeInTheDocument();
  });

  it("jam space starts and stops", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<JamRoom />);
    await user.keyboard(" ");
    expect(screen.getByRole("button", { name: "Stoppen" })).toBeInTheDocument();
    await user.keyboard(" ");
    expect(screen.getByRole("button", { name: "Starten" })).toBeInTheDocument();
  });
});
