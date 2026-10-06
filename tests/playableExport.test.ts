import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { buildOfficialPlaySrcdoc, buildPlayableExportFiles, createPlayableExportZip } from "../src/platform/playableExport.ts";
import type { ChoiceForgeProject } from "../src/domain/types.ts";

const pngDataUrl = "data:image/png;base64,iVBORw0KGgo=";

function syntheticPlayableProject(): ChoiceForgeProject {
  return {
    title: "Playable Export Test",
    author: "ChoiceForge Tests",
    sceneTitle: "first_scene",
    sceneSubtitle: "",
    scenes: [
      { id: "startup", name: "startup", words: 0, nodes: 0, isStart: true, special: true },
      { id: "first", name: "first_scene", words: 0, nodes: 0 },
      { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true },
    ],
    variables: [{ name: "score", type: "number", initial: "1", desc: "Score", uses: 0 }],
    achievements: [],
    assets: [{ id: "cover", path: "images/cover.png", kind: "image", desc: "Cover", fileName: "cover.png", mimeType: "image/png", dataUrl: pngDataUrl }],
    nodes: [],
    edges: [],
    sceneData: {
      first_scene: {
        nodes: [],
        edges: [],
        sourceText: [
          "Welcome.",
          "*image images/cover.png center Cover art",
          "*choice",
          "  #Continue",
          "    *set score + 4",
          "    *finish",
        ].join("\n"),
      },
    },
    statsSource: "*stat_chart\n  text score Score\n",
    lints: [],
  };
}

const runtimeFiles = {
  "persist.js": "window.persistLoaded=true;",
  "alertify.min.js": "window.alertify={};",
  "util.js": "window.utilLoaded=true;",
  "ui.js": "window.uiLoaded=true;",
  "scene.js": "window.sceneLoaded=true;",
  "navigator.js": "window.navigatorLoaded=true;",
  "style.css": "body{font-family:sans-serif;}",
  "alertify.css": ".alertify{}",
};

test("playable export files are self-contained and omit private ChoiceForge source data", () => {
  const files = buildPlayableExportFiles(syntheticPlayableProject(), runtimeFiles);
  const paths = files.map((file) => file.path).sort();

  assert.deepEqual(paths, [
    "README.txt",
    "assets/images/cover.png",
    "index.html",
    "play/alertify.css",
    "play/alertify.min.js",
    "play/navigator.js",
    "play/persist.js",
    "play/scene.js",
    "play/style.css",
    "play/ui.js",
    "play/util.js",
  ]);
  assert.ok(!paths.some((path) => path.startsWith("_choiceforge/") || path.endsWith("project.json")));

  const html = String(files.find((file) => file.path === "index.html")?.content ?? "");
  assert.match(html, /<script src="\.\/play\/scene\.js"><\/script>/);
  assert.match(html, /window\.allScenes=/);
  assert.match(html, /assets\/images\/cover\.png/);
  assert.doesNotMatch(html, /data:image\/png;base64/);

  const readme = String(files.find((file) => file.path === "README.txt")?.content ?? "");
  assert.match(readme, /Open index\.html/);
  assert.match(readme, /ChoiceScript License/);
  assert.match(readme, /commercial use.*terms/i);
  assert.doesNotMatch(readme, /redistribut/i);
});

test("playable export accepts legitimate imported asset paths under images and assets folders", () => {
  const project = syntheticPlayableProject();
  project.assets = [
    { id: "image", path: "images/cover.png", kind: "image", desc: "Cover", dataUrl: pngDataUrl },
    { id: "asset-prefixed", path: "assets/ui/button.png", kind: "image", desc: "Button", dataUrl: pngDataUrl },
  ];

  const paths = buildPlayableExportFiles(project, runtimeFiles).map((file) => file.path).sort();

  assert.ok(paths.includes("assets/images/cover.png"));
  assert.ok(paths.includes("assets/assets/ui/button.png"));
});

test("playable export rejects unsafe asset paths before creating files", () => {
  const unsafePaths = ["../secret.png", "/rooted.png", "C:/temp/cover.png", "file:///tmp/cover.png", "https://example.test/cover.png"];

  for (const path of unsafePaths) {
    const project = syntheticPlayableProject();
    project.assets = [{ id: "unsafe", path, kind: "image", desc: "Unsafe", dataUrl: pngDataUrl }];

    assert.throws(() => buildPlayableExportFiles(project, runtimeFiles), /Unsafe asset path/);
  }
});

test("playable export rejects invalid base64 asset data", () => {
  const project = syntheticPlayableProject();
  project.assets = [{ id: "bad", path: "images/bad.png", kind: "image", desc: "Bad", dataUrl: "data:image/png;base64,@@not-base64@@" }];

  assert.throws(() => buildPlayableExportFiles(project, runtimeFiles), /invalid base64/i);
});

test("playable export rejects duplicate output paths", () => {
  const project = syntheticPlayableProject();
  project.assets = [
    { id: "one", path: "images/cover.png", kind: "image", desc: "Cover", dataUrl: pngDataUrl },
    { id: "two", path: "images//cover.png", kind: "image", desc: "Cover duplicate", dataUrl: pngDataUrl },
  ];

  assert.throws(() => createPlayableExportZip(project, runtimeFiles), /Duplicate export path: assets\/images\/cover\.png/);
});

test("official play srcdoc keeps assets inline while ZIP export writes asset files", () => {
  const html = buildOfficialPlaySrcdoc(syntheticPlayableProject(), "", "http://127.0.0.1:5173/play");

  assert.match(html, /http:\/\/127\.0\.0\.1:5173\/play\/scene\.js/);
  assert.match(html, /data:image\/png;base64/);
  assert.doesNotMatch(html, /assets\/images\/cover\.png/);
});

test("playable export zip preserves runtime files and imported scene source without mutating source project", () => {
  const project = syntheticPlayableProject();
  const original = JSON.stringify(project);
  const zip = createPlayableExportZip(project, runtimeFiles);
  const entries = unzipSync(zip);

  assert.equal(JSON.stringify(project), original);
  assert.equal(strFromU8(entries["play/scene.js"]), runtimeFiles["scene.js"]);
  assert.equal(entries["assets/images/cover.png"][0], 137);
  assert.match(strFromU8(entries["index.html"]), /Welcome\./);
  assert.match(strFromU8(entries["README.txt"]), /local static server/i);
});
