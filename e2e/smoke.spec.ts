import { expect, test } from "@playwright/test";

test("dashboard leads through a review into the statistics", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Übersicht" })).toBeVisible();
  await expect(page.getByRole("main").getByText("Demo")).toBeVisible();

  await page.getByRole("link", { name: "Jetzt wiederholen" }).first().click();
  await expect(page.getByRole("button", { name: /Aufdecken/ })).toBeVisible();

  await page.getByRole("button", { name: /Aufdecken/ }).click();
  await page.getByRole("button", { name: /Gut/ }).click();

  await page.getByRole("link", { name: "Statistik" }).click();
  await expect(page.getByRole("heading", { name: "Statistik" })).toBeVisible();
  await expect(page.getByText("Serie")).toBeVisible();
});

test("the pinned reference is reachable from the header", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Tastenkürzel" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText("Leertaste")).toBeVisible();
});
