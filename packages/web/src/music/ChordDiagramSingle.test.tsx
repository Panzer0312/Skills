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
});
