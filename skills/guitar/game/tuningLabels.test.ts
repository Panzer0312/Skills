import { describe, expect, it } from "vitest";
import { noteRoundLabel } from "./tuningLabels.js";

describe("noteRoundLabel", () => {
  it("names Standard keys without a tuning", () => {
    expect(noteRoundLabel("notenfinder:0")).toBe("E-Saite");
    expect(noteRoundLabel("notenfinder:0-1")).toBe("E und A");
    expect(noteRoundLabel("notenfinder:0-1-2-3-4-5")).toBe("Alle");
  });

  it("names the strings in the key's tuning", () => {
    expect(noteRoundLabel("notenfinder:Drop D:0")).toBe("Drop D, D-Saite");
    expect(noteRoundLabel("notenfinder:Open G:0-1")).toBe("Open G, D und G");
  });

  it("falls back for keys it cannot read", () => {
    expect(noteRoundLabel("notenfinder:")).toBe("Eigene Saiten");
    expect(noteRoundLabel("notenfinder:Unbekannt:0")).toBe("Unbekannt, Eigene Saiten");
  });
});
