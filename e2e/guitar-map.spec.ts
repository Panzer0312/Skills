import { expect, type APIRequestContext, type Page, test } from "@playwright/test";

const API = "http://127.0.0.1:5174/api/game/guitar";
const HARBOR = "/vollbild/guitar/spiel/hafen";

/** Pauses every chosen lesson so a run does not depend on an earlier one. */
async function pauseChosen(request: APIRequestContext) {
  const state = await (await request.get(`${API}/state`)).json();
  for (const id of state.chosenLessons as string[]) {
    expect((await request.delete(`${API}/chosen/${id}`)).ok()).toBe(true);
  }
}

/** Passes the placement when needed, then waits for the map. */
async function reachMap(page: Page, path = HARBOR) {
  await page.goto("/skill/guitar");
  const placement = page.getByRole("heading", { name: "Einstufung" });
  const board = page.getByRole("heading", { name: "Quest Board" });
  const village = page.getByRole("region", { name: "Heutige Quests" });
  await expect(board.or(placement).or(village)).toBeVisible();
  if (await placement.isVisible()) {
    await page.getByLabel(/Haltung/).first().check();
    await page.getByRole("button", { name: "Weiter" }).click();
    await page.getByRole("button", { name: "Weiter" }).click();
    await page.getByRole("button", { name: "Fertig" }).click();
    await expect(board.or(village)).toBeVisible();
  }
  await page.goto(path);
  await expect(page.getByRole("group", { name: "Lernkarte" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tips Board" })).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  await pauseChosen(request);
});

test.afterEach(async ({ request }) => {
  await pauseChosen(request);
});

test("the map opens on best next and a lesson can be taken as quest", async ({ page }) => {
  await reachMap(page);
  const tips = page.getByRole("region", { name: "Tips Board" });
  await expect(tips.getByText("Bester nächster Schritt")).toBeVisible();
  const lesson = page.getByRole("region", { name: "Lektion" });
  await expect(lesson.getByRole("link", { name: "Lektion öffnen" })).toBeVisible();
  await expect(lesson.getByText("Hauptweg")).toBeVisible();

  // The quick win is a side lesson, so it can be taken as a quest.
  await tips
    .locator(".tips-entry")
    .filter({ has: page.getByRole("heading", { name: /Schneller Erfolg|Verfeinern/ }) })
    .getByRole("button")
    .click();
  const title = (await lesson.getByRole("heading", { level: 2 }).innerText()).trim();
  await lesson.getByRole("button", { name: "Als Quest annehmen" }).click();
  await expect(lesson.getByRole("button", { name: "Pausieren" })).toBeVisible();

  await page.goto("/vollbild/guitar/spiel/quests");
  const side = page.locator(".quest-side");
  await expect(side.getByRole("heading", { name: "Nebenwege" })).toBeVisible();
  await expect(side.getByRole("link", { name: title })).toBeVisible();
});

test("a third side lesson asks which one to pause", async ({ page }) => {
  await reachMap(page, `${HARBOR}/lead-drei-toene`);
  const lesson = page.getByRole("region", { name: "Lektion" });
  for (const id of ["lead-drei-toene", "11-pentatonik"]) {
    await page.goto(`${HARBOR}/${id}`);
    await lesson.getByRole("button", { name: "Als Quest annehmen" }).click();
    await expect(lesson.getByRole("button", { name: "Pausieren" })).toBeVisible();
  }
  await page.goto(`${HARBOR}/finger-daumen`);
  await lesson.getByRole("button", { name: "Als Quest annehmen" }).click();

  const dialog = page.getByRole("dialog", { name: "Welche Lektion pausierst du?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Abbrechen" }).click();
  await expect(dialog).toBeHidden();
  await expect(lesson.getByRole("button", { name: "Als Quest annehmen" })).toBeVisible();

  await lesson.getByRole("button", { name: "Als Quest annehmen" }).click();
  await dialog.getByRole("button", { name: "Solo aus drei Tönen", exact: true }).click();
  await expect(lesson.getByRole("button", { name: "Pausieren" })).toBeVisible();
  const state = await (await page.request.get(`${API}/state`)).json();
  expect([...state.chosenLessons].sort()).toEqual(["11-pentatonik", "finger-daumen"]);
});

test("a late lesson opens from the map", async ({ page }) => {
  await reachMap(page, `${HARBOR}/jam-frei`);
  const lesson = page.getByRole("region", { name: "Lektion" });
  await expect(lesson.getByRole("heading", { name: "Free Jam" })).toBeVisible();
  await lesson.getByRole("link", { name: "Lektion öffnen" }).click();
  await expect(page).toHaveURL(/\/bibliothek\/jam-frei$/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});

test("zooming and Ganze Karte keep the map on screen", async ({ page }) => {
  await reachMap(page);
  const map = page.getByRole("group", { name: "Lernkarte" });
  const full = await map.getAttribute("viewBox");
  await page.getByRole("button", { name: "Hineinzoomen" }).click();
  await page.getByRole("button", { name: "Hineinzoomen" }).click();
  const zoomed = await map.getAttribute("viewBox");
  expect(zoomed).not.toBe(full);
  await expect(map).toBeInViewport();
  await page.getByRole("button", { name: "Herauszoomen" }).click();
  await page.getByRole("button", { name: "Ganze Karte" }).click();
  await expect(map).toHaveAttribute("viewBox", full!);
  await expect(map).toBeInViewport();
});
