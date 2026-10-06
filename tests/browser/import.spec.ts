import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
import { exportChoiceScriptZip, openImportFiles } from "./menuHelpers";

async function openApp(page: Page) {
  await page.setViewportSize({ width: 1536, height: 864 });
  await page.addInitScript(() => {
    localStorage.setItem("choiceforge.updateCheck.optout", "1");
    Object.defineProperty(window, "showOpenFilePicker", { value: undefined });
  });
  await page.goto("/");
}

async function importScene(page: Page, source: string) {
  const chooserPromise = page.waitForEvent("filechooser");
  await openImportFiles(page);
  await (await chooserPromise).setFiles({ name: "imported_chapter.txt", mimeType: "text/plain", buffer: Buffer.from(source) });
  await expect(page.locator(".scene-edit").filter({ visible: true }).last()).toBeVisible();
  await expect(page.locator(".scene-edit[value='imported_chapter']")).toBeVisible();
}

test("explicit conversion of an imported scene opens its visual graph", async ({ page }) => {
  await openApp(page);
  await importScene(page, "*label start\nA synthetic scene.\n*choice\n  #Stay\n    *ending\n  #Leave\n    *ending\n");
  await page.locator(".scene-edit[value='imported_chapter']").click();
  await expect(page.locator(".source-preserved-banner")).toBeVisible();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await expect(page.locator(".generated-doc h1")).toHaveText("imported_chapter.txt");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Convert to visual editing", exact: true }).click();
  await expect(page.locator(".generated-doc")).toHaveCount(0);
  await expect(page.locator(".canvas-wrap")).toBeVisible();
  expect(await page.locator(".node[data-node-id]").count()).toBeGreaterThan(1);
  await page.locator(".top-bar").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".source-preserved-banner")).toBeVisible();
});

test("cancelling visual conversion keeps the imported text open", async ({ page }) => {
  await openApp(page);
  await importScene(page, "A preserved scene.\n*ending\n");
  await page.locator(".scene-edit[value='imported_chapter']").click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  const convert = page.getByRole("button", { name: "Convert to visual editing", exact: true });
  await convert.click();
  await expect(page.locator(".generated-doc h1")).toHaveText("imported_chapter.txt");
  await expect(convert).toBeEnabled();
});

test("a deferred scene from a multi-file import converts through the worker", async ({ page }) => {
  await openApp(page);
  page.on("dialog", (dialog) => dialog.accept());
  const chooserPromise = page.waitForEvent("filechooser");
  await openImportFiles(page);
  await (await chooserPromise).setFiles([
    { name: "startup.txt", mimeType: "text/plain", buffer: Buffer.from("*title Synthetic project\n*author Test\n*scene_list\n  first\n  second\n") },
    { name: "first.txt", mimeType: "text/plain", buffer: Buffer.from("First scene.\n*finish\n") },
    { name: "second.txt", mimeType: "text/plain", buffer: Buffer.from("*label start\nSecond scene.\n*ending\n") },
  ]);
  await page.locator(".scene-edit[value='second']").click();
  await expect(page.locator(".source-preserved-banner")).toBeVisible();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await expect(page.locator(".generated-doc h1")).toHaveText("second.txt");
  await page.getByRole("button", { name: "Convert to visual editing", exact: true }).click();
  await expect(page.locator(".generated-doc")).toHaveCount(0);
  await expect(page.locator(".canvas-wrap")).toBeVisible();
  expect(await page.locator(".node[data-node-id]").count()).toBeGreaterThan(1);
});

test("a 6000-line imported scene exports its original source unchanged", async ({ page }) => {
  await openApp(page);
  const source = [...Array.from({ length: 5999 }, (_, i) => `Synthetic narrative line ${i + 1}.`), "*ending"].join("\n") + "\n";
  await importScene(page, source);
  page.on("dialog", (dialog) => dialog.accept());
  const downloadPromise = page.waitForEvent("download");
  await exportChoiceScriptZip(page);
  const download = await downloadPromise;
  const entries = unzipSync(await readFile((await download.path())!));
  expect(strFromU8(entries["mygame/imported_chapter.txt"])).toBe(source);
});

const PUBLIC_SAMPLE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "choicescript-public-sample");
const PUBLIC_SAMPLE_FILES = [
  "startup.txt",
  "animal.txt",
  "variables.txt",
  "gosub.txt",
  "ending.txt",
  "death.txt",
  "choicescript_stats.txt",
];

async function importPublicSample(page: Page) {
  const chooserPromise = page.waitForEvent("filechooser");
  await openImportFiles(page);
  await (await chooserPromise).setFiles(PUBLIC_SAMPLE_FILES.map((name) => join(PUBLIC_SAMPLE_DIR, name)));
}

