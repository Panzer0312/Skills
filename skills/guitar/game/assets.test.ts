import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SPRITE_NAMES, spriteUrl } from "./assets";

const here = dirname(fileURLToPath(import.meta.url));

function pngSize(name: string) {
  const buf = readFileSync(join(here, "../assets", `${name}.png`));
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const GEAR_SPRITES = [
  "shield-wood",
  "shield-blue",
  "sword-ice",
  "dagger",
  "dagger-gold",
  "staff-red",
  "ring-gem",
  "ring-fire",
  "ring-pink",
  "chest-blue",
] as const;

// Minimal 8-bit RGBA PNG decoder: returns the alpha byte at (x, y).
function alphaAt(name: string, x: number, y: number) {
  const buf = readFileSync(join(here, "../assets", `${name}.png`));
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  expect(buf[24], `${name} bit depth`).toBe(8);
  expect(buf[25], `${name} color type RGBA`).toBe(6);
  const parts: Buffer[] = [];
  for (let pos = 8; pos < buf.length; ) {
    const len = buf.readUInt32BE(pos);
    if (buf.toString("ascii", pos + 4, pos + 8) === "IDAT") parts.push(buf.subarray(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * 4 + 1;
  const rows: Buffer[] = [];
  for (let r = 0; r < height; r++) {
    const line = Buffer.from(raw.subarray(r * stride + 1, (r + 1) * stride));
    const filter = raw[r * stride];
    const prev = rows[r - 1];
    for (let i = 0; i < line.length; i++) {
      const a = i >= 4 ? line[i - 4] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= 4 ? prev[i - 4] : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = (line[i] + add) & 255;
    }
    rows.push(line);
  }
  return rows[y][x * 4 + 3];
}

describe("guitar game sprites", () => {
  it("lists the ten gear sprites", () => {
    for (const name of GEAR_SPRITES) expect(SPRITE_NAMES).toContain(name);
  });

  it("keeps a transparent background around every gear sprite", () => {
    for (const name of GEAR_SPRITES) {
      const { width, height } = pngSize(name);
      for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]) {
        expect(alphaAt(name, x, y), `${name} corner ${x},${y}`).toBe(0);
      }
    }
  });

  it("resolves a url for every sprite", () => {
    for (const name of SPRITE_NAMES) expect(spriteUrl(name), name).toBeTruthy();
  });

  it("has sprites of sane size", () => {
    for (const name of SPRITE_NAMES) expect(pngSize(name).width, name).toBeGreaterThanOrEqual(30);
    expect(pngSize("village")).toEqual({ width: 1130, height: 760 });
  });
});
