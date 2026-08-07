import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PracticePlan from "./PracticePlan.js";

vi.mock("../../../packages/web/src/audio/useMetronome.js", () => ({
  useMetronome: () => ({
    bpm: 80,
    setBpm: vi.fn(),
    beatsPerBar: 4,
    setBeatsPerBar: vi.fn(),
    running: false,
    start: vi.fn(),
    stop: vi.fn(),
    tap: vi.fn(),
    currentBeat: 0,
  }),
}));

const plan = [
  { id: "aufwaermen", titel: "Aufwärmen", minuten: 5, beschreibung: "Chromatik 1-2-3-4", bpm: 60 },
  { id: "song", titel: "Song", minuten: 10, beschreibung: "Aktuelles Stück" },
];

const progress = { record: vi.fn(), get: () => null, complete: vi.fn(async () => {}) };

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

describe("PracticePlan", () => {
  it("lists every block with its duration", () => {
    render(<PracticePlan data={[plan]} progress={progress} settings={{}} />);
    expect(screen.getByText("Aufwärmen")).toBeInTheDocument();
    expect(screen.getByText(/5 Minuten/)).toBeInTheDocument();
    expect(screen.getByText(/10 Minuten/)).toBeInTheDocument();
  });

  it("counts a started block down", async () => {
    render(<PracticePlan data={[plan]} progress={progress} settings={{}} />);
    await userEvent.click(screen.getAllByRole("button", { name: /Starten/ })[0]!);
    expect(screen.getByTestId("timer")).toHaveTextContent("05:00");
    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByTestId("timer")).toHaveTextContent("04:59");
  });

  it("records a completed block", async () => {
    render(<PracticePlan data={[plan]} progress={progress} settings={{}} />);
    await userEvent.click(screen.getAllByRole("button", { name: /Starten/ })[0]!);
    await userEvent.click(screen.getByRole("button", { name: /Fertig/ }));
    expect(progress.record).toHaveBeenCalledWith("aufwaermen", "correct");
  });

  it("shows the total practice time", () => {
    render(<PracticePlan data={[plan]} progress={progress} settings={{}} />);
    expect(screen.getByText(/15 Minuten insgesamt/)).toBeInTheDocument();
  });
});
