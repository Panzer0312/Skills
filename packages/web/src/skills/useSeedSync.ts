import { parseDeckFile } from "@skills/core";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import type { SeedCard, SeedRequest, SeedResult } from "../api/types.js";
import { getSkills, type LoadedSkill } from "./registry.js";

export function buildSeedPayload(skill: LoadedSkill): SeedRequest {
  const cards: SeedCard[] = [];

  for (const module of skill.manifest.modules) {
    if (module.type !== "srs-deck") continue;
    for (const [source, value] of Object.entries(skill.data)) {
      const declared = module.data.some((entry) =>
        entry.includes("*")
          ? new RegExp(`^${entry.replace(/\*/g, "[^/]*")}$`).test(source)
          : entry === source,
      );
      if (!declared) continue;

      const parsed = parseDeckFile(value, source);
      if (!parsed.ok) throw new Error(parsed.error);

      for (const card of parsed.deck.cards) {
        cards.push({
          moduleId: module.id,
          cardKey: card.key,
          front: card.front,
          back: card.back,
          ...(card.reading ? { reading: card.reading } : {}),
          ...(card.note ? { note: card.note } : {}),
          ...(card.example ? { example: card.example } : {}),
          tags: card.tags,
        });
      }
    }
  }

  return {
    skillId: skill.manifest.id,
    name: skill.manifest.name,
    modules: skill.manifest.modules.map((m) => ({ id: m.id, type: m.type, title: m.title })),
    cards,
  };
}

export type SeedStatus = "idle" | "syncing" | "done" | "error";

export function useSeedSync(): { status: SeedStatus; error: string | null } {
  const [status, setStatus] = useState<SeedStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("syncing");

    (async () => {
      try {
        for (const skill of getSkills()) {
          await api.post<SeedResult>("/api/skills/sync", buildSeedPayload(skill));
        }
        if (!cancelled) setStatus("done");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { status, error };
}
