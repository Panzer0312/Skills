import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Fretboard from "./Fretboard.js";

const progress = { record: vi.fn(), get: () => null, complete: vi.fn(async () => {}) };

describe("Fretboard", () => {
  it("shows note names on the standard tuning by default", () => {
    render(<Fretboard data={[]} progress={progress} settings={{}} />);
    const openE = screen.getByTestId("fret-0-0");
    expect(openE).toHaveTextContent("E");
    expect(screen.getByTestId("fret-0-5")).toHaveTextContent("A");
  });

  it("switches to interval labels relative to a chosen root", async () => {
    render(<Fretboard data={[]} progress={progress} settings={{}} />);
    await userEvent.selectOptions(screen.getByLabelText(/Anzeige/), "intervalle");
    await userEvent.selectOptions(screen.getByLabelText(/Grundton/), "E");
    expect(screen.getByTestId("fret-0-0")).toHaveTextContent("1");
    expect(screen.getByTestId("fret-0-7")).toHaveTextContent("5");
  });

  it("changes the open strings when the tuning changes", async () => {
    render(<Fretboard data={[]} progress={progress} settings={{}} />);
    await userEvent.selectOptions(screen.getByLabelText(/Stimmung/), "Drop D");
    expect(screen.getByTestId("fret-0-0")).toHaveTextContent("D");
  });

  it("highlights only the notes of the selected scale", async () => {
    render(<Fretboard data={[]} progress={progress} settings={{}} />);
    await userEvent.selectOptions(screen.getByLabelText(/Anzeige/), "tonleiter");
    await userEvent.selectOptions(screen.getByLabelText(/Grundton/), "E");
    expect(screen.getByTestId("fret-0-0")).toHaveAttribute("data-in-scale", "true");
    expect(screen.getByTestId("fret-0-1")).toHaveAttribute("data-in-scale", "false");
  });
});
