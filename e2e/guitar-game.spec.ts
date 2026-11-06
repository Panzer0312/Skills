import { expect, type Page, test } from "@playwright/test";
import { reachBoard, weekMinutes } from "./guitar-helpers";

const BOARD = "/vollbild/guitar/spiel/quests";

/** Reads level, XP into the level and week minutes from the status bar. */
async function readStatus(page: Page) {
  const level = Number((await page.locator(".game-hud b", { hasText: /^Level / }).innerText()).replace("Level ", ""));
  const xp = Number(await page.getByRole("progressbar", { name: "Erfahrung" }).getAttribute("aria-valuenow"));
  return { score: level * 1_000_000 + xp, weekMinutes: await weekMinutes(page) };
}

test("a first session runs from placement to XP in the status bar", async ({ page }) => {
  await reachBoard(page, "/skill/guitar");
  const before = await readStatus(page);

  await page.locator(".quest-list a").first().click();
  await page.getByRole("button", { name: "Fertig" }).click();
  await page.getByRole("button", { name: "Passt" }).click();
  await page.getByLabel("Geübte Minuten").fill("5");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText(/^\+\d+ XP$/)).toBeVisible();
  await page.getByRole("button", { name: "Zurück zum Board" }).click();

  await expect(page.getByRole("heading", { name: "Quest Board" })).toBeVisible();
  await expect.poll(async () => (await readStatus(page)).score).toBeGreaterThan(before.score);
  await expect.poll(async () => (await readStatus(page)).weekMinutes).toBe(before.weekMinutes + 5);
});

test("a chord change quest runs its 60 second round and logs the metric", async ({ page }) => {
  await page.clock.install();
  await reachBoard(page, BOARD);
  const before = await readStatus(page);

  await page.goto("/vollbild/guitar/spiel/quest/wechsel-minute");
  await expect(page.getByRole("timer", { name: "Verstrichene Zeit" })).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(3_200);
  await page.clock.runFor(60_500);
  await page.getByLabel("Wie viele saubere Wechsel?").fill("14");
  await page.getByRole("button", { name: "Speichern" }).click();

  await page.getByRole("button", { name: "Fertig" }).click();
  await page.getByRole("button", { name: "Passt" }).click();
  await expect(page.getByLabel(/Wechsel/).last()).toHaveValue("14");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText(/^\+\d+ XP$/)).toBeVisible();
  await page.getByRole("button", { name: "Zurück zum Board" }).click();

  await expect(page.getByRole("heading", { name: "Quest Board" })).toBeVisible();
  await expect.poll(async () => (await readStatus(page)).score).toBeGreaterThan(before.score);
});

test("the tuner stays reachable from the pinned link", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Stimmgerät", exact: true }).click();
  await expect(page.getByRole("button", { name: /Stimmgerät starten/ })).toBeVisible();
});
