import { GEAR_SLOTS, gearItem, type GameState } from "@skills/core";
import { spriteUrl, type SpriteName } from "./assets.js";
import "./market/market.css";

/** The equipped items in slot order. Ids missing from the catalogue are skipped. */
export function GearStrip({ equipped }: { equipped: GameState["equipped"] | undefined }) {
  const items = GEAR_SLOTS.flatMap(({ id }) => {
    const itemId = equipped?.[id];
    const item = itemId === undefined ? undefined : gearItem(itemId);
    return item ? [item] : [];
  });
  if (items.length === 0) return null;
  return (
    <span className="gear-strip">
      {items.map((item) => (
        <img key={item.id} src={spriteUrl(item.sprite as SpriteName)} alt={item.name} />
      ))}
    </span>
  );
}
