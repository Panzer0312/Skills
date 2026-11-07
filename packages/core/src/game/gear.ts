import type { LessonStatus } from "./quests.js";

export type GearSlot = "kopf" | "waffe" | "schild" | "ring" | "talisman";

export const GEAR_SLOTS: { id: GearSlot; name: string }[] = [
  { id: "kopf", name: "Kopf" },
  { id: "waffe", name: "Waffe" },
  { id: "schild", name: "Schild" },
  { id: "ring", name: "Ring" },
  { id: "talisman", name: "Talisman" },
];

export interface GearItem {
  id: string;
  name: string;
  slot: GearSlot;
  sprite: string;
  description: string;
  price: number | null;
  milestone: string | null;
}

function sold(id: string, name: string, slot: GearSlot, sprite: string, price: number, description: string): GearItem {
  return { id, name, slot, sprite, description, price, milestone: null };
}
function reward(id: string, name: string, slot: GearSlot, sprite: string, milestone: string, description: string): GearItem {
  return { id, name, slot, sprite, description, price: null, milestone };
}

export const GEAR: GearItem[] = [
  sold("eisenhelm", "Eisenhelm", "kopf", "helm", 120, "Ein schwerer Helm für lange Übungsabende."),
  sold("wanderdolch", "Wanderdolch", "waffe", "dagger", 30, "Ein schlichter Dolch für die ersten Schritte."),
  sold("kurzschwert", "Kurzschwert", "waffe", "sword", 80, "Gut ausbalanciert und schnell zur Hand."),
  sold("jagdbogen", "Jagdbogen", "waffe", "bow", 100, "Ein Bogen, straff gespannt wie eine Saite."),
  sold("eisklinge", "Eisklinge", "waffe", "sword-ice", 200, "Eine kalt funkelnde Klinge aus fernen Bergen."),
  reward("goldener-dolch", "Goldener Dolch", "waffe", "dagger-gold", "07-akkordwechsel", "Die Belohnung dafür, dass du Akkorde flüssig wechselst."),
  reward("feuerstab", "Feuerstab", "waffe", "staff-red", "metal-ganzer-song", "Die Belohnung dafür, dass du einen ganzen Metal-Song gespielt hast."),
  sold("rundschild", "Rundschild", "schild", "shield-wood", 40, "Ein einfaches Schild aus Holz."),
  sold("eichenschild", "Eichenschild", "schild", "shield", 90, "Robust und mit Eisen beschlagen."),
  sold("hafenwappen", "Hafenwappen", "schild", "shield-blue", 180, "Ein blaues Wappen aus der Hafenstadt."),
  reward("sonnenwappen", "Sonnenwappen", "schild", "emblem", "song-bards-ganz", "Die Belohnung dafür, dass du ein ganzes Barden-Lied gespielt hast."),
  sold("smaragdring", "Smaragdring", "ring", "ring", 60, "Ein Ring mit grünem Stein."),
  sold("saphirring", "Saphirring", "ring", "ring-gem", 140, "Ein Ring mit tiefblauem Stein."),
  reward("flammenring", "Flammenring", "ring", "ring-fire", "11-pentatonik", "Die Belohnung dafür, dass du die Pentatonik gelernt hast."),
  reward("rosenring", "Rosenring", "ring", "ring-pink", "caged-g", "Die Belohnung dafür, dass du die G-Form von CAGED gelernt hast."),
  sold("heiltrank", "Heiltrank", "talisman", "potion", 15, "Ein roter Trank für müde Finger."),
  sold("manatrank", "Manatrank", "talisman", "mana", 15, "Ein blauer Trank für klare Gedanken."),
  sold("alter-schluessel", "Alter Schlüssel", "talisman", "key", 20, "Öffnet vielleicht eine Tür, vielleicht auch nicht."),
  sold("rubin", "Rubin", "talisman", "ruby", 250, "Ein seltener Edelstein für Ausdauernde."),
  reward("barre-urkunde", "Barre-Urkunde", "talisman", "parchment", "10-barre", "Die Belohnung dafür, dass du den Barré-Griff gelernt hast."),
  reward("zauberrolle", "Zauberrolle", "talisman", "scroll", "13-theorie", "Die Belohnung dafür, dass du die Theorie gelernt hast."),
  reward("feuerbeutel", "Feuerbeutel", "talisman", "firebag", "lead-erstes-solo", "Die Belohnung dafür, dass du dein erstes Solo gespielt hast."),
  reward("truhe-der-strasse", "Truhe der Straße", "talisman", "chest-blue", "jam-frei", "Die Belohnung dafür, dass du frei jammen kannst."),
];

export function gearItem(id: string): GearItem | undefined {
  return GEAR.find((g) => g.id === id);
}

/** Purchased items plus milestone items whose lesson is done, in catalogue order. */
export function ownedItems(purchased: string[], lessons: Record<string, LessonStatus>): string[] {
  const bought = new Set(purchased);
  return GEAR.filter((g) => {
    if (g.milestone !== null) return lessons[g.milestone] === "gelernt" || lessons[g.milestone] === "gemeistert";
    return bought.has(g.id);
  }).map((g) => g.id);
}

export type BuyRefusal = "unbekannt" | "nicht-kaeuflich" | "schon-besessen" | "zu-wenig-gold";

export const BUY_REFUSAL_TEXT: Record<BuyRefusal, string> = {
  unbekannt: "Unbekannter Gegenstand",
  "nicht-kaeuflich": "Nur als Belohnung erhältlich",
  "schon-besessen": "Schon in deinem Besitz",
  "zu-wenig-gold": "Nicht genug Gold",
};

export function buyCheck(itemId: string, gold: number, owned: string[]): BuyRefusal | null {
  const item = gearItem(itemId);
  if (!item) return "unbekannt";
  if (item.price === null) return "nicht-kaeuflich";
  if (owned.includes(itemId)) return "schon-besessen";
  if (gold < item.price) return "zu-wenig-gold";
  return null;
}
