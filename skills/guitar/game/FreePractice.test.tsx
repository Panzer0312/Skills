import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gameApi } from "./api.js";
import { FreePractice } from "./FreePractice.js";

vi.mock("./UndoButton.js", () => ({ UndoButton: () => <button type="button">Rückgängig</button> }));

const result = { xpGained: 12, goldGained: 3, logId: 9 };

function open() {
  fireEvent.click(screen.getByRole("button", { name: /Frei üben/ }));
}

beforeEach(() => {
  localStorage.clear();
});
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
});
