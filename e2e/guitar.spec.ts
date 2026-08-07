import { expect, test } from "@playwright/test";

test("the fretboard switches from note names to intervals", async ({ page }) => {
  await page.goto("/skill/guitar/griffbrett");
  await expect(page.getByTestId("fret-0-0")).toHaveText("E");
  await page.getByLabel("Anzeige").selectOption("intervalle");
  await page.getByLabel("Grundton").selectOption("E");
  await expect(page.getByTestId("fret-0-0")).toHaveText("1");
});

test("a practice song opens and transposes", async ({ page }) => {
  await page.goto("/skill/guitar/songs");
  await page.getByRole("button", { name: /Zwei Akkorde, eine Wiege/ }).click();
  await expect(page.getByRole("heading", { name: /Zwei Akkorde/ })).toBeVisible();
  await page.getByRole("button", { name: "Halbton höher" }).click();
  await expect(page.getByRole("heading", { name: "Fm" })).toBeVisible();
});

test("pasting a song shows a preview before saving", async ({ page }) => {
  await page.goto("/songs/neu");
  await page.getByLabel(/Text einfügen/).check();
  await page.getByLabel("Songtext").fill("{title: Testlied}\n[Em]Eine Zeile");
  await expect(page.getByText("ChordPro")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Testlied" })).toBeVisible();
});

test("the tuner explains itself before touching the microphone", async ({ page }) => {
  await page.goto("/skill/guitar/stimmgeraet");
  await expect(page.getByRole("button", { name: /Stimmgerät starten/ })).toBeVisible();
  await expect(page.getByLabel("Stimmung")).toBeVisible();
});
