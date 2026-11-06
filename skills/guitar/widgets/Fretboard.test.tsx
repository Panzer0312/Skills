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

  it("names the root in German in the interval hint", async () => {
    render(<Fretboard data={[]} progress={progress} settings={{}} />);
    await userEvent.selectOptions(screen.getByLabelText(/Anzeige/), "intervalle");
    await userEvent.selectOptions(screen.getByLabelText(/Grundton/), "B");
    expect(screen.getByText(/vom Grundton H aus/)).toBeInTheDocument();
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

  it("marks the A minor pentatonic", async () => {
    render(<Fretboard data={[]} progress={progress} settings={{}} />);
    await userEvent.selectOptions(screen.getByLabelText(/Anzeige/), "Moll-Pentatonik");
    await userEvent.selectOptions(screen.getByLabelText(/Grundton/), "A");
    expect(screen.getByTestId("fret-0-5")).toHaveAttribute("data-root", "true");
    expect(screen.getByTestId("fret-0-8")).toHaveAttribute("data-in-scale", "true");
    expect(screen.getByTestId("fret-0-6")).toHaveAttribute("data-in-scale", "false");
  });

  it("shows only the chosen box", async () => {
    render(<Fretboard data={[]} progress={progress} settings={{}} />);
    await userEvent.selectOptions(screen.getByLabelText(/Anzeige/), "Pentatonik-Box");
    await userEvent.selectOptions(screen.getByLabelText(/Grundton/), "A");
    await userEvent.selectOptions(screen.getByLabelText(/Box/), "1");
    expect(screen.getByTestId("fret-0-5")).toHaveAttribute("data-in-scale", "true");
    expect(screen.getByTestId("fret-0-10")).toHaveAttribute("data-in-scale", "false");
  });

  it("shows a CAGED shape", async () => {
    render(<Fretboard data={[]} progress={progress} settings={{}} />);
    await userEvent.selectOptions(screen.getByLabelText(/Anzeige/), "CAGED");
    await userEvent.selectOptions(screen.getByLabelText(/Grundton/), "C");
    await userEvent.selectOptions(screen.getByLabelText(/Form/), "E");
    expect(screen.getByTestId("fret-0-8")).toHaveAttribute("data-in-scale", "true");
    expect(screen.getByTestId("fret-2-10")).toHaveAttribute("data-in-scale", "true");
    expect(screen.getByTestId("fret-2-9")).toHaveAttribute("data-in-scale", "false");
  });

  it("says boxes need the standard tuning", async () => {
    render(<Fretboard data={[]} progress={progress} settings={{}} />);
    await userEvent.selectOptions(screen.getByLabelText(/Stimmung/), "Drop D");
    await userEvent.selectOptions(screen.getByLabelText(/Anzeige/), "Pentatonik-Box");
    expect(screen.getByText("Boxen und CAGED gelten für die Standardstimmung.")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-in-scale="true"]')).toHaveLength(0);
  });

  it("names the note H in German", () => {
    render(<Fretboard data={[]} progress={progress} settings={{}} />);
    expect(screen.getByTestId("fret-4-0")).toHaveTextContent("H");
  });
});
