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

async function dragResizeHandle(page: Page, side: "left" | "right", dx: number) {
  const handle = page.locator(`.resize-handle-${side}`);
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const startX = box!.x + box!.width / 2;
  const startY = box!.y + box!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY, { steps: 8 });
  await page.mouse.up();
}

async function panelWidth(page: Page, side: "left" | "right") {
  const box = await page.locator(side === "left" ? ".left-panel" : ".right-panel").boundingBox();
  expect(box).not.toBeNull();
  return box!.width;
}

test.describe("global UI zoom app panel coordinates", () => {
  for (const [label, scale] of [["Zoom 125%", 1.25], ["Zoom 150%", 1.5]] as const) {
    test(`left panel resize follows the pointer at ${Math.round(scale * 100)}% UI zoom`, async ({ page }) => {
      await openApp(page);
      await setUiZoom(page, label);

      const before = await panelWidth(page, "left");
      await dragResizeHandle(page, "left", 100);
      const after = await panelWidth(page, "left");

      expect(after - before).toBeGreaterThan(90);
      expect(after - before).toBeLessThan(110);
    });

    test(`right panel resize follows the pointer at ${Math.round(scale * 100)}% UI zoom`, async ({ page }) => {
      await openApp(page);
      await setUiZoom(page, label);

      const before = await panelWidth(page, "right");
      await dragResizeHandle(page, "right", -100);
      const after = await panelWidth(page, "right");

      expect(after - before).toBeGreaterThan(90);
      expect(after - before).toBeLessThan(110);
    });
  }

  test("focusing a node centers it in the actual canvas at 150% UI zoom", async ({ page }) => {
    await openApp(page);
    await setUiZoom(page, "Zoom 150%");

    await page.keyboard.press("Control+K");
    await page.locator(".cp-input").fill("label revisar");
    await page.locator(".cp-row").first().click();

    const canvas = await page.locator(".canvas-wrap").boundingBox();
    const node = await page.locator(".node.is-selected").boundingBox();
    expect(canvas).not.toBeNull();
    expect(node).not.toBeNull();
    const canvasCenter = { x: canvas!.x + canvas!.width / 2, y: canvas!.y + canvas!.height / 2 };
    const nodeCenter = { x: node!.x + node!.width / 2, y: node!.y + node!.height / 2 };

    expect(Math.abs(nodeCenter.x - canvasCenter.x)).toBeLessThan(12);
    expect(Math.abs(nodeCenter.y - canvasCenter.y)).toBeLessThan(130);
  });
});
