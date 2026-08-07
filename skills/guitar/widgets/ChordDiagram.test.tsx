import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChordDiagramSingle } from "../../../packages/web/src/music/ChordDiagramSingle.js";
import ChordDiagram from "./ChordDiagram.js";

const progress = { record: vi.fn(), get: () => null, complete: vi.fn(async () => {}) };

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
    render(<ChordDiagram data={[]} progress={progress} settings={{}} />);
    for (const name of ["Em", "Am", "E", "A", "D", "G", "C", "Dm"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });
});
