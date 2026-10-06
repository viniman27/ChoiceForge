import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { unzipSync } from "fflate";
import { createPlayableExportZip, type PlayRuntimeFiles } from "../../src/platform/playableExport.ts";
import type { ChoiceForgeProject } from "../../src/domain/types.ts";

const onePixelPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

function exportedBrowserProject(): ChoiceForgeProject {
  return {
    title: "Browser Export Test",
    author: "ChoiceForge Tests",
    sceneTitle: "intro",
    sceneSubtitle: "",
    scenes: [
      { id: "startup", name: "startup", words: 0, nodes: 0, isStart: true, special: true },
      { id: "intro", name: "intro", words: 0, nodes: 0 },
      { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true },
    ],
    variables: [{ name: "score", type: "number", initial: "1", desc: "Score", uses: 0 }],
    achievements: [],
    assets: [{ id: "cover", path: "images/cover.png", kind: "image", desc: "Cover", fileName: "cover.png", mimeType: "image/png", dataUrl: onePixelPng }],
    nodes: [],
    edges: [],
    sceneData: {
      intro: {
        nodes: [],
        edges: [],
        sourceText: [
          "Welcome to the exported game.",
          "*image images/cover.png center Cover art",
          "*choice",
          "  #Continue to the finale",
          "    *set score + 4",
          "    Final passage reached.",
          "    *finish",
        ].join("\n"),
      },
    },
    statsSource: "*stat_chart\n  text score Score\n",
    lints: [],
  };
}

async function runtimeFiles(): Promise<PlayRuntimeFiles> {
  const root = resolve("public/play");
  const names = ["persist.js", "alertify.min.js", "util.js", "ui.js", "scene.js", "navigator.js", "style.css", "alertify.css"];
  return Object.fromEntries(await Promise.all(names.map(async (name) => [name, await readFile(join(root, name), "utf8")])));
}

async function writeZipToDir(zip: Uint8Array, dir: string) {
  const entries = unzipSync(zip);
  await Promise.all(Object.entries(entries).map(async ([name, bytes]) => {
    const file = join(dir, ...name.split("/"));
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, bytes);
  }));
}

test("exported playable ZIP runs offline in Chromium with choices, stats, and asset paths", async ({ page }) => {
  const dir = await mkdtemp(join(process.env.CHOICEFORGE_TEST_SCRATCH || resolve("test-results"), "choiceforge-playable-export-"));
  try {
    const zip = createPlayableExportZip(exportedBrowserProject(), await runtimeFiles());
    await writeZipToDir(zip, dir);

    await page.goto(pathToFileURL(join(dir, "index.html")).toString());
    await expect(page.locator("#container1 > #main > #text")).toContainText("Welcome to the exported game");
    await expect(page.locator("img[alt='Cover art']")).toHaveAttribute("src", /assets\/images\/cover\.png$/);

    await expect(page.getByText("Continue to the finale", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator("#container1 > #main > #text")).toContainText("Final passage reached");

    await page.locator("#container1 > #header").getByRole("button", { name: "Show Stats", exact: true }).click();
    await expect(page.locator("#container1 > #main > #text")).toContainText("Score");
    await expect(page.locator("#container1 > #main > #text")).toContainText("5");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
