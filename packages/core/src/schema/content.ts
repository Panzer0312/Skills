import { z } from "zod";

export const cardSchema = z.object({
  key: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  reading: z.string().optional(),
  note: z.string().optional(),
  example: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const deckFileSchema = z.object({
  deck: z.string().min(1),
  cards: z.array(cardSchema).min(1),
});

export type Card = z.infer<typeof cardSchema>;
export type DeckFile = z.infer<typeof deckFileSchema>;

export type ParseDeckResult =
  | { ok: true; deck: DeckFile }
  | { ok: false; error: string };

export function parseDeckFile(input: unknown, source: string): ParseDeckResult {
  const parsed = deckFileSchema.safeParse(input);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(wurzel)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: `${source} — ${detail}` };
  }
  const seen = new Set<string>();
  for (const card of parsed.data.cards) {
    if (seen.has(card.key)) {
      return { ok: false, error: `${source} — Kartenschlüssel "${card.key}" kommt mehrfach vor.` };
    }
    seen.add(card.key);
  }
  return { ok: true, deck: parsed.data };
}
