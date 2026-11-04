import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { StatusBar } from "./StatusBar.js";

describe("StatusBar", () => {
  it("links back to the app", () => {
    render(
      <MemoryRouter>
        <StatusBar state={undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Zur App" })).toHaveAttribute("href", "/");
  });
});
