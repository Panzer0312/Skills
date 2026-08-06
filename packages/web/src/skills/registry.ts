import { parseManifest, type SkillManifest } from "@skills/core";

export interface LoadedSkill {
  manifest: SkillManifest;
  dir: string;
  data: Record<string, unknown>;
}

export interface BrokenSkill {
  dir: string;
  error: string;
}

export interface LoadResult {
  skills: LoadedSkill[];
  broken: BrokenSkill[];
}

function dirOf(path: string): string {
  const match = /\/skills\/([^/]+)\//.exec(path);
  return match?.[1] ?? path;
}

function relativeOf(path: string, dir: string): string {
  const marker = `/skills/${dir}/`;
  return path.slice(path.indexOf(marker) + marker.length);
}

function unwrap(mod: unknown): unknown {
  if (mod && typeof mod === "object" && "default" in mod) {
    return (mod as { default: unknown }).default;
  }
  return mod;
}

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
}

export function loadSkills(
  manifestModules: Record<string, unknown>,
  dataModules: Record<string, unknown>,
): LoadResult {
  const skills: LoadedSkill[] = [];
  const broken: BrokenSkill[] = [];

  const dataByDir = new Map<string, Map<string, unknown>>();
  for (const [path, mod] of Object.entries(dataModules)) {
    const dir = dirOf(path);
    const bucket = dataByDir.get(dir) ?? new Map<string, unknown>();
    bucket.set(relativeOf(path, dir), unwrap(mod));
    dataByDir.set(dir, bucket);
  }

  for (const [path, mod] of Object.entries(manifestModules)) {
    const dir = dirOf(path);
    const parsed = parseManifest(unwrap(mod));
    if (!parsed.ok) {
      broken.push({ dir, error: parsed.error });
      continue;
    }

    const available = dataByDir.get(dir) ?? new Map<string, unknown>();
    const data: Record<string, unknown> = {};
    let missing: string | null = null;

    for (const module of parsed.manifest.modules) {
      for (const entry of module.data) {
        if (entry.includes("*")) {
          const re = patternToRegExp(entry);
          for (const [key, value] of available) {
            if (re.test(key)) data[key] = value;
          }
          continue;
        }
        const value = available.get(entry);
        if (value === undefined) {
          missing = entry;
          break;
        }
        data[entry] = value;
      }
      if (missing) break;
    }

    if (missing) {
      broken.push({ dir, error: `Datei aus dem Manifest fehlt: ${missing}` });
      continue;
    }

    skills.push({ manifest: parsed.manifest, dir, data });
  }

  skills.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name, "de"));
  return { skills, broken };
}

const manifestGlob = import.meta.glob("../../../../skills/*/skill.json", { eager: true });
const dataGlob = import.meta.glob("../../../../skills/*/**/*.json", { eager: true });

let cached: LoadResult | null = null;

function result(): LoadResult {
  if (!cached) {
    const dataOnly = Object.fromEntries(
      Object.entries(dataGlob).filter(([path]) => !path.endsWith("/skill.json")),
    );
    cached = loadSkills(manifestGlob, dataOnly);
    for (const entry of cached.broken) {
      console.error(`Skill "${entry.dir}" wurde nicht geladen: ${entry.error}`);
    }
  }
  return cached;
}

export function getSkills(): LoadedSkill[] {
  return result().skills;
}

export function getBrokenSkills(): BrokenSkill[] {
  return result().broken;
}

export function getSkill(id: string): LoadedSkill | undefined {
  return getSkills().find((skill) => skill.manifest.id === id);
}
