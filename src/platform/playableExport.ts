import { zipSync, strToU8 } from "fflate";
import { generateSceneChoiceScript, generateStartupChoiceScript, generateStatsChoiceScript } from "../domain/choicescript.ts";
import type { ChoiceForgeProject } from "../domain/types.ts";

export interface CompiledPlayableScene {
  crc: number;
  lines: string[];
  labels: Record<string, number>;
}

export interface PlayableExportFile {
  path: string;
  encoding: "utf-8" | "binary";
  content: string | Uint8Array;
}

export type PlayRuntimeFiles = Record<string, string | Uint8Array>;

export interface PlayableHtmlOptions {
  playBaseUrl?: string;
  assetBaseUrl?: string;
  forcedScene?: string;
  inlineAssetDataUrls?: boolean;
}

const RUNTIME_FILE_NAMES = [
  "persist.js",
  "alertify.min.js",
  "util.js",
  "ui.js",
  "scene.js",
  "navigator.js",
  "style.css",
  "alertify.css",
] as const;

export function compilePlayableScene(text: string): CompiledPlayableScene {
  const lines = text.replace(/\r/g, "").split("\n");
  const labels: Record<string, number> = {};
  const labelRe = /^(\s*)\*(\w+)(.*)/;
  for (let i = 0; i < lines.length; i++) {
    const m = labelRe.exec(lines[i]);
    if (!m) continue;
    if (m[2].toLowerCase() === "label") {
      const name = m[3].trim().toLowerCase();
      if (name && !Object.prototype.hasOwnProperty.call(labels, name)) labels[name] = i;
    }
  }
  return { crc: 0, lines, labels };
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/<\//g, "<\\/");
}

function normalizeUrlPrefix(value: string): string {
  return value.replace(/\/+$/g, "");
}

function publicAssetPath(assetPath: string): string {
  return `assets/${sanitizeRelativePath(assetPath)}`;
}

function sanitizeRelativePath(path: string): string {
  const normalized = path.trim().replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length) throw new Error("Asset path is empty");
  if (normalized.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(normalized)) throw new Error(`Unsafe asset path: ${path}`);
  if (parts.some((part) => part === "." || part === "..")) throw new Error(`Unsafe asset path: ${path}`);
  return parts.join("/");
}

function decodeDataUrl(dataUrl: string): Uint8Array {
  const separator = dataUrl.indexOf(",");
  if (separator === -1) return strToU8(dataUrl);

  const header = dataUrl.slice(0, separator);
  const data = dataUrl.slice(separator + 1);
  if (!header.includes(";base64")) return strToU8(decodeURIComponent(data));

  const normalized = data.replace(/\s/g, "");
  if (normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || /=/.test(normalized.replace(/=+$/, ""))) {
    throw new Error("Asset data URL contains invalid base64 data");
  }
  try {
    return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
  } catch {
    throw new Error("Asset data URL contains invalid base64 data");
  }
}

function assertUniqueExportPath(path: string, seen: Set<string>) {
  if (seen.has(path)) throw new Error(`Duplicate export path: ${path}`);
  seen.add(path);
}

