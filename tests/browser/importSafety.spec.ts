import { test, expect } from "@playwright/test";
import { openImportFiles } from "./menuHelpers";

test("reimporting a scene requires consent before replacing its source", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("choiceforge.updateCheck.optout", "1");
    Object.defineProperty(window, "showOpenFilePicker", { value: undefined });
  });
  await page.goto("/");
  const importText = async (text: string) => {
    const chooser = page.waitForEvent("filechooser");
    await openImportFiles(page);
    await (await chooser).setFiles({ name: "safe_chapter.txt", mimeType: "text/plain", buffer: Buffer.from(text) });
  };
  await importText("Original source.\n*ending\n");
  await expect(page.locator(".scene-edit[value='safe_chapter']")).toBeVisible();
  let confirmed = false;
  page.once("dialog", async (dialog) => {
    confirmed = true;
    await dialog.dismiss();
  });
  await importText("Replacement source.\n*ending\n");
  await expect.poll(() => confirmed).toBe(true);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("choiceforge.project.v2")!));
  expect(saved.sceneData.safe_chapter.sourceText).toBe("Original source.\n*ending\n");
});
