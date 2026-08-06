import { describe, expect, it } from "vitest";
import { CORE_VERSION } from "./index.js";

describe("core package", () => {
  it("exports a version marker", () => {
    expect(CORE_VERSION).toBe("1");
  });
});