test("real multi-scene import keeps every source while making scene graphs discoverable", async ({ page }) => {
  await openApp(page);
  page.on("dialog", (dialog) => dialog.accept());
  const startup = [
    "*title My First ChoiceScript Game",
    "*author Anonymous",
    "*scene_list",
    "  startup",
    "  animal",
    "*create leadership 50",
    "*create strength 50",
    "Welcome to your very first ChoiceScript game!",
    "*finish",
  ].join("\n");
  const animal = [
    "What kind of animal will you be?",
    "*choice",
    "  #Lion",
    "    *goto claws",
    "  #Tiger",
    "    *label claws",
    "    In that case, you'll have powerful claws and a mighty roar!",
    "    *finish",
    "  #Elephant",
    "    Well, elephants are interesting animals, too.",
    "    *finish",
  ].join("\n");
  const chooserPromise = page.waitForEvent("filechooser");
  await openImportFiles(page);
  await (await chooserPromise).setFiles([
    { name: "startup.txt", mimeType: "text/plain", buffer: Buffer.from(startup) },
    { name: "animal.txt", mimeType: "text/plain", buffer: Buffer.from(animal) },
    { name: "choicescript_stats.txt", mimeType: "text/plain", buffer: Buffer.from("*stat_chart\n  percent Leadership\n  opposed_pair Strength\n    Weakness\n") },
  ]);

  await expect(page.getByLabel("project title")).toHaveValue("My First ChoiceScript Game");
  await expect(page.locator(".scene-edit[value='animal']")).toBeVisible();
  await page.locator(".scene-edit[value='animal']").click();
  await expect(page.locator(".source-preserved-banner")).toBeVisible();
  expect(await page.locator(".node[data-node-id]").count()).toBeGreaterThan(1);
  const choiceNode = page.locator(".node").filter({ hasText: "What kind of animal" }).first();
  await expect(choiceNode).toBeVisible();
  await expect(choiceNode).toBeInViewport();
  await expect(page.locator(".node").filter({ hasText: "Lion" }).first()).toBeVisible();
  await expect(page.locator(".right-panel")).toContainText("What kind of animal");

  await page.getByRole("button", { name: "fit", exact: true }).click();
  await expect(page.locator(".zoom-controls span").first()).toHaveText(/^[1-4]?\d%$/);
  await expect(page.locator(".node").filter({ hasText: "What kind of animal" }).first()).toBeInViewport();
  await page.getByRole("button", { name: "Readable", exact: true }).click();
  await expect(page.locator(".zoom-controls span").first()).toHaveText("100%");
  await expect(choiceNode).toBeInViewport();

  await page.getByRole("button", { name: "Text", exact: true }).click();
  await expect(page.locator(".generated-doc h1")).toHaveText("animal.txt");
  await expect(page.locator(".generated-doc")).toContainText("*choice");

  const downloadPromise = page.waitForEvent("download");
  await exportChoiceScriptZip(page);
  const download = await downloadPromise;
  const entries = unzipSync(await readFile((await download.path())!));
  expect(strFromU8(entries["mygame/animal.txt"])).toBe(animal);
});


test("readable imported choice fits horizontally without minimap overlap at 125 percent UI zoom", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("choiceforge.updateCheck.optout", "1");
    localStorage.setItem("choiceforge.uiZoom", "1.25");
    Object.defineProperty(window, "showOpenFilePicker", { value: undefined });
  });
  await page.goto("/");
  page.on("dialog", (dialog) => dialog.accept());
  await importPublicSample(page);
  await page.locator(".scene-edit[value='animal']").click();
  await page.getByRole("button", { name: "Readable", exact: true }).click();

  const choiceNode = page.locator(".node").filter({ hasText: "What kind of animal will you be?" }).first();
  await expect(choiceNode).toBeVisible();
  await expect(page.locator(".zoom-controls span").first()).toHaveText(/^\d+%$/);

  const geometry = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>(".canvas-wrap")?.getBoundingClientRect();
    const node = [...document.querySelectorAll<HTMLElement>(".node")]
      .find((candidate) => candidate.textContent?.includes("What kind of animal will you be?"))
      ?.getBoundingClientRect();
    const option = [...document.querySelectorAll<HTMLElement>(".node-option")]
      .find((candidate) => candidate.textContent?.includes("Elephant"))
      ?.getBoundingClientRect();
    const minimap = document.querySelector<HTMLElement>(".minimap:not(.is-collapsed)")?.getBoundingClientRect() ?? null;
    const overlap = (a: DOMRect | null | undefined, b: DOMRect | null | undefined) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
    return {
      canvas: canvas && { left: canvas.left, right: canvas.right, width: canvas.width },
      node: node && { left: node.left, right: node.right, width: node.width },
      option: option && { left: option.left, right: option.right, top: option.top, bottom: option.bottom },
      minimap: minimap && { left: minimap.left, right: minimap.right, top: minimap.top, bottom: minimap.bottom },
      minimapOverlapsOption: overlap(minimap, option),
    };
  });

  expect(geometry.canvas).not.toBeNull();
  expect(geometry.node).not.toBeNull();
  expect(geometry.option).not.toBeNull();
  expect(geometry.node!.left).toBeGreaterThanOrEqual(geometry.canvas!.left - 1);
  expect(geometry.node!.right).toBeLessThanOrEqual(geometry.canvas!.right + 1);
  expect(geometry.minimapOverlapsOption).toBe(false);

  await page.screenshot({ path: test.info().outputPath("choiceforge-readability-final.png"), fullPage: true });
});
