import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChordDiagramSingle } from "./ChordDiagramSingle.js";

describe("ChordDiagramSingle", () => {
  it("renders a derived barre shape for F instead of the fallback message", () => {
    render(<ChordDiagramSingle name="F" />);
    expect(screen.getByRole("heading", { name: "F" })).toBeInTheDocument();
    expect(screen.queryByText(/kein Griffbild/)).not.toBeInTheDocument();
  });

  it("renders a derived barre shape for Bb instead of the fallback message", () => {
    render(<ChordDiagramSingle name="Bb" />);
    expect(screen.getByRole("heading", { name: "Bb" })).toBeInTheDocument();
    expect(screen.queryByText(/kein Griffbild/)).not.toBeInTheDocument();
  });

  it("renders a derived barre shape for Bm instead of the fallback message, with a base fret label", () => {
    render(<ChordDiagramSingle name="Bm" />);
    expect(screen.getByRole("heading", { name: "Bm" })).toBeInTheDocument();
    expect(screen.queryByText(/kein Griffbild/)).not.toBeInTheDocument();
    expect(screen.getByTestId("base-fret")).toHaveTextContent(/\d+\. Bund/);
  });

  it("names the plain note B as H in the note line", () => {
    render(<ChordDiagramSingle name="Em" />);
    expect(screen.getByText("Töne: E, G, H")).toBeInTheDocument();
  });

  it("leaves altered notes such as Bb as they are", () => {
    render(<ChordDiagramSingle name="Bb" />);
    expect(screen.getByText(/^Töne: /).textContent).toMatch(/Bb|A#/);
  });

  it("does not show a base fret label for an open chord (baseFret 1)", () => {
    render(<ChordDiagramSingle name="Em" />);
    expect(screen.queryByTestId("base-fret")).not.toBeInTheDocument();
  });

  it("marks the barre of a derived shape instead of showing unrelated dots", () => {
    render(<ChordDiagramSingle name="F" />);
    expect(screen.getByTestId("barre-1")).toBeInTheDocument();
  });

  it("prefers a user-supplied chord file entry over the open-chord table", () => {
    render(<ChordDiagramSingle name="G" />);
    // skills/guitar/chords/eigene.json overrides G's fingering on the high e string (pinky, not ring)
    expect(screen.getByTestId("dot-5-3")).toHaveTextContent("4");
  });

  it("prefers a user-supplied chord file entry over derivation for a chord with no derivable shape", () => {
    render(<ChordDiagramSingle name="Cadd9" />);
    expect(screen.queryByText(/kein Griffbild/)).not.toBeInTheDocument();
  });

  it("still shows the fallback for a chord with no shape anywhere", () => {
    render(<ChordDiagramSingle name="Xdim7" />);
    expect(screen.getByText(/kein Griffbild/)).toBeInTheDocument();
  });

  it("shows a differing display name underneath the symbol", () => {
    render(
      <ChordDiagramSingle
        name="Em"
        overrides={{ song: { Em: { name: "Em eigen", frets: [0, 2, 2, 0, 0, 0], fingers: [null, 2, 3, null, null, null], baseFret: 1 } } }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Em" })).toBeInTheDocument();
    expect(screen.getByTestId("shape-name")).toHaveTextContent("Em eigen");
  });

  it("offers an edit button only when an edit handler is given", () => {
    const { rerender } = render(<ChordDiagramSingle name="Em" />);
    expect(screen.queryByRole("button", { name: "Griff bearbeiten" })).not.toBeInTheDocument();
    rerender(<ChordDiagramSingle name="Em" onEdit={() => {}} />);
    expect(screen.getByRole("button", { name: "Griff bearbeiten" })).toBeInTheDocument();
  });

  it("keeps the fallback tile editable so a missing shape can be created", () => {
    render(<ChordDiagramSingle name="Xdim7" onEdit={() => {}} />);
    expect(screen.getByText(/kein Griffbild/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Griff bearbeiten" })).toBeInTheDocument();
  });
});
