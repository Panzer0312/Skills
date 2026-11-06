import { expect, test } from "@playwright/test";
import { reachBoard, weekMinutes } from "./guitar-helpers";

const BASE = "/vollbild/guitar/spiel";
const API = "http://127.0.0.1:5174/api";

test("Metronom: Galopp und Tempotrainer lassen sich in einer Quest einstellen", async ({ page }) => {
  await reachBoard(page);
  await page.goto(`${BASE}/quest/akkordwechsel-takt`);
  const panel = page.getByRole("region", { name: "Metronom" });
  await expect(panel).toBeVisible();

  await panel.getByLabel("Unterteilung").selectOption({ label: "Galopp" });
  await expect(panel.getByLabel("Unterteilung")).toHaveValue("galopp");

  await panel.getByText("Tempotrainer", { exact: true }).click();
  await panel.getByLabel("Bis").fill("180");
  await panel.getByLabel("Plus").fill("5");
  await panel.getByLabel("Alle (Takte)").fill("2");
  await panel.getByRole("button", { name: "Tempotrainer starten" }).click();

  await expect(panel.getByText(/Tempotrainer: \d+ → 180 BPM/)).toBeVisible();
  await expect(panel.getByRole("button", { name: "Metronom stoppen" })).toBeVisible();
  await panel.getByRole("button", { name: "Tempotrainer stoppen" }).click();
  await expect(panel.getByText(/Tempotrainer: /)).toHaveCount(0);
  await panel.getByRole("button", { name: "Metronom stoppen" }).click();
});

test("Griffbrett: Box 1 in A zeigt Bund 5 und 8", async ({ page }) => {
  await reachBoard(page);
  await page.goto(`${BASE}/griffbrett`);
  await page.getByLabel("Anzeige").selectOption("box");
  await page.getByLabel(/^Box/).selectOption("1");
  await page.getByLabel(/^Grundton/).selectOption("A");

  // The low E string is string 0: A on fret 5 is the root, C on fret 8 the third of the box.
  await expect(page.getByTestId("fret-0-5")).toHaveAttribute("data-in-scale", "true");
  await expect(page.getByTestId("fret-0-5")).toHaveAttribute("data-root", "true");
  await expect(page.getByTestId("fret-0-8")).toHaveAttribute("data-in-scale", "true");
  await expect(page.getByTestId("fret-0-6")).toHaveAttribute("data-in-scale", "false");
});

test("Notenfinder: ein Klick auf den richtigen Bund zählt", async ({ page }) => {
  await reachBoard(page);
  await page.goto(`${BASE}/griffbrett`);
  await page.getByRole("button", { name: "Start", exact: true }).click();

  const prompt = (await page.getByTestId("prompt").innerText()).trim();
  const [, name, stringName] = /^Finde (\S+) auf der (\S+)-Saite$/.exec(prompt) ?? [];
  expect(name, prompt).toBeTruthy();
  const strings = ["E", "A", "D", "G", "H", "e"];
  const opens = [4, 9, 2, 7, 11, 4];
  const pitches = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H"];
  const stringIndex = strings.indexOf(stringName!);
  const fret = (pitches.indexOf(name!) - opens[stringIndex]! + 12) % 12;

  await page.locator(`button[data-testid="finder-${stringIndex}-${fret}"]`).click();
  await expect(page.getByText("Treffer: 1")).toBeVisible();
  await page.getByRole("button", { name: "Abbrechen" }).click();
});

test("Taverne: Sterne bleiben nach dem Neuladen", async ({ page, request }) => {
  await reachBoard(page);
  const key = encodeURIComponent("uebung:em-am-wiege");
  expect((await request.put(`${API}/game/guitar/song/${key}`, { data: { stars: 0 } })).ok()).toBe(true);

  await page.goto(`${BASE}/taverne`);
  await page.getByRole("button", { name: /Zwei Akkorde, eine Wiege/ }).click();
  const stars = page.getByRole("group", { name: "Beherrschung" });
  await stars.getByRole("button", { name: "4 Sterne" }).click();
  await expect(stars.getByRole("button", { name: "4 Sterne" })).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  const card = page.getByRole("button", { name: /Zwei Akkorde, eine Wiege/ });
  await expect(card.getByRole("img", { name: "4 von 5 Sternen" })).toBeVisible();
  await expect(card.getByText("Zuletzt gespielt: heute")).toBeVisible();
});

