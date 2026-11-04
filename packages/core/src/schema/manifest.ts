import { z } from "zod";

const slug = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "muss ein Slug aus Kleinbuchstaben, Ziffern und Bindestrichen sein");

export const moduleTypeSchema = z.enum([
  "course",
  "srs-deck",
  "reference",
  "practice",
  "library",
]);

export const skillModuleSchema = z.object({
  id: slug,
  type: moduleTypeSchema,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  pinned: z.boolean().default(false),
  widget: z.string().min(1).optional(),
  data: z.array(z.string().min(1)).default([]),
  dailyNewLimit: z.number().int().positive().optional(),
  dailyReviewLimit: z.number().int().positive().optional(),
  fullscreen: z.boolean().default(false),
  redirect: z.string().min(1).optional(),
});

export const skillManifestSchema = z
  .object({
    id: slug,
    name: z.string().min(1),
    icon: z.string().min(1),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "muss eine Hex-Farbe sein"),
    description: z.string().default(""),
    entry: z.string().min(1).optional(),
    modules: z.array(skillModuleSchema).min(1),
  })
  .superRefine((manifest, ctx) => {
    const seen = new Set<string>();
    for (const mod of manifest.modules) {
      if (seen.has(mod.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["modules"],
          message: `Modul-IDs müssen eindeutig sein: "${mod.id}" kommt mehrfach vor.`,
        });
      }
      seen.add(mod.id);
    }
  });

export type SkillModule = z.infer<typeof skillModuleSchema>;
export type SkillManifest = z.infer<typeof skillManifestSchema>;
export type ModuleType = z.infer<typeof moduleTypeSchema>;

export type ParseManifestResult =
  | { ok: true; manifest: SkillManifest }
  | { ok: false; error: string };

export function parseManifest(input: unknown): ParseManifestResult {
  const parsed = skillManifestSchema.safeParse(input);
  if (parsed.success) return { ok: true, manifest: parsed.data };
  const error = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(wurzel)"}: ${issue.message}`)
    .join("; ");
  return { ok: false, error };
}
