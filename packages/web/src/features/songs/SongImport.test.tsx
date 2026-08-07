import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SongImport } from "./SongImport.js";

vi.mock("../../audio/useMetronome.js", () => ({
  useMetronome: () => ({
    bpm: 80, setBpm: vi.fn(), beatsPerBar: 4, setBeatsPerBar: vi.fn(),
    running: false, start: vi.fn(), stop: vi.fn(), tap: vi.fn(), currentBeat: 0,
  }),
}));

const chordPro = "{title: Übung in Em}\n{start_of_verse}\n[Em]Zeile eins\n{end_of_verse}";

function renderImport() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SongImport />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("SongImport", () => {
  it("previews pasted text and names the detected format", async () => {
    renderImport();
    await userEvent.click(screen.getByLabelText(/Text einfügen/));
    await userEvent.click(screen.getByLabelText(/Songtext/));
    await userEvent.paste(chordPro);
    expect(await screen.findByText(/ChordPro/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Übung in Em" })).toBeInTheDocument();
  });

  it("fills the text field from a fetched url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).startsWith("/api/chords")) {
          return new Response(JSON.stringify({ global: [], song: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ text: chordPro, title: "Von der Seite" }), { status: 200 });
      }),
    );
    renderImport();
    await userEvent.click(screen.getByLabelText(/URL abrufen/));
    await userEvent.type(screen.getByLabelText(/Adresse/), "https://example.com/tab");
    await userEvent.click(screen.getByRole("button", { name: /Abrufen/ }));

    await waitFor(() => {
      expect((screen.getByLabelText(/Songtext/) as HTMLTextAreaElement).value).toContain("Zeile eins");
    });
  });

  it("suggests pasting when the fetch is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: "unreachable", message: "Die Seite konnte nicht geladen werden. Kopiere den Text und füge ihn stattdessen ein." },
            }),
            { status: 400 },
          ),
      ),
    );
    renderImport();
    await userEvent.click(screen.getByLabelText(/URL abrufen/));
    await userEvent.type(screen.getByLabelText(/Adresse/), "https://example.com/tab");
    await userEvent.click(screen.getByRole("button", { name: /Abrufen/ }));

    expect(await screen.findByText(/stattdessen ein/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Songtext/)).toBeInTheDocument();
  });

  it("saves the song with the edited title", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).startsWith("/api/chords")) {
        return new Response(JSON.stringify({ global: [], song: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ song: { id: 1 } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderImport();
    await userEvent.click(screen.getByLabelText(/Text einfügen/));
    await userEvent.click(screen.getByLabelText(/Songtext/));
    await userEvent.paste(chordPro);
    const titleField = await screen.findByLabelText(/Titel/);
    await userEvent.clear(titleField);
    await userEvent.type(titleField, "Mein Titel");
    await userEvent.click(screen.getByRole("button", { name: /Speichern/ }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url) === "/api/songs");
      expect(call).toBeDefined();
      expect(JSON.parse(String(call![1]!.body))).toMatchObject({ title: "Mein Titel" });
    });
  });

  it("keeps the save button disabled while there is no text", async () => {
    renderImport();
    await userEvent.click(screen.getByLabelText(/Text einfügen/));
    expect(screen.queryByRole("button", { name: /Speichern/ })).not.toBeInTheDocument();
  });
});
