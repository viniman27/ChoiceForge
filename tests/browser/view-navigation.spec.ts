import { expect, test, type Page } from "@playwright/test";

type TopLevelView = "editor" | "map" | "manuscript" | "dashboard";

async function openApp(page: Page) {
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("choiceforge.updateCheck.optout", "1");
    Object.defineProperty(window, "showOpenFilePicker", { value: undefined });
  });
  await page.goto("/");
  await expect(page.locator(".canvas-wrap")).toBeVisible();
}

async function switchToView(page: Page, view: TopLevelView) {
  if (view !== "editor") {
    await page.locator(".tab-toggle").getByRole("button", { name: labelForView(view), exact: true }).click();
  }
  await expectViewVisible(page, view);
}

async function expectViewVisible(page: Page, view: TopLevelView) {
  if (view === "editor") {
    await expect(page.locator(".canvas-wrap")).toBeVisible();
  } else if (view === "map") {
    await expect(page.locator(".scene-map-wrap")).toBeVisible();
  } else if (view === "manuscript") {
    await expect(page.locator(".ms-wrap")).toBeVisible();
  } else {
    await expect(page.locator(".dashboard-overlay")).toBeVisible();
  }
}

async function expectOverlayIsTopmost(page: Page, selector: string) {
  await expect(page.locator(selector)).toBeVisible();
  await expect.poll(async () => page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = Math.min(rect.right - 1, Math.max(rect.left + 1, rect.left + rect.width / 2));
    const y = Math.min(rect.bottom - 1, Math.max(rect.top + 1, rect.top + rect.height / 2));
    const top = document.elementFromPoint(x, y);
    return Boolean(top && (top === element || element.contains(top)));
  })).toBe(true);
}

function labelForView(view: TopLevelView) {
  if (view === "manuscript") return "prose";
  if (view === "dashboard") return "stats";
  return view;
}

for (const view of ["editor", "map", "manuscript", "dashboard"] as const) {
  test(`Validate opens as the exclusive central view from ${view} and returns`, async ({ page }) => {
    await openApp(page);
    await switchToView(page, view);

    await page.getByRole("button", { name: /Validate/ }).click();

    await expectOverlayIsTopmost(page, ".validation-view");
    await expect(page.locator(".official-play.validation-view").getByRole("heading", { name: "Validate for submission" })).toBeVisible();
    await expect(page.locator(".scene-map-wrap, .ms-wrap, .dashboard-overlay")).toHaveCount(0);

    await page.locator(".validation-view").getByRole("button", { name: "✕" }).click();
    await expect(page.locator(".validation-view")).toHaveCount(0);
    await expectViewVisible(page, view);
  });

  test(`Play opens as the exclusive central view from ${view} and returns`, async ({ page }) => {
    await openApp(page);
    await switchToView(page, view);

    await page.locator(".top-actions").getByRole("button", { name: /Play/ }).click();

    await expectOverlayIsTopmost(page, ".official-play:not(.validation-view)");
    await expect(page.locator(".official-play:not(.validation-view)").getByTitle("Reload game with latest changes")).toBeVisible();
    await expect(page.locator(".scene-map-wrap, .ms-wrap, .dashboard-overlay")).toHaveCount(0);

    await page.locator(".official-play:not(.validation-view)").getByRole("button", { name: "✕" }).click();
    await expect(page.locator(".official-play")).toHaveCount(0);
    await expectViewVisible(page, view);
  });
}
