import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { exportChoiceScriptZip, openImportFiles, openImportFolder } from "./menuHelpers";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("choiceforge.updateCheck.optout", "1");
    Object.defineProperty(window, "showOpenFilePicker", { value: undefined });
  });
  await page.goto("/");
});

test("File menu saves an editable project and exports a playable game", async ({ page }) => {
  await page.getByRole("button", { name: "File", exact: true }).click();
  const saved = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /^Save project Save the/ }).click();
  const project = JSON.parse(await readFile((await (await saved).path())!, "utf8"));
  expect(project.sceneData).toBeDefined();
  await page.getByRole("button", { name: "File", exact: true }).click();
  const playable = page.getByRole("menuitem", { name: /^Export playable game/ });
  await expect(playable).toBeEnabled();
  page.on("dialog", (dialog) => dialog.accept());
  const downloaded = page.waitForEvent("download");
  await playable.click();
  const entries = unzipSync(await readFile((await (await downloaded).path())!));
  expect(strFromU8(entries["index.html"])).toContain("window.allScenes");
  expect(entries["_choiceforge/project.json"]).toBeUndefined();
});

test("folder import opens a large scene and previews it without rebuilding manually", async ({ page }, testInfo) => {
  const dir = testInfo.outputPath("synthetic-project");
  await mkdir(dir, { recursive: true });
  const source = Array.from({ length: 5998 }, (_, i) => `Narrative ${i}.`).join("\n") + "\n*label end\n*ending\n";
  await writeFile(`${dir}/startup.txt`, "*title Folder test\n*author Test\n*scene_list\n  first\n  large\n");
  await writeFile(`${dir}/first.txt`, "First scene.\n*finish\n");
  await writeFile(`${dir}/large.txt`, source);
  await page.evaluate(() => Object.defineProperty(window, "showDirectoryPicker", { value: undefined }));
  page.on("dialog", (dialog) => dialog.accept());
  const chooser = page.waitForEvent("filechooser");
  await openImportFolder(page);
  await (await chooser).setFiles(dir);
  await page.locator(".scene-edit[value='large']").click();
  await expect(page.locator(".canvas-wrap")).toBeVisible();
  await expect(page.locator(".source-preserved-banner")).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await exportChoiceScriptZip(page);
  const entries = unzipSync(await readFile((await (await downloaded).path())!));
  expect(strFromU8(entries["mygame/large.txt"])).toBe(source);
});

test("Show graph preview displays deferred nodes without discarding source", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  const chooser = page.waitForEvent("filechooser");
  await openImportFiles(page);
  const source = "*label start\nPreserved narrative.\n*choice\n  #Go\n    *ending\n";
  await (await chooser).setFiles([
    { name: "startup.txt", mimeType: "text/plain", buffer: Buffer.from("*title Preview\n*author Test\n*scene_list\n  first\n  second\n") },
    { name: "first.txt", mimeType: "text/plain", buffer: Buffer.from("First.\n*finish\n") },
    { name: "second.txt", mimeType: "text/plain", buffer: Buffer.from(source) },
  ]);
  await page.locator(".scene-edit[value='second']").click();
  await expect(page.locator(".canvas-wrap")).toBeVisible();
  await expect(page.locator(".source-preserved-banner")).toBeVisible();
  expect(await page.locator(".node[data-node-id]").count()).toBeGreaterThan(1);
  const downloaded = page.waitForEvent("download");
  await exportChoiceScriptZip(page);
  const entries = unzipSync(await readFile((await (await downloaded).path())!));
  expect(strFromU8(entries["mygame/second.txt"])).toBe(source);
});
