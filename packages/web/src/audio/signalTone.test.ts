import { afterEach, describe, expect, it, vi } from "vitest";
import { playSignal } from "./signalTone.js";

afterEach(() => vi.unstubAllGlobals());

describe("playSignal", () => {
  it("closes the context when the oscillator setup throws", () => {
    const close = vi.fn(async () => undefined);
    vi.stubGlobal(
      "AudioContext",
      class {
        close = close;
        createOscillator() {
          throw new Error("no oscillator");
        }
      },
    );
    expect(() => playSignal("start")).not.toThrow();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
