import { describe, expect, it } from "vitest";
import { inputLevel } from "./level.js";

const sine = (amplitude: number) => Float32Array.from({ length: 2048 }, (_, i) => amplitude * Math.sin(i * 0.1));

describe("inputLevel", () => {
  it("gives 0 for silence and an empty buffer", () => {
    expect(inputLevel(new Float32Array(1024))).toBe(0);
    expect(inputLevel(new Float32Array(0))).toBe(0);
  });
  it("gives more than 0.9 for a full-scale sine", () => {
    expect(inputLevel(sine(1))).toBeGreaterThan(0.9);
  });
  it("gives less than 0.1 for a tiny signal", () => {
    expect(inputLevel(new Float32Array(1024).fill(0.001))).toBeLessThan(0.1);
  });
  it("never leaves 0 to 1", () => {
    expect(inputLevel(new Float32Array(16).fill(5))).toBe(1);
  });
});
