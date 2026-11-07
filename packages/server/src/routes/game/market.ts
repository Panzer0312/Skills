import { Hono } from "hono";
import { buyCheck, BUY_REFUSAL_TEXT, GEAR_SLOTS, gearItem } from "@skills/core";
import type { AppEnv } from "../../app.js";
import { buyBodySchema, equipBodySchema, invalid, wallet } from "./shared.js";

export const router = new Hono<AppEnv>();

router.post("/api/game/:skillId/market/buy", async (c) => {
  const parsed = buyBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalid(c, parsed.error);
  const raw = c.get("database").raw;
  const skillId = c.req.param("skillId");
  const { itemId } = parsed.data;
  // One transaction: gold and ownership are read and the purchase written together.
  const result = raw.transaction(() => {
    const { gold, owned } = wallet(raw, skillId);
    const refusal = buyCheck(itemId, gold, owned);
    if (refusal) return { refusal, gold: null };
    const price = gearItem(itemId)!.price!;
    raw
      .prepare("INSERT INTO game_inventory (skill_id, item_id, price, acquired_at) VALUES (?, ?, ?, ?)")
      .run(skillId, itemId, price, Date.now());
    return { refusal: null, gold: gold - price };
  }).immediate();
  if (result.refusal !== null) {
    return c.json({ error: BUY_REFUSAL_TEXT[result.refusal], reason: result.refusal }, 409);
  }
  return c.json({ gold: result.gold });
});

router.put("/api/game/:skillId/equip", async (c) => {
  const parsed = equipBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalid(c, parsed.error);
  const raw = c.get("database").raw;
  const skillId = c.req.param("skillId");
  const { slot, itemId } = parsed.data;
  if (itemId === null) {
    raw.prepare("DELETE FROM game_equipped WHERE skill_id = ? AND slot = ?").run(skillId, slot);
    return c.json({ ok: true });
  }
  const item = gearItem(itemId);
  const slotName = GEAR_SLOTS.find((s) => s.id === slot)?.name ?? slot;
  if (!item || item.slot !== slot) {
    return c.json(
      { error: { code: "invalid_body", message: `Dieser Gegenstand passt nicht in den Platz ${slotName}.` } },
      400,
    );
  }
  if (!wallet(raw, skillId).owned.includes(itemId)) {
    return c.json({ error: { code: "invalid_body", message: "Diesen Gegenstand besitzt du noch nicht." } }, 400);
  }
  raw
    .prepare(
      `INSERT INTO game_equipped (skill_id, slot, item_id) VALUES (?, ?, ?)
       ON CONFLICT(skill_id, slot) DO UPDATE SET item_id = excluded.item_id`,
    )
    .run(skillId, slot, itemId);
  return c.json({ ok: true });
});
