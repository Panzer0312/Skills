import { parseSong } from "@skills/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SongView } from "./SongView.js";

vi.mock("../../audio/useMetronome.js", () => ({
  useMetronome: () => ({
    bpm: 80, setBpm: vi.fn(), beatsPerBar: 4, setBeatsPerBar: vi.fn(),
    running: false, start: vi.fn(), stop: vi.fn(), tap: vi.fn(), currentBeat: 0,
  }),
}));

const song = parseSong(`{title: Übung in Em}
{start_of_verse}
[Em]Erste Zeile mit [Am]zwei Akkorden
{end_of_verse}`);

describe("SongView", () => {
  it("shows the title, the chords and the lyrics", () => {
    render(<SongView song={song} />);
    expect(screen.getByRole("heading", { name: "Übung in Em" })).toBeInTheDocument();
    expect(screen.getByText(/Erste Zeile mit zwei Akkorden/)).toBeInTheDocument();
    expect(screen.getAllByText("Em").length).toBeGreaterThan(0);
  });

  it("transposes up and down", async () => {
    render(<SongView song={song} />);
    await userEvent.click(screen.getByRole("button", { name: /Halbton höher/ }));
    expect(screen.getAllByText("Fm").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /Halbton tiefer/ }));
    expect(screen.getAllByText("Em").length).toBeGreaterThan(0);
  });

  it("shows a chord diagram for every chord in the song", () => {
    render(<SongView song={song} />);
    expect(screen.getByRole("heading", { name: "Em" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Am" })).toBeInTheDocument();
  });

  it("toggles auto scroll", async () => {
    render(<SongView song={song} />);
    const button = screen.getByRole("button", { name: /Auto-Scroll starten/ });
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: /Auto-Scroll stoppen/ })).toBeInTheDocument();
  });
});
