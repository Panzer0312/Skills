import { expect, type APIRequestContext, type Page } from "@playwright/test";

const PREFS = "http://127.0.0.1:5174/api/game/guitar/prefs";

/** Marks the first-launch intro tour as seen, so it does not cover the page under test. */
export async function skipIntro(request: APIRequestContext) {
  const res = await request.put(PREFS, { data: { key: "intro.gesehen", value: true } });
  expect(res.ok()).toBe(true);
}

/** Back to defaults: every pref unset, so the intro shows again. */
export async function resetPrefs(request: APIRequestContext) {
  expect((await request.delete(PREFS)).ok()).toBe(true);
}

const BOARD = "/vollbild/guitar/spiel/quests";

/** Passes the placement when an earlier run has not done it yet, then waits for the board. */
export async function reachBoard(page: Page, entry = "/skill/guitar") {
  await page.goto(entry);
  const board = page.getByRole("heading", { name: "Quest Board" });
  // A placed player lands in the village or on the board, a new one on the placement.
  const placement = page.getByRole("heading", { name: "Einstufung" });
  const village = page.getByRole("region", { name: "Heutige Quests" });
  await expect(board.or(placement).or(village)).toBeVisible();
  if (await placement.isVisible()) {
    await page.getByLabel(/Haltung/).first().check();
    await page.getByRole("button", { name: "Weiter" }).click();
    await page.getByRole("button", { name: "Weiter" }).click();
    await page.getByRole("button", { name: "Fertig" }).click();
  }
  if (!(await board.isVisible())) await page.goto(BOARD);
  await expect(board).toBeVisible();
  await expect(page.locator(".quest-list li").first()).toBeVisible();
}

/** Week minutes from the status bar. */
export async function weekMinutes(page: Page): Promise<number> {
  const text = await page.locator(".game-stat", { hasText: "diese Woche" }).innerText();
  const [, h, m] = /(\d+)h (\d+)m/.exec(text) ?? [];
  return Number(h) * 60 + Number(m);
}
