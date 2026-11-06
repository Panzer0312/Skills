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

  it("is not clickable", () => {
    render(<FretOverlay root="A" scale="moll-pentatonik" />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
