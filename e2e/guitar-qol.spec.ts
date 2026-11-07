import { expect, test } from "@playwright/test";
import { reachBoard, weekMinutes } from "./guitar-helpers";

test("free practice entry raises week time and can be undone", async ({ page }) => {
  await reachBoard(page);
  const before = await weekMinutes(page);

  await page.getByRole("button", { name: /Frei üben/ }).click();
  const panel = page.getByRole("dialog", { name: "Frei üben" });
  await panel.getByLabel("Minuten").fill("5");
  await panel.getByRole("button", { name: "Eintragen" }).click();
  await expect(panel.getByText(/\+\d+ XP · \+\d+ Gold/)).toBeVisible();
  // Other specs share the database, so compare against the start value only.
  await expect.poll(() => weekMinutes(page)).toBeGreaterThanOrEqual(before + 5);
  const afterSave = await weekMinutes(page);

  await panel.getByRole("button", { name: "Rückgängig" }).click();
  await expect(panel.getByText("Eintrag entfernt.")).toBeVisible();
  await expect(panel.getByText(/\+\d+ XP · \+\d+ Gold/)).toHaveCount(0);
  await expect.poll(() => weekMinutes(page)).toBeLessThanOrEqual(afterSave - 5);
});

test("quest pause freezes the timer", async ({ page }) => {
  await reachBoard(page);
  await page.locator(".quest-list a").first().click();
  const timer = page.getByRole("timer", { name: "Verstrichene Zeit" });
  await expect(timer).toBeVisible();

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(timer).toHaveText("Pausiert");
  await page.waitForTimeout(2500);
  await expect(timer).toHaveText("Pausiert");

  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(timer).not.toHaveText("Pausiert");
  await expect(timer).toHaveText(/^\d+:\d{2}$/);

  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Fertig" }).click();
  await expect(page.getByLabel("Geübte Minuten")).toBeVisible();
});
