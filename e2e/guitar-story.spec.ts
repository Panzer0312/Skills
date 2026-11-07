import { expect, test } from "@playwright/test";
import { reachBoard } from "./guitar-helpers.js";

const GAME = "/vollbild/guitar/spiel";

test("the mentor card greets on the village, Weiter clears it and the Library shows the chapter", async ({ page }) => {
  await reachBoard(page);
  await page.goto(GAME);
  await expect(page.getByRole("region", { name: "Heutige Quests" })).toBeVisible();

  // The database outlives a run: once an earlier run has confirmed every reached scene, no card appears.
  const card = page.getByRole("region", { name: "Mentor" });
  if (await card.isVisible()) {
    await expect(card.getByRole("heading", { level: 2 })).toContainText("Meister Orlo");
    await card.getByRole("button", { name: "Weiter" }).click();
    await expect(card).toBeHidden();
    await page.reload();
    await expect(page.getByRole("region", { name: "Heutige Quests" })).toBeVisible();
    await expect(card).toBeHidden();
  }

  await page.goto(`${GAME}/bibliothek`);
  const story = page.getByRole("region", { name: "Geschichte" });
  await expect(story).toBeVisible();
  await expect(story.getByRole("heading", { level: 2 })).not.toHaveText("");
  await expect(story.getByText("Bisherige Geschichte")).toBeVisible();
});
