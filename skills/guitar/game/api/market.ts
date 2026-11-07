import type { GearSlot } from "@skills/core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { api, ApiError } from "../../../../packages/web/src/api/client.js";
import { refreshingOnError, SKILL } from "./client.js";

/** The buy route answers a refusal as `{ error: "<German text>", reason }`, which the shared client does not unwrap. */
async function postBuy(itemId: string): Promise<{ gold: number }> {
  let response: Response;
  try {
    response = await fetch(`/api/game/${SKILL}/market/buy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
  } catch {
    throw new ApiError("offline", "Der Server ist nicht erreichbar. Läuft er noch?");
  }
  const body = (await response.json().catch(() => null)) as {
    gold?: number;
    error?: string | { code?: string; message?: string };
    reason?: string;
  } | null;
  if (!response.ok) {
    const message = typeof body?.error === "string" ? body.error : body?.error?.message;
    throw new ApiError(body?.reason ?? "unknown", message ?? `Anfrage fehlgeschlagen (${response.status}).`);
  }
  return { gold: body?.gold ?? 0 };
}

/** Buys one Market item. Rejects with the server's German refusal as the error message. */
export function useBuyItem(): UseMutationResult<{ gold: number }, Error, string> {
  return useMutation({
    mutationFn: (itemId: string) => refreshingOnError(postBuy(itemId)),
  });
}

/** Equips an owned item into its slot, or empties the slot with `itemId: null`. */
export function useEquip(): UseMutationResult<{ ok: true }, Error, { slot: GearSlot; itemId: string | null }> {
  return useMutation({
    mutationFn: (body: { slot: GearSlot; itemId: string | null }) =>
      refreshingOnError(api.put<{ ok: true }>(`/api/game/${SKILL}/equip`, body)),
  });
}
