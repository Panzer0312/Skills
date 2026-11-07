import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gameApi } from "./api.js";
import { FreePractice } from "./FreePractice.js";
import { getFreeTimerRunning } from "./freeTimerStore.js";

let askAfter = 90;
vi.mock("./usePref.js", () => ({
  usePref: () => [askAfter, () => undefined, { loading: false }],
}));
vi.mock("./UndoButton.js", () => ({
  UndoButton: ({ onUndone }: { onUndone?: () => void }) => (
    <button type="button" onClick={onUndone}>
      Rückgängig
    </button>
  ),
}));

const result = { xpGained: 12, goldGained: 3, logId: 9 };

function open() {
  fireEvent.click(screen.getByRole("button", { name: /Frei üben/ }));
}

beforeEach(() => {
  askAfter = 90;
  localStorage.clear();
  vi.spyOn(gameApi, "recentLog").mockResolvedValue({ entries: [] });
});

function entry(at: number, seconds: number) {
  return { id: 1, at, day: "2026-11-07", kind: "quest" as const, questId: null, techniqueId: null, seconds, metricKey: null, metricValue: null };
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("FreePractice", () => {
  it("manual minutes log a free entry", async () => {
    const log = vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    render(<FreePractice />);
    open();
    fireEvent.change(screen.getByLabelText("Minuten"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Eintragen" }));
    await waitFor(() => expect(log).toHaveBeenCalledWith({ kind: "frei", seconds: 1200, level: 1, techniqueId: "song" }));
    expect(await screen.findByText("+12 XP · +3 Gold")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rückgängig" })).toBeInTheDocument();
  });

  it("hides the gains once the entry is undone and shows them for the next save", async () => {
    vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    render(<FreePractice />);
    open();
    fireEvent.change(screen.getByLabelText("Minuten"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Eintragen" }));
    await screen.findByText("+12 XP · +3 Gold");
    fireEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    expect(screen.queryByText("+12 XP · +3 Gold")).toBeNull();
    fireEvent.change(screen.getByLabelText("Minuten"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Eintragen" }));
    expect(await screen.findByText("+12 XP · +3 Gold")).toBeInTheDocument();
  });

  it("tells the ambience while the timer runs", () => {
    render(<FreePractice />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Timer starten" }));
    expect(getFreeTimerRunning()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Verwerfen" }));
    expect(getFreeTimerRunning()).toBe(false);
  });

  it("explains a failed save", async () => {
    vi.spyOn(gameApi, "log").mockRejectedValue(new Error("offline"));
    render(<FreePractice />);
    open();
    fireEvent.change(screen.getByLabelText("Minuten"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Eintragen" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Das Ergebnis konnte nicht gespeichert werden. Bitte später erneut versuchen.",
    );
  });

  it("uses the chosen kind", async () => {
    const log = vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    render(<FreePractice />);
    open();
    fireEvent.change(screen.getByLabelText("Was"), { target: { value: "jam" } });
    fireEvent.change(screen.getByLabelText("Minuten"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Eintragen" }));
    await waitFor(() => expect(log).toHaveBeenCalledWith(expect.objectContaining({ techniqueId: "jam", seconds: 300 })));
  });

  it("timer survives remount", () => {
    const first = render(<FreePractice />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Timer starten" }));
    expect(JSON.parse(localStorage.getItem("guitar.freeTimer") ?? "null")).toMatchObject({ techniqueId: "song" });
    first.unmount();
    render(<FreePractice />);
    expect(screen.getByRole("button", { name: /0:0\d/ })).toBeInTheDocument();
    open();
    expect(screen.getByRole("button", { name: "Timer stoppen und speichern" })).toBeInTheDocument();
  });

  it("stopping a long timer logs the elapsed seconds", async () => {
    const log = vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    localStorage.setItem("guitar.freeTimer", JSON.stringify({ startedAt: Date.now() - 600_000, techniqueId: "frei-technik" }));
    render(<FreePractice />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Timer stoppen und speichern" }));
    await waitFor(() => expect(log).toHaveBeenCalled());
    const body = log.mock.calls[0]![0];
    expect(body).toMatchObject({ kind: "frei", level: 1, techniqueId: "frei-technik" });
    expect(Math.abs(body.seconds - 600)).toBeLessThan(5);
    expect(JSON.parse(localStorage.getItem("guitar.freeTimer") ?? "null")).toBeNull();
  });

  it("short timer logs nothing", () => {
    const log = vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    render(<FreePractice />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Timer starten" }));
    fireEvent.click(screen.getByRole("button", { name: "Timer stoppen und speichern" }));
    expect(screen.getByText("Unter einer Minute, nichts gespeichert.")).toBeInTheDocument();
    expect(log).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("guitar.freeTimer") ?? "null")).toBeNull();
  });

  it("minutes outside 1-240 are refused", () => {
    const log = vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    render(<FreePractice />);
    open();
    for (const v of ["0", "241", ""]) {
      fireEvent.change(screen.getByLabelText("Minuten"), { target: { value: v } });
      fireEvent.click(screen.getByRole("button", { name: "Eintragen" }));
      expect(screen.getByText("Bitte 1 bis 240 Minuten eintragen.")).toBeInTheDocument();
    }
    expect(log).not.toHaveBeenCalled();
  });

  it("ignores a broken stored timer", () => {
    localStorage.setItem("guitar.freeTimer", "{kaputt");
    render(<FreePractice />);
    open();
    expect(screen.getByRole("button", { name: "Timer starten" })).toBeInTheDocument();
  });

  it("elapsed display ticks each second while running", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    localStorage.setItem("guitar.freeTimer", JSON.stringify({ startedAt: Date.now(), techniqueId: "song" }));
    render(<FreePractice />);
    expect(screen.getByRole("button", { name: /0:00/ })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(65_000);
    });
    expect(screen.getByRole("button", { name: /1:05/ })).toBeInTheDocument();
  });

  it("a timer over 4 hours logs nothing and asks for manual minutes", () => {
    const log = vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    localStorage.setItem("guitar.freeTimer", JSON.stringify({ startedAt: Date.now() - 5 * 3600_000, techniqueId: "song" }));
    render(<FreePractice />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Timer stoppen und speichern" }));
    expect(screen.getByText("Der Timer lief über 4 Stunden. Trag deine Minuten bitte selbst ein.")).toBeInTheDocument();
    expect(screen.getByLabelText("Minuten")).toHaveFocus();
    expect(log).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("guitar.freeTimer") ?? "null")).toBeNull();
  });

  it("stopping after the record was removed elsewhere logs nothing", () => {
    const log = vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    localStorage.setItem("guitar.freeTimer", JSON.stringify({ startedAt: Date.now() - 600_000, techniqueId: "song" }));
    render(<FreePractice />);
    open();
    localStorage.removeItem("guitar.freeTimer");
    fireEvent.click(screen.getByRole("button", { name: "Timer stoppen und speichern" }));
    expect(log).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Timer starten" })).toBeInTheDocument();
  });

  it("follows the storage event from another tab", () => {
    render(<FreePractice />);
    open();
    expect(screen.getByRole("button", { name: "Timer starten" })).toBeInTheDocument();
    act(() => {
      localStorage.setItem("guitar.freeTimer", JSON.stringify({ startedAt: Date.now(), techniqueId: "song" }));
      window.dispatchEvent(new StorageEvent("storage", { key: "guitar.freeTimer" }));
    });
    expect(screen.getByRole("button", { name: "Timer stoppen und speichern" })).toBeInTheDocument();
  });

  it("Verwerfen clears the timer without logging", () => {
    const log = vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    render(<FreePractice />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Timer starten" }));
    fireEvent.click(screen.getByRole("button", { name: "Verwerfen" }));
    expect(screen.getByRole("button", { name: "Timer starten" })).toBeInTheDocument();
    expect(log).not.toHaveBeenCalled();
  });

  it("keeps the saved result when reopened and closes on Escape", async () => {
    vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    render(<FreePractice />);
    open();
    fireEvent.change(screen.getByLabelText("Minuten"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Eintragen" }));
    await screen.findByText("+12 XP · +3 Gold");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Frei üben" })).toBeNull();
    open();
    expect(screen.getByText("+12 XP · +3 Gold")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rückgängig" })).toBeInTheDocument();
  });

  it("subtracts time other exercises logged while the timer ran", async () => {
    const log = vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    const startedAt = Date.now() - 600_000;
    vi.spyOn(gameApi, "recentLog").mockResolvedValue({
      entries: [entry(startedAt + 60_000, 120), entry(startedAt + 300_000, 60), entry(startedAt - 1000, 900)],
    });
    localStorage.setItem("guitar.freeTimer", JSON.stringify({ startedAt, techniqueId: "song" }));
    render(<FreePractice />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Timer stoppen und speichern" }));
    await waitFor(() => expect(log).toHaveBeenCalled());
    expect(Math.abs(log.mock.calls[0]![0].seconds - 420)).toBeLessThan(5);
    expect(await screen.findByText("Davon schon gezählt: 3 min.")).toBeInTheDocument();
  });

  it("logs nothing when other exercises already counted the time", async () => {
    const log = vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    const startedAt = Date.now() - 600_000;
    vi.spyOn(gameApi, "recentLog").mockResolvedValue({ entries: [entry(startedAt + 10_000, 580)] });
    localStorage.setItem("guitar.freeTimer", JSON.stringify({ startedAt, techniqueId: "song" }));
    render(<FreePractice />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Timer stoppen und speichern" }));
    expect(await screen.findByText("Die Zeit wurde schon von anderen Übungen gezählt.")).toBeInTheDocument();
    expect(log).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("guitar.freeTimer") ?? "null")).toBeNull();
  });

  it("keeps the timer when the recent log cannot be read", async () => {
    const log = vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    vi.spyOn(gameApi, "recentLog").mockRejectedValue(new Error("offline"));
    localStorage.setItem("guitar.freeTimer", JSON.stringify({ startedAt: Date.now() - 600_000, techniqueId: "song" }));
    render(<FreePractice />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Timer stoppen und speichern" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(log).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("guitar.freeTimer") ?? "null")).not.toBeNull();
  });

  it("labels the jam option apart from the Jam Room", () => {
    render(<FreePractice />);
    open();
    expect(screen.getByRole("option", { name: "Jammen (ohne Jam Room)" })).toHaveValue("jam");
  });

  it("long free timer asks before saving", async () => {
    const log = vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    askAfter = 15;
    localStorage.setItem("guitar.freeTimer", JSON.stringify({ startedAt: Date.now() - 20 * 60_000, techniqueId: "song" }));
    render(<FreePractice />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Timer stoppen und speichern" }));
    expect(await screen.findByText("Wie lange hast du wirklich geübt?")).toBeInTheDocument();
    expect((screen.getByLabelText("Echte Minuten") as HTMLInputElement).value).toBe("20");
    expect(log).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("guitar.freeTimer") ?? "null")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Verwerfen" }));
    expect(log).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("guitar.freeTimer") ?? "null")).toBeNull();
  });

  it("confirm asks for the extra minutes when other exercises already counted", async () => {
    vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    askAfter = 15;
    const startedAt = Date.now() - 40 * 60_000;
    vi.spyOn(gameApi, "recentLog").mockResolvedValue({ entries: [entry(startedAt + 60_000, 180)] });
    localStorage.setItem("guitar.freeTimer", JSON.stringify({ startedAt, techniqueId: "song" }));
    render(<FreePractice />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Timer stoppen und speichern" }));
    expect(await screen.findByText("Wie lange hast du zusätzlich zu den Quests geübt?")).toBeInTheDocument();
    expect(screen.queryByText("Wie lange hast du wirklich geübt?")).toBeNull();
  });

  it("confirm saves the typed minutes", async () => {
    const log = vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    askAfter = 15;
    localStorage.setItem("guitar.freeTimer", JSON.stringify({ startedAt: Date.now() - 20 * 60_000, techniqueId: "song" }));
    render(<FreePractice />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Timer stoppen und speichern" }));
    await screen.findByText("Wie lange hast du wirklich geübt?");
    fireEvent.change(screen.getByLabelText("Echte Minuten"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(log).toHaveBeenCalledWith({ kind: "frei", seconds: 420, level: 1, techniqueId: "song" }));
    expect(JSON.parse(localStorage.getItem("guitar.freeTimer") ?? "null")).toBeNull();
    expect(screen.queryByText("Wie lange hast du wirklich geübt?")).toBeNull();
  });

  it("free timer subtraction uses since", async () => {
    vi.spyOn(gameApi, "log").mockResolvedValue(result as never);
    const startedAt = Date.now() - 600_000;
    const recent = vi.spyOn(gameApi, "recentLog").mockResolvedValue({ entries: [] });
    localStorage.setItem("guitar.freeTimer", JSON.stringify({ startedAt, techniqueId: "song" }));
    render(<FreePractice />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Timer stoppen und speichern" }));
    await waitFor(() => expect(recent).toHaveBeenCalledWith(startedAt));
  });
});
