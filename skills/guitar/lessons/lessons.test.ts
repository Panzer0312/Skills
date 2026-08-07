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
  it("ships thirteen lessons", () => {
    expect(files).toHaveLength(13);
  });

  it("orders them continuously and chains the prerequisites", () => {
    const metas = files.map(meta);
    expect(metas.map((m) => m.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(metas[0]!.requires).toBeNull();
    for (let i = 1; i < metas.length; i += 1) {
      expect(metas[i]!.requires).toBe(metas[i - 1]!.id);
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
    expect(withoutTempo).toEqual(["01-haltung.mdx", "03-saiten-buende.mdx", "13-theorie.mdx"]);
  });
});
