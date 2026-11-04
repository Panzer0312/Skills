import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SPRITE_NAMES, spriteUrl } from "./assets";

const here = dirname(fileURLToPath(import.meta.url));

function pngSize(name: string) {
  const buf = readFileSync(join(here, "../assets", `${name}.png`));
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("guitar game sprites", () => {
  it("resolves a url for every sprite", () => {
    for (const name of SPRITE_NAMES) expect(spriteUrl(name), name).toBeTruthy();
  });

  it("has sprites of sane size", () => {
    for (const name of SPRITE_NAMES) expect(pngSize(name).width, name).toBeGreaterThanOrEqual(30);
    expect(pngSize("village")).toEqual({ width: 1130, height: 760 });
  });
});
