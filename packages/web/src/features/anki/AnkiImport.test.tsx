import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnkiImport } from "./AnkiImport.js";

vi.mock("../../skills/registry.js", () => ({
  getSkills: () => [
    {
      dir: "japanese",
      manifest: { id: "japanese", name: "Japanisch", icon: "languages", accent: "#e05263", description: "", modules: [] },
      data: {},
    },
  ],
}));

const preview = {
  deckName: "Kaishi Mini",
  noteTypes: [{ id: 1, name: "Basis", fields: ["Expression", "Meaning", "Reading"], templates: [] }],
  noteCount: 2,
  cardCount: 2,
  mediaCount: 1,
  samples: [{ front: "日本", back: "Japan" }],
  suggestedMapping: { "1": { front: 0, back: 1, reading: 2, note: null } },
};

function renderImport() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AnkiImport />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function file(): File {
  return new File([new Uint8Array([1, 2, 3])], "deck.apkg");
}

afterEach(() => vi.unstubAllGlobals());

describe("AnkiImport", () => {
  it("shows the preview after selecting a file", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(preview), { status: 200 })));
    renderImport();

    await userEvent.upload(screen.getByLabelText(/Datei/i), file());

    expect(await screen.findByText("Kaishi Mini")).toBeInTheDocument();
    expect(screen.getByText(/2 Notizen/)).toBeInTheDocument();
    expect(screen.getByText("日本")).toBeInTheDocument();
  });

  it("lets the user correct the guessed field mapping", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(preview), { status: 200 })));
    renderImport();
    await userEvent.upload(screen.getByLabelText(/Datei/i), file());
    await screen.findByText("Kaishi Mini");

    const frontSelect = screen.getByLabelText(/Vorderseite/);
    expect((frontSelect as HTMLSelectElement).value).toBe("0");
    await userEvent.selectOptions(frontSelect, "2");
    expect((frontSelect as HTMLSelectElement).value).toBe("2");
  });

  it("posts the import with the chosen options", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/preview")
        ? new Response(JSON.stringify(preview), { status: 200 })
        : new Response(JSON.stringify({ notes: 2, cards: 2, media: 1 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderImport();
    await userEvent.upload(screen.getByLabelText(/Datei/i), file());
    await screen.findByText("Kaishi Mini");

    await userEvent.click(screen.getByRole("button", { name: /Importieren/ }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).includes("/api/anki/import"));
      expect(call).toBeDefined();
    });
    expect(await screen.findByText(/2 Karten importiert/)).toBeInTheDocument();
  });

  it("shows the server message when the archive is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: "apkg_invalid", message: "Kein gültiges Zip-Archiv." } }), {
            status: 400,
          }),
      ),
    );
    renderImport();
    await userEvent.upload(screen.getByLabelText(/Datei/i), file());
    expect(await screen.findByText(/Kein gültiges Zip-Archiv/)).toBeInTheDocument();
  });
});
