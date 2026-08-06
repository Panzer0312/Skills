import { describe, expect, it } from "vitest";
import { formatDue } from "./formatDue.js";

const NOW = Date.UTC(2026, 0, 1);
const MIN = 60_000;

describe("formatDue", () => {
  it("says jetzt for anything due within a minute", () => {
    expect(formatDue(NOW + 30_000, NOW)).toBe("jetzt");
    expect(formatDue(NOW - 5000, NOW)).toBe("jetzt");
  });

  it("formats minutes, hours, days and months", () => {
    expect(formatDue(NOW + 12 * MIN, NOW)).toBe("in 12 Min.");
    expect(formatDue(NOW + 3 * 60 * MIN, NOW)).toBe("in 3 Std.");
    expect(formatDue(NOW + 4 * 1440 * MIN, NOW)).toBe("in 4 Tagen");
    expect(formatDue(NOW + 1 * 1440 * MIN, NOW)).toBe("in 1 Tag");
    expect(formatDue(NOW + 60 * 1440 * MIN, NOW)).toBe("in 2 Monaten");
  });
});
