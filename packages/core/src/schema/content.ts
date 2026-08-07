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

const fretSchema = z.number().int().min(0).max(24).nullable();
const fingerSchema = z.number().int().min(1).max(4).nullable();

export const chordFileEntrySchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1).optional(),
  frets: z.array(fretSchema).length(6),
  fingers: z.array(fingerSchema).length(6),
  baseFret: z.number().int().min(1).max(24),
});

export const chordFileSchema = z.array(chordFileEntrySchema).min(1);

export type ChordFileEntry = z.infer<typeof chordFileEntrySchema>;

export type ParseChordFileResult =
  | { ok: true; entries: ChordFileEntry[] }
  | { ok: false; error: string };

export function parseChordFile(input: unknown, source: string): ParseChordFileResult {
  const parsed = chordFileSchema.safeParse(input);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(wurzel)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: `${source} — ${detail}` };
  }
  return { ok: true, entries: parsed.data };
}
