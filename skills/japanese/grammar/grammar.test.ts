import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((name) => name.endsWith(".mdx")).sort();

describe("grammar lessons", () => {
  it("ships twelve lessons", () => {
    expect(files).toHaveLength(12);
  });

  it("numbers the lessons continuously and chains the prerequisites", () => {
    const metas = files.map((file) => {
      const source = readFileSync(join(here, file), "utf8");
      const match = /export const meta = (\{[\s\S]*?\});/.exec(source);
      expect(match, `${file} ohne meta-Export`).toBeTruthy();
      // eslint-disable-next-line no-new-func
      return new Function(`return ${match![1]}`)() as {
        id: string;
        title: string;
        order: number;
        requires: string | null;
      };
    });

    expect(metas.map((m) => m.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(metas[0]!.requires).toBeNull();
    for (let i = 1; i < metas.length; i += 1) {
      expect(metas[i]!.requires).toBe(metas[i - 1]!.id);
    }
  });

  for (const file of files) {
    it(`${file} carries goal, mnemonic, error case, exercise and checkpoint`, () => {
      const source = readFileSync(join(here, file), "utf8");
      for (const block of ["<Ziel>", "<Merksatz>", "<Fehlerbild>", "<Uebung", "<Checkpoint>"]) {
        expect(source, `${file} ohne ${block}`).toContain(block);
      }
    });
  }
});
