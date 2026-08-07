import { expect, test } from "@playwright/test";

test("kana quick access is reachable from the header", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Hiragana" }).click();
  await page.getByRole("button", { name: "あ" }).click();
  await expect(page.getByText(/Merksatz/)).toBeVisible();
});

test("the reading trainer reveals a reading with its justification", async ({ page }) => {
  await page.goto("/skill/japanese/lesen");
  await page.getByRole("tab", { name: "Lesetraining" }).click();
  await page.getByRole("button", { name: /Aufdecken/ }).click();
  await expect(page.getByRole("button", { name: /Konnte ich lesen/ })).toBeVisible();
});

test("japanese vocabulary is due on the dashboard", async ({ page }) => {
  await page.goto("/");
  // Both the sidebar and the dashboard card show "Japanisch"; scope to the main
  // content to keep the locator unambiguous.
  await expect(page.getByRole("main").getByText("Japanisch")).toBeVisible();
  await page.getByRole("link", { name: "Japanisch" }).first().click();
  await expect(page.getByRole("link", { name: "Themen-Vokabeln" })).toBeVisible();
});
