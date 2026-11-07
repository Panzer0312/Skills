import type { z } from "zod";

export type PrefGroup =
  | "allgemein"
  | "klang"
  | "ueben"
  | "werkzeuge"
  | "geraete"
  | "darstellung"
  | "mentor"
  | "daten";

export type PrefUi =
  | { kind: "toggle" }
  | { kind: "select"; options: { value: string; label: string }[] }
  | { kind: "number"; min: number; max: number; step?: number; unit?: string }
  | { kind: "hidden" };

export interface PrefDef<T> {
  schema: z.ZodType<T>;
  default: T;
  label: string;
  help?: string;
  group: PrefGroup;
  ui: PrefUi;
}
