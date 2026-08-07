import { parseSong } from "@skills/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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

function renderSong(props: { songKey?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SongView song={song} {...props} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("SongView", () => {
  it("shows the title, the chords and the lyrics", () => {
    renderSong();
    expect(screen.getByRole("heading", { name: "Übung in Em" })).toBeInTheDocument();
    expect(screen.getByText(/Erste Zeile mit zwei Akkorden/)).toBeInTheDocument();
    expect(screen.getAllByText("Em").length).toBeGreaterThan(0);
  });

  it("transposes up and down", async () => {
    renderSong();
    await userEvent.click(screen.getByRole("button", { name: /Halbton höher/ }));
    expect(screen.getAllByText("Fm").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /Halbton tiefer/ }));
    expect(screen.getAllByText("Em").length).toBeGreaterThan(0);
  });

  it("shows a chord diagram for every chord in the song", () => {
    renderSong();
    expect(screen.getByRole("heading", { name: "Em" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Am" })).toBeInTheDocument();
  });

  it("toggles auto scroll", async () => {
    renderSong();
    const button = screen.getByRole("button", { name: /Auto-Scroll starten/ });
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: /Auto-Scroll stoppen/ })).toBeInTheDocument();
  });

  it("shows an override instead of the shipped shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            global: [],
            song: [
              {
                id: 1, scope: "song", songKey: "song:1", symbol: "Em",
                name: "Em (eigene Version)", frets: [0, 2, 2, 0, 0, 0],
                fingers: [null, 2, 3, null, null, null], baseFret: 1, updatedAt: 0,
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    renderSong({ songKey: "song:1" });
    // The heading stays the symbol; the stored display name shows up underneath it.
    expect(await screen.findByText("Em (eigene Version)")).toBeInTheDocument();
  });

  it("opens the editor for a chord", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ global: [], song: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    renderSong({ songKey: "song:1" });
    const buttons = await screen.findAllByRole("button", { name: "Griff bearbeiten" });
    await userEvent.click(buttons[0]!);
    expect(screen.getByRole("heading", { name: /Griffbild für/ })).toBeInTheDocument();
  });
});
