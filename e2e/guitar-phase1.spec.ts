import { expect, test } from "@playwright/test";
import { resetPrefs, skipIntro } from "./guitar-helpers.js";

const PREFS = "http://127.0.0.1:5174/api/game/guitar/prefs";
const GAME = "/vollbild/guitar/spiel";

// The e2e database persists, so every test starts from unset prefs and leaves the intro seen.
test.beforeEach(async ({ request }) => {
  await resetPrefs(request);
});
test.afterEach(async ({ request }) => {
  await resetPrefs(request);
  await skipIntro(request);
});

test("intro can be skipped and replayed from the Studierstube", async ({ page }) => {
  await page.goto(GAME);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Überspringen" }).click();
  await expect(dialog).toBeHidden();

  // Skipped once stays skipped after a reload.
  await page.reload();
  await expect(page.locator(".game-hud")).toBeVisible();
  await expect(dialog).toBeHidden();

  await page.goto(`${GAME}/studierstube`);
  await page.getByRole("tab", { name: "Daten" }).click();
  await page.getByRole("button", { name: "Intro erneut ansehen" }).click();
  await expect(dialog).toBeVisible();
});

test("a changed pref survives reload", async ({ page, request }) => {
  await skipIntro(request);
  await page.goto(`${GAME}/studierstube`);
  await page.getByRole("tab", { name: "Geräte" }).click();
  const select = page.getByLabel("Gitarre über Mikrofon oder Interface");
  await select.selectOption("ja");
  await expect.poll(async () => ((await (await request.get(PREFS)).json()) as { prefs: Record<string, unknown> }).prefs["geraete.gitarreAmMikro"]).toBe("ja");

  await page.reload();
  await page.getByRole("tab", { name: "Geräte" }).click();
  await expect(page.getByLabel("Gitarre über Mikrofon oder Interface")).toHaveValue("ja");
});

test("device Nein hides microphone buttons in the Note Finder", async ({ page, request }) => {
  await skipIntro(request);
  expect((await request.put(PREFS, { data: { key: "geraete.gitarreAmMikro", value: "spaeter" } })).ok()).toBe(true);
  await page.goto(`${GAME}/griffbrett`);
  await expect(page.getByRole("button", { name: "Mit Gitarre spielen" })).toBeVisible();

  expect((await request.put(PREFS, { data: { key: "geraete.gitarreAmMikro", value: "nein" } })).ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mit Gitarre spielen" })).toHaveCount(0);
});
