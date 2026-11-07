import { describe, expect, it, vi } from "vitest";

vi.mock("../placeRegistry.js", () => ({
  ambiencePaths: () => ({ paths: new Set(["", "quests"]), withSubpath: new Set<string>() }),
}));

import { ambienceAllowed } from "./ambience.js";

const BASE = "/vollbild/guitar/spiel";

describe("ambience paths come from places", () => {
  it("follows the place registry, not a private list", () => {
    expect(ambienceAllowed(BASE)).toBe(true);
    expect(ambienceAllowed(`${BASE}/quests`)).toBe(true);
    expect(ambienceAllowed(`${BASE}/markt`)).toBe(false);
    expect(ambienceAllowed(`${BASE}/quests/x`)).toBe(false);
  });
});
