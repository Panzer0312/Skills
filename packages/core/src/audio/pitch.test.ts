import { describe, expect, it } from "vitest";
import { detectPitch, readTuning } from "./pitch.js";
import { TUNINGS } from "../music/notes.js";

const SAMPLE_RATE = 44_100;

function sine(frequency: number, seconds = 0.1, amplitude = 0.8): Float32Array {
  const length = Math.floor(SAMPLE_RATE * seconds);
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    buffer[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE);
  }
  return buffer;
}

/** A plucked string is not a sine; add harmonics so the test is honest. */
function pluck(fundamental: number, seconds = 0.1): Float32Array {
  const length = Math.floor(SAMPLE_RATE * seconds);
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    buffer[i] =
      0.6 * Math.sin(2 * Math.PI * fundamental * t) +
      0.3 * Math.sin(2 * Math.PI * fundamental * 2 * t) +
      0.15 * Math.sin(2 * Math.PI * fundamental * 3 * t);
  }
  return buffer;
}

function noise(seconds = 0.1, amplitude = 0.002): Float32Array {
  const length = Math.floor(SAMPLE_RATE * seconds);
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i += 1) buffer[i] = (Math.random() * 2 - 1) * amplitude;
  return buffer;
}

describe("detectPitch", () => {
  it("finds the frequency of a pure tone", () => {
    expect(detectPitch(sine(440), SAMPLE_RATE)!).toBeCloseTo(440, 0);
    expect(detectPitch(sine(82.41), SAMPLE_RATE)!).toBeCloseTo(82.41, 0);
  });

  it("finds the fundamental of a harmonic-rich tone, not an overtone", () => {
    const detected = detectPitch(pluck(110), SAMPLE_RATE)!;
    expect(detected).toBeCloseTo(110, 0);
  });

  it("returns null for near silence", () => {
    expect(detectPitch(noise(), SAMPLE_RATE)).toBeNull();
  });

  it("returns null outside the configured frequency window", () => {
    expect(detectPitch(sine(30), SAMPLE_RATE)).toBeNull();
    expect(detectPitch(sine(3000), SAMPLE_RATE)).toBeNull();
  });
});

describe("readTuning", () => {
  const standard = TUNINGS.find((t) => t.name === "Standard")!;

  it("identifies the string that is being played", () => {
    const reading = readTuning(pluck(82.41), SAMPLE_RATE, standard)!;
    expect(reading.note).toBe("E2");
    expect(reading.targetString).toBe(0);
    expect(Math.abs(reading.cents)).toBeLessThan(10);
  });

  it("reports how far off a slightly flat string is", () => {
    const reading = readTuning(pluck(80), SAMPLE_RATE, standard)!;
    expect(reading.targetString).toBe(0);
    expect(reading.cents).toBeLessThan(-20);
  });

  it("returns null when nothing is playing", () => {
    expect(readTuning(noise(), SAMPLE_RATE, standard)).toBeNull();
  });
});
