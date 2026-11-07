export const SPRITE_NAMES = [
  "sword",
  "potion",
  "key",
  "ruby",
  "shield",
  "bow",
  "scroll",
  "gold",
  "helm",
  "mana",
  "ring",
  "chest",
  "parchment",
  "firebag",
  "torch",
  "goldbag",
  "emblem",
  "oak",
  "birch",
  "pine",
  "pine2",
  "mushroom",
  "log",
  "stump",
  "village",
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

export type SpriteName = (typeof SPRITE_NAMES)[number];

const urls = import.meta.glob("../assets/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

export function spriteUrl(name: SpriteName): string {
  return urls[`../assets/${name}.png`] ?? "";
}