test("Taverne: Abschnitt wiederholen springt zum gewählten Abschnitt", async ({ page, request }) => {
  const lines = (word: string) => Array.from({ length: 24 }, (_, i) => `[Am]${word} Zeile ${i + 1} [G]weiter`).join("\n");
  const title = `Scrolltest ${Date.now()}`;
  const content = [
    `{title: ${title}}`,
    "{artist: E2E}",
    "{start_of_verse: Strophe}",
    lines("Erste"),
    "{end_of_verse}",
    "{start_of_chorus: Refrain}",
    lines("Zweite"),
    "{end_of_chorus}",
    "{start_of_verse: Strophe}",
    lines("Dritte"),
    "{end_of_verse}",
  ].join("\n");
  const created = await request.post(`${API}/songs`, { data: { content } });
  expect(created.ok()).toBe(true);
  const { song } = await created.json();

  try {
    await reachBoard(page);
    await page.goto(`${BASE}/taverne`);
    await page.getByRole("button", { name: new RegExp(title) }).click();

    const window_ = page.locator("div.overflow-y-auto").filter({ hasText: "Erste Zeile 1" });
    const picker = page.getByLabel("Abschnitt wiederholen");
    await expect(picker.locator("option")).toHaveCount(4);
    const scrollTop = () => window_.evaluate((el) => el.scrollTop);
    expect(await window_.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    expect(await scrollTop()).toBe(0);

    // The first line of the n-th section (the child after its heading), measured from the top of the window.
    const lineTop = (n: number) =>
      window_.evaluate((el, index) => {
        const line = el.querySelectorAll("section")[index]?.children[1];
        if (!line) throw new Error(`no first line in section ${index}`);
        return line.getBoundingClientRect().top - el.getBoundingClientRect().top;
      }, n);
    // The section heading sits above its first line, so the line starts within a few rows of the top.
    const NEAR_TOP = 120;

    await picker.selectOption({ index: 2 });
    await expect.poll(scrollTop).toBeGreaterThan(0);
    const second = await scrollTop();
    expect(await lineTop(1)).toBeLessThan(NEAR_TOP);
    expect(await lineTop(1)).toBeGreaterThanOrEqual(0);

    // Strophe appears twice: the third entry has to land on the second one, not the first.
    await picker.selectOption({ index: 3 });
    await expect.poll(scrollTop).toBeGreaterThan(second);
    expect(await lineTop(2)).toBeLessThan(NEAR_TOP);
    expect(await lineTop(2)).toBeGreaterThanOrEqual(0);

    await picker.selectOption({ index: 1 });
    await expect.poll(scrollTop).toBeLessThan(second);
    expect(await lineTop(0)).toBeLessThan(NEAR_TOP);
  } finally {
    await request.delete(`${API}/songs/${song.id}`);
  }
});

test("Chronik: ein Wechsel-Ergebnis erscheint im Graphen", async ({ page, request }) => {
  await page.clock.install();
  await reachBoard(page);
  const before = await weekMinutes(page);
  // A value no earlier run can have left behind, so stale history cannot pass.
  const unique = 100 + (Date.now() % 900);

  await page.goto(`${BASE}/quest/wechsel-minute`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(3_200);
  await page.clock.runFor(60_500);
  await page.getByLabel("Wie viele saubere Wechsel?").fill(String(unique));
  await page.getByRole("button", { name: "Speichern" }).click();
  await page.getByRole("button", { name: "Fertig" }).click();
  await page.getByRole("button", { name: "Passt" }).click();
  await page.getByLabel("Geübte Minuten").fill("5");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText(/^\+\d+ XP$/)).toBeVisible();
  await page.getByRole("button", { name: "Zurück zum Board" }).click();
  await expect(page.getByRole("heading", { name: "Quest Board" })).toBeVisible();
  // The 5 quest minutes are in, plus the minute the change round logged itself.
  await expect.poll(() => weekMinutes(page)).toBeGreaterThanOrEqual(before + 5);
  const afterBoard = await weekMinutes(page);

  const history = await (await request.get(`${API}/game/guitar/history`)).json();
  const metric = (history.metrics as { key: string; value: number }[]).find(
    (m) => m.key.startsWith("wechsel:") && m.value === unique,
  );
  expect(metric, `a change metric of ${unique}`).toBeTruthy();
  const pair = metric!.key.slice("wechsel:".length).replace("-", "–");

  await page.goto(`${BASE}/chronik`);
  await expect(page.getByRole("heading", { name: "Wechsel pro Minute" })).toBeVisible();
  const chart = page.getByRole("img", { name: new RegExp(`Wechsel .*${pair}, zuletzt ${unique}`) });
  if (!(await chart.isVisible())) await page.getByLabel("Wechsel", { exact: true }).selectOption({ label: pair });
  await expect(chart).toBeVisible();
  await expect(page.getByRole("img", { name: /Minuten pro Woche/ })).toBeVisible();
  await expect(page.locator("dt", { hasText: "Diese Woche" }).locator("+ dd")).toHaveText(
    `${Math.floor(afterBoard / 60)}h ${afterBoard % 60}m`,
  );
});

test("Jam Room: Start und Stopp, Tonleiter passt zur Tonart", async ({ page }) => {
  await reachBoard(page);
  await page.goto(`${BASE}/jam`);
  await page.getByLabel("Tonart").selectOption("A");
  await page.getByLabel("Stil").selectOption("rock");
  await expect(page.getByText("Spiele dazu: A Moll-Pentatonik")).toBeVisible();
  // A is the root on the low E string at fret 5, and fret 6 is outside the scale.
  await expect(page.getByTestId("fret-0-5")).toHaveAttribute("data-root", "true");
  await expect(page.getByTestId("fret-0-6")).toHaveAttribute("data-in-scale", "false");

  await page.getByRole("button", { name: "Starten" }).click();
  await expect(page.getByRole("button", { name: "Stoppen" })).toBeVisible();
  await expect(page.getByTestId("jam-chord")).not.toHaveText("–");

  await page.getByLabel("Stil").selectOption("metal");
  await expect(page.getByText("Spiele dazu: A Moll-Tonleiter")).toBeVisible();

  await page.getByRole("button", { name: "Stoppen" }).click();
  await expect(page.getByRole("button", { name: "Starten" })).toBeVisible();
});

test("Riffs: Tab sichtbar, Tempo geht ans Metronom", async ({ page }) => {
  await reachBoard(page);
  await page.goto(`${BASE}/riffs`);
  const riff = page.getByRole("article", { name: "Powerchord-Aufstieg" });
  await expect(riff.getByTestId("tab-zeile")).toHaveCount(6);
  await riff.getByRole("button", { name: "Metronom auf 90 BPM stellen" }).click();
  await expect(page.getByRole("region", { name: "Metronom" }).getByText("90 BPM", { exact: true })).toBeVisible();

  const other = page.getByRole("article", { name: "Palm Mute mit Akzenten" });
  await other.getByRole("button", { name: /Metronom auf 70 BPM/ }).click();
  await expect(page.getByRole("region", { name: "Metronom" }).getByText("70 BPM", { exact: true })).toBeVisible();
});
