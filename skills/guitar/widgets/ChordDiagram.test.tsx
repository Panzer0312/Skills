import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChordDiagramSingle } from "../../../packages/web/src/music/ChordDiagramSingle.js";
import ChordDiagram from "./ChordDiagram.js";

const progress = { record: vi.fn(), get: () => null, complete: vi.fn(async () => {}) };

function renderWidget() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ChordDiagram data={[]} progress={progress} settings={{}} />
    </QueryClientProvider>,
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            entries: [
              {
                id: 1, scope: "global", songKey: "", symbol: "Cadd9", name: "Cadd9 eigen",
                frets: [null, 3, 2, 0, 3, 0], fingers: [null, 3, 2, null, 4, null],
                baseFret: 1, updatedAt: 0,
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Eigene Griffe" }));
    expect(await screen.findByText("Cadd9 eigen")).toBeInTheDocument();
    expect(screen.getByText("Alle Songs")).toBeInTheDocument();
  });
});
