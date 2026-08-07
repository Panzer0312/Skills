import type { ChordShape } from "@skills/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { toShapeMap, type ChordOverrideEntry, type ChordOverrides } from "./chordOverrides.js";

interface ChordListResponse {
  global: ChordOverrideEntry[];
  song: ChordOverrideEntry[];
}

const EMPTY: ChordListResponse = { global: [], song: [] };

/**
 * Loads the override entries that apply to one song (or, without a key, only the
 * global ones) and writes changes back through `/api/chords`.
 */
export function useChordOverrides(songKey?: string) {
  const client = useQueryClient();
  const key = ["chords", songKey ?? null];

  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      api.get<ChordListResponse>(songKey ? `/api/chords?songKey=${encodeURIComponent(songKey)}` : "/api/chords"),
  });

  const invalidate = () => client.invalidateQueries({ queryKey: ["chords"] });

  const saveMutation = useMutation({
    mutationFn: (input: { symbol: string; shape: ChordShape; scope: "song" | "global" }) =>
      api.put("/api/chords", {
        scope: input.scope,
        songKey: input.scope === "song" ? songKey : undefined,
        symbol: input.symbol,
        name: input.shape.name || undefined,
        frets: input.shape.frets,
        fingers: input.shape.fingers,
        baseFret: input.shape.baseFret,
      }),
    onSuccess: invalidate,
  });

  const resetMutation = useMutation({
    mutationFn: (input: { symbol: string; scope: "song" | "global" }) => {
      const params = new URLSearchParams({ scope: input.scope, symbol: input.symbol });
      if (input.scope === "song" && songKey) params.set("songKey", songKey);
      return api.del(`/api/chords?${params.toString()}`);
    },
    onSuccess: invalidate,
  });

  const entries = query.data ?? EMPTY;

  return {
    entries,
    overrides: {
      song: toShapeMap(entries.song),
      global: toShapeMap(entries.global),
    } satisfies ChordOverrides,
    async save(symbol: string, shape: ChordShape, scope: "song" | "global") {
      await saveMutation.mutateAsync({ symbol, shape, scope });
    },
    async reset(symbol: string, scope: "song" | "global") {
      await resetMutation.mutateAsync({ symbol, scope });
    },
  };
}