export function buildPlayableInitJs(project: ChoiceForgeProject, forcedScene = ""): string {
  const playableScenes = project.scenes.filter((s) => !s.isStart && !s.special);
  const firstScene = playableScenes[0]?.name ?? project.sceneTitle;

  const startupText = project.startupSource !== undefined
    ? generateStartupChoiceScript(project)
    : generateStartupChoiceScript({ ...project, sceneTitle: firstScene });

  const allScenes: Record<string, CompiledPlayableScene> = { startup: compilePlayableScene(startupText) };
  for (const scene of project.scenes) {
    if (!scene.isStart && !scene.special) {
      allScenes[scene.name] = compilePlayableScene(generateSceneChoiceScript(project, scene.name));
    }
  }
  allScenes.choicescript_stats = compilePlayableScene(generateStatsChoiceScript(project));

  const initialStats: Record<string, string | number | boolean> = {};
  for (const v of project.variables) {
    if (v.type === "number") {
      const n = Number(v.initial);
      initialStats[v.name] = isNaN(n) ? 0 : n;
    } else if (v.type === "boolean") {
      initialStats[v.name] = v.initial === "true";
    } else {
      initialStats[v.name] = v.initial;
    }
  }

  const achievements = project.achievements.map((a) => [
    a.id, !a.hidden, a.points, a.title, a.postDesc || a.desc, a.preDesc || a.desc,
  ]);

  const navInit = forcedScene
    ? `new SceneNavigator(${safeJson(["startup", ...playableScenes.map((s) => s.name)])})`
    : `new SceneNavigator(["startup"])`;
  const forcedOverride = forcedScene
    ? `window.nav.getStartupScene=function(){return ${safeJson(forcedScene)};};`
    : "";

  return `(function(){
window.storeName=null;window.version="1.0";
window.knownProducts=[];window.purchases={};
window.achievements=${safeJson(achievements)};
window.nav=${navInit};
${forcedOverride}
window.stats=${safeJson(initialStats)};
window.allScenes=${safeJson(allScenes)};
})();`;
}

export function buildPlayableAssetPatcherJs(project: ChoiceForgeProject, assetBaseUrl = "./assets", inlineDataUrls = false): string {
  const prefix = normalizeUrlPrefix(assetBaseUrl || "./assets");
  const map: Record<string, string> = {};
  for (const asset of project.assets ?? []) {
    if (!asset.path || !asset.dataUrl || (asset.kind !== "image" && asset.kind !== "audio")) continue;
    const exported = inlineDataUrls ? asset.dataUrl : `${prefix}/${sanitizeRelativePath(asset.path)}`;
    map[asset.path] = exported;
    if (asset.fileName) map[asset.fileName] = exported;
    const last = asset.path.split(/[\\/]/).pop();
    if (last) map[last] = exported;
  }
  if (!Object.keys(map).length) return "";
  return `(function(){var m=${safeJson(map)};function u(s){if(!s)return s;var k=s.split(/[\\/]/).pop()||s;return m[s]||m[k]||s;}var oldImage=window.printImage;window.printImage=function(source,alignment,alt,invert){return oldImage.call(this,u(source),alignment,alt,invert);};var oldSound=window.playSound;window.playSound=function(source){return oldSound.call(this,u(source));};})();`;
}

