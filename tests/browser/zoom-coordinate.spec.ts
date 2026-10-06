import { expect, test, type Page } from "@playwright/test";

async function openApp(page: Page) {
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("choiceforge.updateCheck.optout", "1");
  });
  await page.goto("/");
  await expect(page.locator(".canvas-wrap")).toBeVisible();
  await expect(page.locator(".node[data-node-id]").first()).toBeVisible();
}

async function setUiZoom(page: Page, label: "Zoom 125%" | "Zoom 150%") {
  const toolbar = page.locator(".top-bar");
  await toolbar.getByRole("button", { name: "Interface" }).click();
  await page.getByRole("menuitem", { name: label }).click();
}

async function dragBy(page: Page, locator: ReturnType<Page["locator"]>, dx: number, dy: number) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const startX = box!.x + Math.min(24, box!.width / 2);
  const startY = box!.y + Math.min(24, box!.height / 2);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 6 });
  await page.mouse.up();
}

test.describe("global UI zoom canvas coordinates", () => {
  for (const [label, scale] of [["Zoom 125%", 1.25], ["Zoom 150%", 1.5]] as const) {
    test(`node drag follows the pointer at ${Math.round(scale * 100)}% UI zoom`, async ({ page }) => {
      await openApp(page);
      await setUiZoom(page, label);

      const node = page.locator(".node[data-node-id]").first();
      const before = await node.boundingBox();
      expect(before).not.toBeNull();

      await dragBy(page, node, 80, 40);

      const after = await node.boundingBox();
      expect(after).not.toBeNull();
      expect(after!.x - before!.x).toBeGreaterThan(72);
      expect(after!.x - before!.x).toBeLessThan(88);
      expect(after!.y - before!.y).toBeGreaterThan(32);
      expect(after!.y - before!.y).toBeLessThan(48);
    });
  }

  test("canvas pan follows the pointer at 150% UI zoom", async ({ page }) => {
    await openApp(page);
    await setUiZoom(page, "Zoom 150%");

    const inner = page.locator(".canvas-inner");
    const canvas = page.locator(".canvas-wrap");
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    const before = await inner.boundingBox();
    expect(before).not.toBeNull();

    const point = await canvas.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      for (let y = rect.top + 80; y < rect.bottom - 70; y += 20) {
        for (let x = rect.left + 20; x < rect.right - 100; x += 20) {
          const target = document.elementFromPoint(x, y);
          if (target && element.contains(target) && !target.closest(".node, .canvas-toolbar, .zoom-controls, .minimap, button, input, textarea, select")) return { x, y };
        }
      }
      throw new Error("No empty canvas area for pan");
    });
    const startX = point.x;
    const startY = point.y;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 90, startY + 60, { steps: 6 });
    await page.mouse.up();

    const after = await inner.boundingBox();
    expect(after).not.toBeNull();
    expect(after!.x - before!.x).toBeGreaterThan(82);
    expect(after!.x - before!.x).toBeLessThan(98);
    expect(after!.y - before!.y).toBeGreaterThan(52);
    expect(after!.y - before!.y).toBeLessThan(68);
  });

  test("node resize follows the pointer at 150% UI zoom", async ({ page }) => {
    await openApp(page);
    await setUiZoom(page, "Zoom 150%");
    await page.locator(".top-bar").getByRole("button", { name: "Interface" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Right panel" }).click();

    const node = page.locator(".node[data-node-id]").first();
    const nodeId = await node.getAttribute("data-node-id");
    expect(nodeId).not.toBeNull();
    const before = await node.boundingBox();
    expect(before).not.toBeNull();
    const beforeModelWidth = await node.evaluate((el) => Number.parseFloat((el as HTMLElement).style.width));
    expect(beforeModelWidth).toBeGreaterThan(0);

    const handle = node.locator(".node-resize");
    const handleBox = await handle.boundingBox();
    expect(handleBox).not.toBeNull();
    const startX = handleBox!.x + handleBox!.width / 2;
    const startY = handleBox!.y + handleBox!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(50);
    await page.mouse.move(startX + 90, startY, { steps: 8 });
    await page.mouse.up();

    const afterModelWidth = await node.evaluate((el) => Number.parseFloat((el as HTMLElement).style.width));
    expect(afterModelWidth - beforeModelWidth).toBeGreaterThan(55);
    expect(afterModelWidth - beforeModelWidth).toBeLessThan(85);
  });
});
