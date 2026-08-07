import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChordDiagramSingle } from "../../../packages/web/src/music/ChordDiagramSingle.js";
import ChordDiagram from "./ChordDiagram.js";

const progress = { record: vi.fn(), get: () => null, complete: vi.fn(async () => {}) };

const UEBUNGSSTUECKE = [
  { id: "em-am-wiege", titel: "Zwei Akkorde, eine Wiege", stufe: 1, benoetigteAkkorde: ["Em", "Am"], bpm: 70, quelle: "" },
];

function renderWidget(data: unknown[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ChordDiagram data={data} progress={progress} settings={{}} />
    </QueryClientProvider>,
  );
}

function stubFetch(chordsBody: unknown, songsBody: unknown = { songs: [] }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/api/chords") ? chordsBody : songsBody;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

describe("ChordDiagramSingle", () => {
  it("marks muted, open and fretted strings", () => {
    render(<ChordDiagramSingle name="C" />);
    expect(screen.getByTestId("string-0")).toHaveTextContent("x");
    expect(screen.getByTestId("string-3")).toHaveTextContent("0");
    expect(screen.getByTestId("dot-1-3")).toHaveTextContent("3");
  });

  it("lists the notes of the chord", () => {
    render(<ChordDiagramSingle name="Am" />);
    expect(screen.getByText(/A, C, E/)).toBeInTheDocument();
  });

  it("says so when a shape is unknown", () => {
    render(<ChordDiagramSingle name="Xyz" />);
    expect(screen.getByText(/kein Griffbild/i)).toBeInTheDocument();
  });
});

describe("ChordDiagram widget", () => {
  it("renders every open chord shape", () => {
    renderWidget();
    for (const name of ["Em", "Am", "E", "A", "D", "G", "C", "Dm"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  it("lists the stored overrides on the second tab", async () => {
    stubFetch({
      entries: [
        {
          id: 1, scope: "global", songKey: "", symbol: "Cadd9", name: "Cadd9 eigen",
          frets: [null, 3, 2, 0, 3, 0], fingers: [null, 3, 2, null, 4, null],
          baseFret: 1, updatedAt: 0,
        },
      ],
    });

    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Eigene Griffe" }));
    expect(await screen.findByText("Cadd9 eigen")).toBeInTheDocument();
    expect(screen.getByText("Alle Songs")).toBeInTheDocument();
  });

  it("shows the shipped practice song's title for a uebung-scoped entry", async () => {
    stubFetch({
      entries: [
        {
          id: 2, scope: "song", songKey: "uebung:em-am-wiege", symbol: "Em", name: "Em eigen",
          frets: [0, 2, 2, 0, 0, 0], fingers: [null, 2, 3, null, null, null],
          baseFret: 1, updatedAt: 0,
        },
      ],
    });

    renderWidget([UEBUNGSSTUECKE]);
    await userEvent.click(screen.getByRole("button", { name: "Eigene Griffe" }));
    expect(await screen.findByText("Em eigen")).toBeInTheDocument();
    expect(screen.getByText('Nur „Zwei Akkorde, eine Wiege"')).toBeInTheDocument();
    expect(screen.queryByText(/uebung:em-am-wiege/)).not.toBeInTheDocument();
  });

  it("shows a German error message when deleting fails and keeps the entry visible", async () => {
    const entries = [
      {
        id: 1, scope: "global", songKey: "", symbol: "Cadd9", name: "Cadd9 eigen",
        frets: [null, 3, 2, 0, 3, 0], fingers: [null, 3, 2, null, 4, null],
        baseFret: 1, updatedAt: 0,
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/chords") && init?.method === "DELETE") {
          return new Response(
            JSON.stringify({ error: { code: "not_found", message: "Der Eintrag wurde nicht gefunden." } }),
            { status: 404, headers: { "content-type": "application/json" } },
          );
        }
        const body = url.includes("/api/chords") ? { entries } : { songs: [] };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Eigene Griffe" }));
    await userEvent.click(await screen.findByRole("button", { name: "Löschen" }));

    expect(await screen.findByText("Der Eintrag wurde nicht gefunden.")).toBeInTheDocument();
    expect(screen.getByText("Cadd9 eigen")).toBeInTheDocument();
  });
});
