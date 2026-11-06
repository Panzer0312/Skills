import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FretOverlay } from "./FretOverlay.js";

describe("FretOverlay", () => {
  it("marks the scale and its root", () => {
    render(<FretOverlay root="A" scale="moll-pentatonik" />);
    expect(screen.getByTestId("fret-0-5")).toHaveAttribute("data-root", "true");
    expect(screen.getByTestId("fret-0-8")).toHaveAttribute("data-in-scale", "true");
    expect(screen.getByTestId("fret-0-6")).toHaveAttribute("data-in-scale", "false");
  });

  it("limits the marks to one box", () => {
    render(<FretOverlay root="A" scale="moll-pentatonik" box={1} />);
    expect(screen.getByTestId("fret-0-5")).toHaveAttribute("data-in-scale", "true");
    expect(screen.getByTestId("fret-0-10")).toHaveAttribute("data-in-scale", "false");
  });

  it("marks one CAGED shape, also high up the neck", () => {
    render(<FretOverlay root="C#" scale="dur" caged="D" />);
    expect(screen.getByTestId("fret-2-11")).toHaveAttribute("data-root", "true");
    expect(screen.getByTestId("fret-3-13")).toHaveAttribute("data-in-scale", "true");
    expect(screen.getByTestId("fret-4-14")).toHaveAttribute("data-in-scale", "true");
    expect(screen.getByTestId("fret-5-13")).toHaveAttribute("data-in-scale", "true");
    expect(screen.getByTestId("fret-3-12")).toHaveAttribute("data-in-scale", "false");
    expect(screen.getByTestId("fret-0-2")).toHaveAttribute("data-in-scale", "false");
  });

  it("is not clickable", () => {
    render(<FretOverlay root="A" scale="moll-pentatonik" />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
