import { z } from "zod";

export const kanaEntrySchema = z.object({
  kana: z.string().min(1),
  romaji: z.string().min(1),
  strokes: z.number().int().positive(),
  merksatz: z.string().min(10),
  beispiel: z.object({
    wort: z.string().min(1),
    lesung: z.string().min(1),
    bedeutung: z.string().min(1),
  }),
  verwechslung: z.array(z.string()).default([]),
});

export const kanaFileSchema = z.object({
  script: z.enum(["hiragana", "katakana"]),
  entries: z.array(kanaEntrySchema).min(1),
});

export const kanjiEntrySchema = z.object({
  kanji: z.string().min(1),
  bedeutung: z.string().min(1),
  on: z.array(z.string()).default([]),
  kun: z.array(z.string()).default([]),
  strokes: z.number().int().positive(),
  radikal: z.string().min(1),
  merksatz: z.string().min(10),
  beispiele: z
    .array(
      z.object({
        wort: z.string().min(1),
        lesung: z.string().min(1),
        bedeutung: z.string().min(1),
        lesungsart: z.enum(["on", "kun"]),
      }),
    )
    .min(1),
});

export const satzSchema = z.object({
  id: z.string().min(1),
  japanisch: z.string().min(1),
  stufe: z.enum(["wort", "satz", "absatz"]),
  uebersetzung: z.string().min(1),
  tokens: z
    .array(
      z.object({
        text: z.string().min(1),
        lesung: z.string().optional(),
        bedeutung: z.string().optional(),
        begruendung: z.string().optional(),
      }),
    )
    .min(1),
});

export type KanaEntry = z.infer<typeof kanaEntrySchema>;
export type KanaFile = z.infer<typeof kanaFileSchema>;
export type KanjiEntry = z.infer<typeof kanjiEntrySchema>;
export type Satz = z.infer<typeof satzSchema>;

function fail(source: string, error: z.ZodError): { ok: false; error: string } {
  return {
    ok: false,
    error: `${source} — ${error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
  };
}

export function parseKanaFile(
  input: unknown,
  source: string,
): { ok: true; file: KanaFile } | { ok: false; error: string } {
  const parsed = kanaFileSchema.safeParse(input);
  if (!parsed.success) return fail(source, parsed.error);
  const seen = new Set<string>();
  for (const entry of parsed.data.entries) {
    if (seen.has(entry.kana)) {
      return { ok: false, error: `${source} — Zeichen "${entry.kana}" kommt mehrfach vor.` };
    }
    seen.add(entry.kana);
  }
  return { ok: true, file: parsed.data };
}

export function parseKanjiFile(
  input: unknown,
  source: string,
): { ok: true; entries: KanjiEntry[] } | { ok: false; error: string } {
  const parsed = z.array(kanjiEntrySchema).safeParse(input);
  if (!parsed.success) return fail(source, parsed.error);
  return { ok: true, entries: parsed.data };
}

export function parseSatzFile(
  input: unknown,
  source: string,
): { ok: true; saetze: Satz[] } | { ok: false; error: string } {
  const parsed = z.array(satzSchema).safeParse(input);
  if (!parsed.success) return fail(source, parsed.error);
  return { ok: true, saetze: parsed.data };
}
