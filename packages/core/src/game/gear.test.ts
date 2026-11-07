import { describe, expect, it } from "vitest";
import { BUY_REFUSAL_TEXT, buyCheck, GEAR, GEAR_SLOTS, gearItem, ownedItems } from "./gear.js";

describe("gear catalogue", () => {
  it("has unique ids and exactly one of price and milestone", () => {
    expect(new Set(GEAR.map((g) => g.id)).size).toBe(GEAR.length);
    for (const g of GEAR) {
      expect((g.price === null) !== (g.milestone === null)).toBe(true);
      if (g.price !== null) {
        expect(Number.isInteger(g.price)).toBe(true);
        expect(g.price).toBeGreaterThan(0);
      }
      expect(GEAR_SLOTS.map((s) => s.id)).toContain(g.slot);
      expect(g.description.length).toBeGreaterThan(0);
    }
  });
  it("looks items up", () => {
    expect(gearItem("rubin")?.price).toBe(250);
    expect(gearItem("nope")).toBeUndefined();
  });
});

describe("ownedItems", () => {
  it("is empty for a new player", () => expect(ownedItems([], {})).toEqual([]));
  it("grants milestone items for finished lessons", () => {
    expect(ownedItems([], { "10-barre": "gelernt" })).toEqual(["barre-urkunde"]);
    expect(ownedItems([], { "10-barre": "gemeistert" })).toEqual(["barre-urkunde"]);
  });
  it("grants nothing for an active lesson", () => {
    expect(ownedItems([], { "10-barre": "aktiv" })).toEqual([]);
  });
  it("drops unknown purchased ids and keeps catalogue order", () => {
    expect(ownedItems(["rubin", "xx", "wanderdolch"], { "10-barre": "gelernt" })).toEqual([
      "wanderdolch",
      "rubin",
      "barre-urkunde",
    ]);
  });
});

describe("buyCheck", () => {
  it("refuses with each reason", () => {
    expect(buyCheck("xx", 999, [])).toBe("unbekannt");
    expect(buyCheck("barre-urkunde", 999, [])).toBe("nicht-kaeuflich");
    expect(buyCheck("wanderdolch", 999, ["wanderdolch"])).toBe("schon-besessen");
    expect(buyCheck("wanderdolch", 29, [])).toBe("zu-wenig-gold");
  });
  it("accepts an affordable item", () => expect(buyCheck("wanderdolch", 30, [])).toBeNull());
  it("has German texts", () => expect(BUY_REFUSAL_TEXT["zu-wenig-gold"]).toBe("Nicht genug Gold"));
});
