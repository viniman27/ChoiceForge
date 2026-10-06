import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { exportChoiceScriptZip, openImportFiles } from "./menuHelpers";

async function openApp(page: Page) {
  await page.setViewportSize({ width: 1536, height: 864 });
  await page.addInitScript(() => {
    localStorage.setItem("choiceforge.updateCheck.optout", "1");
    Object.defineProperty(window, "showOpenFilePicker", { value: undefined });
  });
  await page.goto("/");
}

async function importTextFiles(page: Page, files: Array<{ name: string; text: string }>) {
  page.on("dialog", (dialog) => dialog.accept());
  const chooserPromise = page.waitForEvent("filechooser");
  await openImportFiles(page);
  await (await chooserPromise).setFiles(files.map((file) => ({
    name: file.name,
    mimeType: "text/plain",
    buffer: Buffer.from(file.text),
  })));
}

async function exportedTextFiles(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await exportChoiceScriptZip(page);
  const download = await downloadPromise;
  const entries = unzipSync(await readFile((await download.path())!));
  return Object.fromEntries(Object.entries(entries).map(([path, bytes]) => [path, strFromU8(bytes)]));
}

test("imported scene_list startup with narrative is shown as one startup entry and exports source once", async ({ page }) => {
  const startupSource = "*title Browser Startup\n*author Test\n*scene_list\n  startup\nOpening in startup.\n*finish";
  await openApp(page);
  await importTextFiles(page, [{ name: "startup.txt", text: startupSource }]);

  await expect(page.locator(".scene-name code", { hasText: "startup.txt" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "open startup.txt source" })).toBeVisible();
  await expect(page.getByRole("button", { name: "open startup.txt graph" })).toBeVisible();

  await page.getByRole("button", { name: "open startup.txt source" }).click();
  await expect(page.locator(".generated-doc h1")).toHaveText("startup.txt");
  await expect(page.locator(".generated-doc")).toContainText("*scene_list");

  await page.getByRole("button", { name: "open startup.txt graph" }).click();
  await expect(page.locator(".canvas-wrap")).toBeVisible();
  await expect(page.locator(".source-preserved-banner")).toBeVisible();
  await expect(page.locator(".node").filter({ hasText: "Opening in startup." }).first()).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("choiceforge.project.v2")!));
  expect(saved.startupSource).toBe(startupSource);
  expect(saved.sceneData.startup.sourceText).toContain("Opening in startup.");

  const exported = await exportedTextFiles(page);
  expect(exported["mygame/startup.txt"]).toBe(`${startupSource}\n`);
  expect(Object.keys(exported).filter((path) => path === "mygame/startup.txt")).toHaveLength(1);
});

test("metadata-only startup remains a source entry and export preserves startup without narrative duplication", async ({ page }) => {
  const startupSource = "*title Metadata Only\n*author Test\n*scene_list\n  chapter_one";
  await openApp(page);
  await importTextFiles(page, [
    { name: "startup.txt", text: startupSource },
    { name: "chapter_one.txt", text: "Chapter one.\n*ending" },
  ]);

  await expect(page.locator(".scene-name code", { hasText: "startup.txt" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "open startup.txt source" })).toHaveCount(0);
  await expect(page.locator(".scene-edit[value='chapter_one']")).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("choiceforge.project.v2")!));
  expect(saved.startupSource).toBe(startupSource);
  expect(saved.sceneData.startup).toBeUndefined();

  const exported = await exportedTextFiles(page);
  expect(exported["mygame/startup.txt"]).toBe(`${startupSource}\n`);
  expect(exported["mygame/chapter_one.txt"]).toBe("Chapter one.\n*ending");
});
