import { expect, type Page, test } from "@playwright/test";
import { skipIntro } from "./guitar-helpers.js";
test.beforeEach(async ({ request }) => {
  await skipIntro(request);
});

const BASE = "/vollbild/guitar/spiel";
const PLACES = ["", "quests", "taverne", "bibliothek", "chronik", "griffbrett", "jam", "riffs"];

test.use({ viewport: { width: 390, height: 844 } });

/** Passes the placement when an earlier run has not done it yet, then waits for the village. */
async function reachVillage(page: Page) {
  await page.goto(BASE);
  const placement = page.getByRole("heading", { name: "Einstufung" });
  const village = page.getByRole("region", { name: "Heutige Quests" });
  await expect(placement.or(village)).toBeVisible();
  if (await placement.isVisible()) {
    await page.getByLabel(/Haltung/).first().check();
    await page.getByRole("button", { name: "Weiter" }).click();
    await page.getByRole("button", { name: "Weiter" }).click();
    await page.getByRole("button", { name: "Fertig" }).click();
  }
  await page.goto(BASE);
  await expect(village).toBeVisible();
  await expect(village.getByRole("link").first()).toBeVisible();
}

test("no page scrolls sideways", async ({ page }) => {
  await reachVillage(page);
  for (const place of PLACES) {
    await page.goto(place === "" ? BASE : `${BASE}/${place}`);
    await expect(page.locator(".game-hud")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sideways, `/${place} scrolls sideways`).toBeLessThanOrEqual(0);
  }
});

test("the status bar shows level, streak and week time", async ({ page }) => {
  await reachVillage(page);
  const bar = page.locator(".game-hud");
  await expect(bar.getByText(/Level \d+/)).toBeVisible();
  await expect(bar.getByText(/Tage? Serie/)).toBeVisible();
  await expect(bar.getByText("diese Woche")).toBeVisible();
});

test("today's quests come first and the painting stays away", async ({ page }) => {
  await reachVillage(page);
  const today = page.getByRole("region", { name: "Heutige Quests" });
  const village = page.getByRole("navigation", { name: "Dorf" });
  const todayBox = await today.boundingBox();
  const villageBox = await village.boundingBox();
  expect(todayBox!.y).toBeLessThan(villageBox!.y);
  await expect(village.locator("img")).toBeHidden();
});

test("a quest starts in one tap", async ({ page }) => {
  await reachVillage(page);
  await page.getByRole("region", { name: "Heutige Quests" }).getByRole("link").first().click();
  await expect(page.getByRole("button", { name: "Fertig" })).toBeVisible();
});
