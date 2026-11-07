import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let sound: boolean | undefined;
let pending = false;
const mutate = vi.fn();
vi.mock("../api.js", () => ({
  GAME_BASE: "/vollbild/guitar/spiel",
  useGameState: () => ({ data: sound === undefined ? undefined : { sound } }),
  useSoundSetting: () => ({ mutate, isPending: pending }),
}));

import { SoundToggle } from "./SoundToggle.js";

beforeEach(() => {
  mutate.mockReset();
  sound = false;
  pending = false;
});

describe("SoundToggle", () => {
  it("is off by default and turns on", async () => {
    render(<SoundToggle />);
    const button = screen.getByRole("button", { name: "Klang aus" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    expect(mutate).toHaveBeenCalledWith(true);
  });
  it("shows on and turns off", async () => {
    sound = true;
    render(<SoundToggle />);
    const button = screen.getByRole("button", { name: "Klang an" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(button);
    expect(mutate).toHaveBeenCalledWith(false);
  });
  it("is disabled while pending", () => {
    pending = true;
    render(<SoundToggle />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
