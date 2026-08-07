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

describe("japanese lessons", () => {
  it("ships at least the writing block", () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
  });

  it("orders them continuously and chains the prerequisites", () => {
    const metas = files.map(meta);
    expect(metas.map((m) => m.order)).toEqual(metas.map((_, i) => i + 1));
    expect(metas[0]!.requires).toBeNull();
    for (let i = 1; i < metas.length; i += 1) {
      expect(metas[i]!.requires).toBe(metas[i - 1]!.id);
    }
  });

  it("names every lesson after its file", () => {
    for (const file of files) {
      expect(meta(file).id).toBe(file.replace(/\.mdx$/, ""));
    }
  });

  for (const file of files) {
    it(`${file} carries goal, error case, exercise and checkpoint`, () => {
      const source = readFileSync(join(here, file), "utf8");
      for (const block of ["<Ziel>", "<Fehlerbild>", "<Uebung>", "<Checkpoint>"]) {
        expect(source, `${file} ohne ${block}`).toContain(block);
      }
    });
  }

  it("keeps the guitar-only block out of the japanese course", () => {
    for (const file of files) {
      expect(readFileSync(join(here, file), "utf8")).not.toContain("<Handhaltung>");
    }
  });
});
