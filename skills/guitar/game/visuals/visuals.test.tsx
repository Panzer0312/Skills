import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../../packages/web/src/app/queryClient.js";
import { Griffbild, GriffbrettBild, RhythmusRaster, Tab } from "./index.js";

afterEach(() => {
  vi.unstubAllGlobals();
  queryClient.clear();
});

describe("RhythmusRaster", () => {
  it("draws one cell per pattern character", () => {
    render(<RhythmusRaster muster="D-DU-UDU" />);
    expect(screen.getAllByTestId("rhythmus-zelle")).toHaveLength(8);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", expect.stringContaining("8 Zählzeiten"));
  });

  it("rejects an unknown pattern character visibly", () => {
    render(<RhythmusRaster muster="D-Q" />);
    expect(screen.getByText(/Ungültiges Muster/)).toBeInTheDocument();
    expect(screen.queryAllByTestId("rhythmus-zelle")).toHaveLength(0);
  });
});

describe("Tab", () => {
  it("shows six labelled strings with high e first", () => {
    render(<Tab titel="Test" zeilen={["-0-", "---", "---", "---", "---", "-3-"]} />);
    const zeilen = screen.getAllByTestId("tab-zeile").map((z) => z.textContent);
    expect(zeilen).toHaveLength(6);
    expect(zeilen[0]).toBe("e|-0-|");
    expect(zeilen[5]).toBe("E|-3-|");
  });

  it("notes lines of different length", () => {
    render(<Tab zeilen={["-0-", "--", "---", "---", "---", "---"]} />);
    expect(screen.getByText(/unterschiedlich lang/)).toBeInTheDocument();
  });

  it("rejects a tab without six lines", () => {
    render(<Tab zeilen={["-0-"]} />);
    expect(screen.getByText(/Ungültige Tabulatur/)).toBeInTheDocument();
  });
});

describe("GriffbrettBild", () => {
  it("marks fretted notes at string and fret", () => {
    render(<GriffbrettBild punkte={[{ saite: 2, bund: 3, text: "C" }, { saite: 6, bund: 0 }]} bis={5} />);
    expect(screen.getByTestId("punkt-2-3")).toHaveTextContent("C");
    expect(screen.getByTestId("punkt-6-0")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", expect.stringContaining("H-Saite Bund 3"));
  });
});

describe("GriffbrettBild notes", () => {
  it("shows a note for a string outside 1-6", () => {
    render(<GriffbrettBild punkte={[{ saite: 7, bund: 2 }]} />);
    expect(screen.getByText(/ungültiger Saite/)).toBeInTheDocument();
    expect(screen.queryByTestId("punkt-7-2")).toBeNull();
  });
});

describe("Griffbild", () => {
  it("uses a chord override", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            global: [
              {
                id: 1,
                scope: "global",
                songKey: "",
                symbol: "Em",
                name: "Em eigener Griff",
                frets: [0, 2, 2, 0, 0, 0],
                fingers: [null, 2, 3, null, null, null],
                baseFret: 1,
                updatedAt: 0,
              },
            ],
            song: [],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    render(
      <QueryClientProvider client={queryClient}>
        <Griffbild akkorde={["Em"]} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Em eigener Griff")).toBeInTheDocument();
  });
});
