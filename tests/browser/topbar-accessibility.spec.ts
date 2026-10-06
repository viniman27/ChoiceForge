import { expect, test, type Page } from "@playwright/test";

async function openApp(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: 760 });
  await page.addInitScript(() => {
    localStorage.setItem("choiceforge.updateCheck.optout", "1");
    Object.defineProperty(window, "showOpenFilePicker", { value: undefined });
  });
  await page.goto("/");
}

test("File menu is discoverable and keyboard accessible", async ({ page }) => {
  await openApp(page);
  const fileMenu = page.locator(".top-bar").getByRole("button", { name: "File" });
  await expect(fileMenu).toBeVisible();
  for (const label of ["File", "Interface"]) {
    const trigger = page.getByRole("button", { name: label, exact: true });
    await expect(trigger.locator(".cf-menu-chevron")).toBeVisible();
    await expect(trigger).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  }
  await fileMenu.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu", { name: "File" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /New project/i })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Open\/import files/i })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Export ChoiceScript ZIP/i })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: /New project/i })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "File" })).toHaveCount(0);
  await expect(fileMenu).toBeFocused();
});

test("global UI zoom supports 125/150/reset and persists without clipping", async ({ page }) => {
  await openApp(page, 1092);
  const toolbar = page.locator(".top-bar");
  await toolbar.getByRole("button", { name: "Interface" }).click();
  await page.getByRole("menuitem", { name: "Zoom 125%" }).click();
  await expect(page.locator("html")).toHaveCSS("--cf-ui-zoom", "1.25");
  await expect(page.locator("html")).toHaveAttribute("data-cf-ui-zoom", "125");
  await toolbar.getByRole("button", { name: "Interface" }).click();
  await page.getByRole("menuitem", { name: "Zoom 150%" }).click();
  await expect(page.locator("html")).toHaveCSS("--cf-ui-zoom", "1.5");

  const clipped = await toolbar.locator("button, select, input").evaluateAll((elements) =>
    elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.left < -0.5 || rect.right > innerWidth + 0.5 || rect.bottom > innerHeight + 0.5);
    }).map((element) => element.textContent?.trim() || element.getAttribute("aria-label")),
  );
  expect(clipped).toEqual([]);
  const footer = await page.locator(".bot-bar").boundingBox();
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(760);

  await toolbar.getByRole("button", { name: "Interface" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Right panel" }).click();
  await toolbar.getByRole("button", { name: "Interface" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Left panel" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("choiceforge.project.v2"))).not.toBeNull();
  const nodesBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("choiceforge.project.v2")!).nodes.length);
  const point = await page.locator(".canvas-wrap").evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    for (let y = rect.top + 100; y < rect.bottom - 50; y += 30) {
      for (let x = rect.left + 40; x < rect.right - 40; x += 30) {
        const target = document.elementFromPoint(x, y);
        if (target && canvas.contains(target) && !target.closest(".node, .canvas-toolbar, .zoom-controls, .minimap, button, input, textarea, select")) return { x, y };
      }
    }
    throw new Error("No empty canvas area available");
  });
  await page.mouse.dblclick(point.x, point.y);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("choiceforge.project.v2")!).nodes.length)).toBe(nodesBefore + 1);

  await page.reload();
  await expect(page.locator("html")).toHaveCSS("--cf-ui-zoom", "1.5");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+0" : "Control+0");
  await expect(page.locator("html")).toHaveCSS("--cf-ui-zoom", "1");
});

test("panel visibility controls hide and recover side panels", async ({ page }) => {
  await openApp(page, 768);
  const toolbar = page.locator(".top-bar");
  await toolbar.getByRole("button", { name: "Interface" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Left panel" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-cf-left-panel", "hidden");
  await expect(page.locator(".left-panel")).toBeHidden();
  await expect(toolbar.getByRole("button", { name: "Interface" })).toBeVisible();
  await toolbar.getByRole("button", { name: "Interface" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Left panel" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-cf-left-panel", "visible");
  await expect(page.locator(".left-panel")).toBeVisible();
});