export function buildPlayableHtml(project: ChoiceForgeProject, options: PlayableHtmlOptions = {}): string {
  const play = normalizeUrlPrefix(options.playBaseUrl ?? "./play");
  const initJs = buildPlayableInitJs(project, options.forcedScene ?? "");
  const patcherJs = buildPlayableAssetPatcherJs(project, options.assetBaseUrl ?? "./assets", options.inlineAssetDataUrls ?? false);
  const title = project.title.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<script>window.version="UNKNOWN";</script>
<script src="${play}/persist.js"></script>
<script src="${play}/alertify.min.js"></script>
<script src="${play}/util.js"></script>
<link rel="stylesheet" href="${play}/style.css">
<style id="dynamic"></style>
<script src="${play}/ui.js"></script>
<script src="${play}/scene.js"></script>
<script src="${play}/navigator.js"></script>
<script>${initJs}</script>${patcherJs ? `\n<script>${patcherJs}</script>` : ""}
<link rel="stylesheet" href="${play}/alertify.css">
<script>window.storeName=null;var rootDir="./";</script>
</head>
<body>
<div id="container1" class="container">
  <div id="header">
    <div id="identity">
      <span id="title"></span>
      <span id="author"></span>
      <a id="email" href="#" style="display:none"></a>
      <a id="logout" href="#" style="display:none"></a>
    </div>
    <div id="headerLinks">
      <button id="statsButton" accesskey="q" onclick="showStats()">Show Stats</button>
      <button id="achievementsButton" style="display:none" onclick="showAchievements()">Achievements</button>
      <button id="restartButton" onclick="restartGame()">Restart</button>
      <button id="menuButton" accesskey="w" onclick="textOptionsMenu()">Menu</button>
      <button id="bugButton" style="display:none" onclick="reportBug()">Report Bug</button>
    </div>
  </div>
  <div id="main"><div id="text"></div></div>
  <div id="footer"><div id="back"></div></div>
</div>
</body>
</html>`;
}

export function buildOfficialPlaySrcdoc(project: ChoiceForgeProject, forcedScene: string, playBaseUrl: string): string {
  return buildPlayableHtml(project, { forcedScene, playBaseUrl, inlineAssetDataUrls: true });
}

function buildReadme(project: ChoiceForgeProject): string {
  return `ChoiceForge playable export: ${project.title}

Open index.html in a browser to play. If your browser blocks local files, run a local static server in this folder and open the served URL, for example:

  python -m http.server 8000

Then visit http://127.0.0.1:8000/.

This ZIP contains a self-contained playable HTML export generated by ChoiceForge, the game runtime files, and embedded scene data compiled from your current project. It intentionally does not include _choiceforge/project.json or editor-only project metadata.

Runtime/license notes:
- ChoiceScript runtime files are subject to the ChoiceScript License, Version 1.0: http://www.choiceofgames.com/LICENSE-1.0.txt
- alertify/persist runtime support files keep their original notices when present.
- Use, publication, and commercial use of ChoiceScript games are subject to the applicable ChoiceScript and Choice of Games terms. Review those terms before sharing, publishing, or selling this export.
`;
}

export function buildPlayableExportFiles(project: ChoiceForgeProject, runtimeFiles: PlayRuntimeFiles): PlayableExportFile[] {
  const seenPaths = new Set<string>();
  const files: PlayableExportFile[] = [
    { path: "index.html", encoding: "utf-8", content: buildPlayableHtml(project) },
    { path: "README.txt", encoding: "utf-8", content: buildReadme(project) },
  ];
  files.forEach((file) => assertUniqueExportPath(file.path, seenPaths));

  for (const name of RUNTIME_FILE_NAMES) {
    const content = runtimeFiles[name];
    if (content === undefined) throw new Error(`Missing ChoiceScript runtime file: ${name}`);
    const path = `play/${name}`;
    assertUniqueExportPath(path, seenPaths);
    files.push({ path, encoding: typeof content === "string" ? "utf-8" : "binary", content });
  }

  for (const asset of project.assets ?? []) {
    if (!asset.path || !asset.dataUrl) continue;
    const path = publicAssetPath(asset.path);
    assertUniqueExportPath(path, seenPaths);
    files.push({ path, encoding: "binary", content: decodeDataUrl(asset.dataUrl) });
  }

  return files;
}

export function createPlayableExportZip(project: ChoiceForgeProject, runtimeFiles: PlayRuntimeFiles): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const file of buildPlayableExportFiles(project, runtimeFiles)) {
    entries[file.path] = typeof file.content === "string" ? strToU8(file.content) : file.content;
  }
  return zipSync(entries, { level: 9 });
}

export async function loadPlayRuntimeFiles(baseUrl = "./play"): Promise<PlayRuntimeFiles> {
  const base = normalizeUrlPrefix(baseUrl);
  const entries = await Promise.all(RUNTIME_FILE_NAMES.map(async (name) => {
    const response = await fetch(`${base}/${name}`);
    if (!response.ok) throw new Error(`Failed to load ChoiceScript runtime file ${name}: ${response.status}`);
    if (name.endsWith(".css") || name.endsWith(".js")) return [name, await response.text()] as const;
    return [name, new Uint8Array(await response.arrayBuffer())] as const;
  }));
  return Object.fromEntries(entries);
}

export async function createPlayableExportZipFromPublicRuntime(project: ChoiceForgeProject, playBaseUrl = "./play"): Promise<Uint8Array> {
  return createPlayableExportZip(project, await loadPlayRuntimeFiles(playBaseUrl));
}
