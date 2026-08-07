import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "nice-to-know.mdx"), "utf8");

describe("nice to know", () => {
  it("exports lesson meta so the course renderer picks it up", () => {
    expect(source).toMatch(/export const meta = \{/);
  });

  it("covers every promised topic", () => {
    for (const topic of [
      "Saitenstärke",
      "Saitenwechsel",
      "Halskrümmung",
      "Saitenlage",
      "Intonation",
      "Tonabnehmer",
      "Gain",
      "Effektreihenfolge",
      "Kabel",
      "Griffbrettpflege",
      "Gehörschutz",
      "Plateau",
    ]) {
      expect(source, `Thema fehlt: ${topic}`).toContain(topic);
    }
  });

  it("keeps at least one mnemonic per section group", () => {
    const count = (source.match(/<Merksatz>/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(4);
  });
});
