import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((name) => name.endsWith(".mdx")).sort();

function meta(file: string) {
  const source = readFileSync(join(here, file), "utf8");
  const match = /export const meta = (\{[\s\S]*?\});/.exec(source);
  if (!match) throw new Error(`${file} ohne meta-Export`);
  // eslint-disable-next-line no-new-func
  return new Function(`return ${match[1]}`)() as {
    id: string;
    title: string;
    order: number;
    requires: string | null;
  };
}

describe("guitar lessons", () => {
  it("gives every lesson a unique order", () => {
    const orders = files.map((file) => meta(file).order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("lets every requires point to nothing or to an existing lesson", () => {
    const ids = new Set(files.map((file) => meta(file).id));
    for (const file of files) {
      const { requires } = meta(file);
      expect(requires === null || ids.has(requires), `${file} verweist auf ${requires}`).toBe(true);
    }
  });

  it("gives every lesson at least one visual", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(join(here, file), "utf8");
      expect(source, `${file} ohne Visual-Import`).toMatch(/import \{[^}]+\} from "\.\.\/game\/visuals\/index"/);
      expect(source, `${file} zeigt kein Visual`).toMatch(/<(Griffbild|GriffbrettBild|RhythmusRaster|Tab)\b/);
    }
  });

  it("names no lesson count in the course subtitle", () => {
    const skill = JSON.parse(readFileSync(join(here, "../skill.json"), "utf8")) as {
      modules: { id: string; subtitle?: string }[];
    };
    expect(skill.modules.find((module) => module.id === "kurs")?.subtitle).not.toMatch(/\d/);
  });

  it("keeps every Tab line within 40 characters", () => {
    for (const file of files) {
      const source = readFileSync(join(here, file), "utf8");
      for (const tab of source.match(/<Tab[\s\S]*?\/>/g) ?? []) {
        const zeilen = /zeilen=\{\[([\s\S]*?)\]\}/.exec(tab)?.[1] ?? "";
        for (const line of zeilen.match(/"[^"]*"/g) ?? []) {
          expect(line.length - 2, `${file}: ${line}`).toBeLessThanOrEqual(40);
        }
      }
    }
  });

  for (const file of files) {
    it(`${file} carries goal, hand instruction, error case, exercise and checkpoint`, () => {
      const source = readFileSync(join(here, file), "utf8");
      for (const block of ["<Ziel>", "<Handhaltung>", "<Fehlerbild>", "<Uebung", "<Checkpoint>"]) {
        expect(source, `${file} ohne ${block}`).toContain(block);
      }
    });
  }

  it("gives every practice lesson a target tempo", () => {
    const withoutTempo = files.filter((file) => {
      const source = readFileSync(join(here, file), "utf8");
      return !/<Uebung\s+bpm=\{\d+\}/.test(source);
    });
    // metal-sound is a listening lesson without a target tempo, once it exists.
    const expected = ["01-haltung.mdx", "03-saiten-buende.mdx", "13-theorie.mdx"];
    if (files.includes("metal-sound.mdx")) expected.push("metal-sound.mdx");
    expect(withoutTempo).toEqual(expected.sort());
  });
});
