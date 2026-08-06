import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api", () => {
  it("returns parsed json on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    await expect(api.get<{ ok: boolean }>("/api/health")).resolves.toEqual({ ok: true });
  });

  it("throws ApiError carrying the server error code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: "invalid_body", message: "Kaputt." } }), {
            status: 400,
          }),
      ),
    );
    await expect(api.post("/api/reviews", {})).rejects.toMatchObject({
      code: "invalid_body",
      message: "Kaputt.",
    });
  });

  it("reports a network failure as a connection error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const error = await api.get("/api/health").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("offline");
    expect((error as ApiError).message).toContain("Server");
  });
});
