import { expect, test } from "@playwright/test";

for (const width of [768, 1092, 1280, 1536]) {
  test(`all toolbar actions fit within a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await page.addInitScript(() => localStorage.setItem("choiceforge.updateCheck.optout", "1"));
    await page.goto("/");
    const toolbar = page.locator(".top-bar");
    await expect(toolbar.getByRole("button", { name: /File/ })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: /Interface/ })).toBeVisible();
    const clipped = await toolbar.locator("button, select, input").evaluateAll((elements) =>
      elements.filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.left < 0 || rect.right > innerWidth || rect.bottom > innerHeight);
      }).map((element) => element.textContent?.trim() || element.getAttribute("aria-label")),
    );
    expect(clipped).toEqual([]);
    const header = await toolbar.boundingBox();
    const canvas = await page.locator(".canvas-wrap").boundingBox();
    expect(canvas).not.toBeNull();
    expect(canvas!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1);
    await toolbar.getByRole("button", { name: /File/ }).click({ trial: true });
    await toolbar.getByRole("button", { name: /Interface/ }).click({ trial: true });
    await page.locator(".bot-bar").getByText("Console", { exact: true }).click();
    await expect(page.locator(".app")).toHaveAttribute("data-bot-open", "true");
    const expandedCanvas = await page.locator(".canvas-wrap").boundingBox();
    expect(expandedCanvas!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1);
    expect(expandedCanvas!.height).toBeGreaterThan(200);
  });
}
