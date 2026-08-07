import { describe, expect, it, vi } from "vitest";
import { assertPublicUrl, extractSongText, fetchSongFromUrl, FetchError } from "./songFetch.js";

describe("assertPublicUrl", () => {
  it("accepts a public https url", () => {
    expect(assertPublicUrl("https://example.com/tab").hostname).toBe("example.com");
  });

  it("rejects non-http schemes", () => {
    expect(() => assertPublicUrl("file:///etc/passwd")).toThrowError(FetchError);
    expect(() => assertPublicUrl("ftp://example.com")).toThrowError(/http/i);
  });

  it("rejects loopback and private addresses", () => {
    for (const url of [
      "http://localhost:5174/api/settings",
      "http://127.0.0.1/",
      "http://10.1.2.3/",
      "http://192.168.1.1/",
      "http://172.16.0.5/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/",
    ]) {
      expect(() => assertPublicUrl(url), url).toThrowError(FetchError);
    }
  });

  it("rejects garbage", () => {
    expect(() => assertPublicUrl("nicht mal eine url")).toThrowError(/bad_url|URL/i);
  });
});

describe("extractSongText", () => {
  it("prefers pre blocks", () => {
    const html = "<html><body><p>Werbung</p><pre>e|--0--|\nB|--1--|</pre></body></html>";
    expect(extractSongText(html)).toContain("e|--0--|");
    expect(extractSongText(html)).not.toContain("Werbung");
  });

  it("joins several pre blocks", () => {
    const html = "<pre>Teil eins</pre><pre>Teil zwei</pre>";
    const text = extractSongText(html);
    expect(text).toContain("Teil eins");
    expect(text).toContain("Teil zwei");
  });

  it("decodes html entities", () => {
    expect(extractSongText("<pre>C &amp; G</pre>")).toContain("C & G");
  });

  it("falls back to the body text when there is no pre block", () => {
    expect(extractSongText("<body><div>G  C\nZeile</div></body>")).toContain("Zeile");
  });

  it("throws when nothing usable is left", () => {
    expect(() => extractSongText("<html><head></head><body></body></html>")).toThrowError(/no_content|Inhalt/i);
  });
});

describe("fetchSongFromUrl", () => {
  it("returns the extracted text and the page title", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("<html><head><title>Mein Riff</title></head><body><pre>Em Am</pre></body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    ) as unknown as typeof fetch;

    const result = await fetchSongFromUrl("https://example.com/tab", { fetchImpl });
    expect(result.text).toContain("Em Am");
    expect(result.title).toBe("Mein Riff");
  });

  it("reports an unreachable host with a helpful message", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const error = await fetchSongFromUrl("https://example.com/x", { fetchImpl }).catch((e) => e);
    expect(error).toBeInstanceOf(FetchError);
    expect((error as FetchError).code).toBe("unreachable");
    expect((error as FetchError).message).toMatch(/stattdessen ein/i);
  });

  it("refuses a response larger than the limit", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("x".repeat(5000), {
          status: 200,
          headers: { "content-type": "text/html", "content-length": "5000" },
        }),
    ) as unknown as typeof fetch;

    const error = await fetchSongFromUrl("https://example.com/x", { fetchImpl, maxBytes: 1000 }).catch((e) => e);
    expect((error as FetchError).code).toBe("too_large");
  });

  it("refuses a redirect that points at a private address", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("", { status: 302, headers: { location: "http://127.0.0.1/secret" } }),
    ) as unknown as typeof fetch;

    const error = await fetchSongFromUrl("https://example.com/x", { fetchImpl }).catch((e) => e);
    expect((error as FetchError).code).toBe("blocked_host");
  });

  it("enforces a timeout and reports it clearly", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    ) as unknown as typeof fetch;

    const error = await fetchSongFromUrl("https://example.com/slow", { fetchImpl, timeoutMs: 5 }).catch((e) => e);
    expect(error).toBeInstanceOf(FetchError);
    expect((error as FetchError).code).toBe("timeout");
    expect((error as FetchError).message).toMatch(/stattdessen ein/i);
  });

  it("gives up after too many redirects", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("", { status: 302, headers: { location: "https://example.com/next" } }),
    ) as unknown as typeof fetch;

    const error = await fetchSongFromUrl("https://example.com/x", { fetchImpl }).catch((e) => e);
    expect(error).toBeInstanceOf(FetchError);
  });
});
