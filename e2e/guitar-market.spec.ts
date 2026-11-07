import { expect, test } from "@playwright/test";
import { reachBoard, skipIntro } from "./guitar-helpers.js";
test.beforeEach(async ({ request }) => {
  await skipIntro(request);
});

const GAME = "/vollbild/guitar/spiel";

async function gold(page: import("@playwright/test").Page): Promise<number> {
  const text = await page.locator(".game-hud .game-stat", { hasText: "Gold" }).innerText();
  return Number(/(\d+)\s*Gold/.exec(text)?.[1]);
}

test("practice pays gold, the Market sells and equips the Wanderdolch, and it stays after a reload", async ({ page }) => {
  await reachBoard(page);
  // One hour of free play is 240 XP, so 48 Gold: enough for the dagger on every run.
  const logged = await page.request.post("/api/game/guitar/log", { data: { kind: "frei", seconds: 3600, level: 1 } });
  expect(logged.ok()).toBe(true);

  await page.goto(`${GAME}/markt`);
  await expect(page.getByRole("heading", { name: "Markt" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Händler" })).toBeVisible();
  const before = await gold(page);

  // The database outlives a run: an earlier run may own the dagger already.
  const buy = page.getByRole("button", { name: "Wanderdolch kaufen" });
  if ((await buy.count()) > 0 && (await buy.isEnabled())) {
    await buy.click();
    await expect.poll(() => gold(page)).toBe(before - 30);
  }

  const equip = page.getByRole("button", { name: "Wanderdolch anlegen" });
  if ((await equip.count()) > 0) await equip.click();
  const strip = page.locator(".game-hud").getByRole("img", { name: "Wanderdolch" });
  await expect(strip).toBeVisible();

  await page.reload();
  await expect(strip).toBeVisible();
});

test("the sound toggle is saved", async ({ page }) => {
  await reachBoard(page);
  await page.goto(GAME);
  const toggle = page.locator(".game-hud").getByRole("button", { name: /^Klang (an|aus)$/ });
  await expect(toggle).toBeVisible();
  const wasOn = (await toggle.getAttribute("aria-pressed")) === "true";
  // Pref writes are sent shortly after the click; reload only once the server has it.
  const saved = page.waitForResponse((r) => r.url().includes("/prefs") && r.request().method() === "PUT");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", String(!wasOn));
  await saved;
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", String(!wasOn));
  // Leave it off for later runs and for the owner.
  if (!wasOn) {
    const off = page.waitForResponse((r) => r.url().includes("/prefs") && r.request().method() === "PUT");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await off;
  }
});
