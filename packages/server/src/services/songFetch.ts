import * as cheerio from "cheerio";

export type FetchErrorCode =
  | "bad_url"
  | "blocked_host"
  | "timeout"
  | "too_large"
  | "unreachable"
  | "no_content";

export class FetchError extends Error {
  readonly code: FetchErrorCode;
  constructor(code: FetchErrorCode, message: string) {
    super(message);
    this.name = "FetchError";
    this.code = code;
  }
}

// IPv4 ranges that are not publicly routable: loopback, RFC1918 private space,
// link-local (incl. cloud metadata endpoints living at 169.254.x.x), the "this
// network" block, and the RFC6598 carrier-grade NAT range.
const PRIVATE_V4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64.0.0/10
];

function isBlockedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;

  // IPv4-mapped IPv6 addresses (::ffff:127.0.0.1) must be checked against the
  // same v4 ranges, otherwise they are a trivial bypass of the guard below.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(host);
  if (mapped) return PRIVATE_V4.some((pattern) => pattern.test(mapped[1]!));

  if (host === "::1" || host === "0:0:0:0:0:0:0:1" || host === "::") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true; // fc00::/7 unique local
  if (/^fe80:/.test(host)) return true; // link-local

  return PRIVATE_V4.some((pattern) => pattern.test(host));
}

export function assertPublicUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new FetchError("bad_url", "Das ist keine gültige URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchError("bad_url", "Nur http- und https-Adressen werden abgerufen.");
  }

  if (isBlockedHost(url.hostname)) {
    throw new FetchError(
      "blocked_host",
      "Diese Adresse zeigt auf das lokale Netz und wird nicht abgerufen.",
    );
  }

  return url;
}

export function extractSongText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const pres = $("pre")
    .map((_, element) => $(element).text())
    .get()
    .map((text) => text.trim())
    .filter((text) => text.length > 0);

  const candidate =
    pres.length > 0
      ? pres.join("\n\n")
      : $("body")
          .text()
          .split(/\r?\n/)
          .map((line) => line.trimEnd())
          .join("\n")
          .trim();

  if (candidate.trim().length === 0) {
    throw new FetchError("no_content", "Auf der Seite wurde kein verwertbarer Inhalt gefunden.");
  }

  return candidate;
}

interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  fetchImpl?: typeof fetch;
}

const MAX_REDIRECTS = 3;

export async function fetchSongFromUrl(
  input: string,
  options: FetchOptions = {},
): Promise<{ text: string; title: string | null }> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxBytes = options.maxBytes ?? 2_000_000;
  const doFetch = options.fetchImpl ?? fetch;

  // Re-validated on every hop below — never just on the initial URL — so a
  // redirect cannot be used to smuggle the request onto a private address.
  let url = assertPublicUrl(input);
  let response: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let current: Response;
    try {
      current = await doFetch(url.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "SkillsApp/1.0 (persönlicher Gebrauch)", accept: "text/html,text/plain" },
      });
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof Error && error.name === "AbortError") {
        throw new FetchError("timeout", "Die Seite hat zu lange gebraucht. Füge den Text stattdessen ein.");
      }
      throw new FetchError(
        "unreachable",
        "Die Seite konnte nicht geladen werden. Kopiere den Text und füge ihn stattdessen ein.",
      );
    } finally {
      clearTimeout(timer);
    }

    if (current.status >= 300 && current.status < 400) {
      const location = current.headers.get("location");
      if (!location) {
        throw new FetchError("unreachable", "Die Seite hat eine unvollständige Weiterleitung geschickt.");
      }
      url = assertPublicUrl(new URL(location, url).toString());
      continue;
    }

    response = current;
    break;
  }

  if (!response) {
    throw new FetchError("unreachable", "Zu viele Weiterleitungen. Füge den Text stattdessen ein.");
  }

  if (!response.ok) {
    throw new FetchError("unreachable", `Die Seite antwortete mit Status ${response.status}.`);
  }

  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    throw new FetchError("too_large", "Die Seite ist zu groß. Füge den Text stattdessen ein.");
  }

  const html = await response.text();
  if (html.length > maxBytes) {
    throw new FetchError("too_large", "Die Seite ist zu groß. Füge den Text stattdessen ein.");
  }

  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
  return { text: extractSongText(html), title: title && title.length > 0 ? title : null };
}
