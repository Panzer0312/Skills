import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../usePref.js", async () => ({ usePref: (await import("../testPrefs.js")).usePref }));

import { prefWrites, resetTestPrefs } from "../testPrefs.js";
import { SoundToggle } from "./SoundToggle.js";

beforeEach(() => resetTestPrefs());

describe("SoundToggle", () => {
  it("sound toggle writes klang.an", async () => {
    render(<SoundToggle />);
    const button = screen.getByRole("button", { name: "Klang aus" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    expect(prefWrites).toEqual([{ key: "klang.an", value: true }]);
    expect(screen.getByRole("button", { name: "Klang an" })).toHaveAttribute("aria-pressed", "true");
  });
  it("shows on and turns off", async () => {
    resetTestPrefs({ "klang.an": true });
    render(<SoundToggle />);
    await userEvent.click(screen.getByRole("button", { name: "Klang an" }));
    expect(prefWrites).toEqual([{ key: "klang.an", value: false }]);
  });
});
