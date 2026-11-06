import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMetronome } from "../../../packages/web/src/audio/useMetronome.js";
import { MetronomePanel } from "./MetronomePanel.js";

let latest: ReturnType<typeof useMetronome>;

function Harness() {
  const metronome = useMetronome();
  latest = metronome;
  return <MetronomePanel metronome={metronome} />;
}

beforeEach(() => {
  vi.stubGlobal(
    "AudioContext",
    class {
      currentTime = 0;
      destination = {};
      createOscillator() {
        return {
          frequency: { value: 0 },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
      }
      close = vi.fn(async () => {});
      resume = vi.fn(async () => {});
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

async function openTrainer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Tempotrainer"));
}

describe("MetronomePanel", () => {
  it("offers every subdivision", () => {
    render(<Harness />);
    const select = screen.getByLabelText("Unterteilung");
    const labels = Array.from(select.querySelectorAll("option")).map(
      (o) => o.textContent,
    );
    expect(labels).toEqual([
      "Viertel",
      "Achtel",
      "Triolen",
      "Sechzehntel",
      "Galopp",
    ]);
  });

  it("toggles an accent per beat", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const buttons = [1, 2, 3, 4].map((n) =>
      screen.getByRole("button", { name: `Betonung Schlag ${n}` }),
    );
    expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "true",
      "false",
      "false",
      "false",
    ]);
    await user.click(buttons[1]!);
    expect(
      screen.getByRole("button", { name: "Betonung Schlag 2" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("starts the speed trainer from the current tempo", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openTrainer(user);
    await user.clear(screen.getByLabelText("Bis"));
    await user.type(screen.getByLabelText("Bis"), "100");
    await user.clear(screen.getByLabelText("Plus"));
    await user.type(screen.getByLabelText("Plus"), "4");
    await user.clear(screen.getByLabelText("Alle (Takte)"));
    await user.type(screen.getByLabelText("Alle (Takte)"), "2");
    await user.click(
      screen.getByRole("button", { name: "Tempotrainer starten" }),
    );
    expect(latest.speedTrainer).toEqual({
      startBpm: 80,
      targetBpm: 100,
      stepBpm: 4,
      everyBars: 2,
    });
    expect(latest.running).toBe(true);
    expect(screen.getByText("Tempotrainer: 80 → 100 BPM")).toBeInTheDocument();
  });

  it("rejects a target below the start", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openTrainer(user);
    await user.clear(screen.getByLabelText("Bis"));
    await user.type(screen.getByLabelText("Bis"), "60");
    expect(
      screen.getByRole("button", { name: "Tempotrainer starten" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Das Ziel muss über dem aktuellen Tempo liegen."),
    ).toBeInTheDocument();
  });

  it("keeps the trainer status visible and stops it", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openTrainer(user);
    await user.click(
      screen.getByRole("button", { name: "Tempotrainer starten" }),
    );
    expect(screen.getByText("Tempotrainer: 80 → 100 BPM")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Tempotrainer stoppen" }),
    );
    expect(latest.speedTrainer).toBeNull();
    expect(screen.queryByText(/Tempotrainer: /)).toBeNull();
  });
  it("defaults the target to 20 above the tempo", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openTrainer(user);
    expect(screen.getByLabelText("Bis")).toHaveValue(100);
  });

  it("shows no alert while the trainer runs at its target", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openTrainer(user);
    await user.click(screen.getByRole("button", { name: "Tempotrainer starten" }));
    act(() => latest.setSpeedTrainer({ startBpm: 80, targetBpm: 100, stepBpm: 4, everyBars: 2 }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Tempotrainer starten" })).toBeNull();
  });

  it("shows the audio error of the metronome", async () => {
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw new Error("no audio");
        }
      },
    );
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Metronom starten" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Ton/);
  });
});
