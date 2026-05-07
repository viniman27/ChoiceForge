import type { AchievementSummary, AssetSummary, ChoiceForgeProject, SceneGraph, SceneSummary, VariableSummary } from "./types";

export interface ChoiceScriptArchiveEntry {
  name: string;
  bytes: Uint8Array;
}

export function importChoiceScriptArchive(entries: ChoiceScriptArchiveEntry[]): ChoiceForgeProject {
  const decoder = new TextDecoder();
  const textFiles = entries
    .map((entry) => ({ ...entry, path: normalizePath(entry.name) }))
    .filter((entry) => entry.path.toLowerCase().endsWith(".txt"));
  const startup = textFiles.find((entry) => basename(entry.path).toLowerCase() === "startup.txt");
  if (!startup) throw new Error("startup.txt not found");

  const startupText = decoder.decode(startup.bytes);
  const startupData = parseStartup(startupText);
  const sceneTextFiles = textFiles.filter((entry) => !["startup.txt", "choicescript_stats.txt"].includes(basename(entry.path).toLowerCase()));
  const sceneFileMap = new Map(sceneTextFiles.map((entry) => [basename(entry.path).replace(/\.txt$/i, ""), decoder.decode(entry.bytes)]));
  const sceneNames = unique([
    ...startupData.sceneNames,
    ...sceneTextFiles.map((entry) => basename(entry.path).replace(/\.txt$/i, "")),
  ]);
  if (!sceneNames.length) throw new Error("no scene files found");

  const activeScene = sceneNames[0];
  const sceneData = Object.fromEntries(sceneNames.map((sceneName) => [sceneName, createImportedSceneGraph(sceneName, sceneFileMap.get(sceneName) ?? "")]));
  const scenes = createSceneSummaries(sceneNames, activeScene, sceneData);

  return {
    title: startupData.title,
    author: startupData.author,
    sceneTitle: activeScene,
    sceneSubtitle: `${activeScene}.txt - imported ChoiceScript`,
    scenes: [
      { id: "startup", name: "startup", words: countWords(startupText), nodes: 0, isStart: true },
      ...scenes,
      { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true },
    ],
    variables: startupData.variables,
    achievements: startupData.achievements,
    assets: importAssets(entries),
    nodes: sceneData[activeScene].nodes,
    edges: sceneData[activeScene].edges,
    sceneData,
    lints: [],
  };
}

function parseStartup(text: string) {
  const lines = text.split(/\r?\n/);
  const title = commandValue(lines.find((line) => commandName(line) === "title") ?? "", "*title") || "Imported ChoiceScript";
  const author = commandValue(lines.find((line) => commandName(line) === "author") ?? "", "*author") || "Unknown Author";
  const variables: VariableSummary[] = [];
  const achievements: AchievementSummary[] = [];
  const sceneNames: string[] = [];
  let inSceneList = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const command = commandName(line);

    if (command === "scene_list") {
      inSceneList = true;
      continue;
    }

    if (inSceneList) {
      if (/^\s+\S/.test(line) && !line.trim().startsWith("*")) {
        sceneNames.push(line.trim());
        continue;
      }
      if (line.trim().startsWith("*")) inSceneList = false;
    }

    if (command === "create") {
      const [, name = "variable", ...rest] = line.trim().split(/\s+/);
      const initial = rest.join(" ") || "0";
      variables.push({
        name,
        type: inferVariableType(initial),
        initial,
        desc: name,
        uses: 0,
        fairmath: inferVariableType(initial) === "number",
      });
    }

    if (command === "achievement") {
      const parts = line.trim().split(/\s+/);
      const id = parts[1] ?? `achievement_${achievements.length + 1}`;
      const visibility = parts[2] ?? "visible";
      const points = Number(parts[3] ?? "0");
      const titleText = parts.slice(4).join(" ") || id;
      const preDesc = lines[index + 1]?.trim() ?? titleText;
      const postDesc = lines[index + 2]?.trim() ?? preDesc;
      achievements.push({
        id,
        title: titleText,
        points: Number.isFinite(points) ? points : 0,
        desc: postDesc,
        preDesc,
        postDesc,
        hidden: visibility === "hidden",
      });
    }
  }

  return { title, author, variables, achievements, sceneNames: unique(sceneNames) };
}

function createImportedSceneGraph(sceneName: string, content: string): SceneGraph {
  return {
    nodes: [
      {
        id: "n1",
        type: "passage",
        x: 70,
        y: 70,
        w: 460,
        title: `${sceneName}_imported`,
        body: content.trimEnd(),
      },
    ],
    edges: [],
  };
}

function createSceneSummaries(sceneNames: string[], activeScene: string, sceneData: Record<string, SceneGraph>): SceneSummary[] {
  return sceneNames.map((sceneName, index) => ({
    id: `scene_${index + 1}`,
    name: sceneName,
    words: countWords(sceneData[sceneName]?.nodes.map((node) => node.body ?? "").join("\n") ?? ""),
    nodes: sceneData[sceneName]?.nodes.length ?? 0,
    current: sceneName === activeScene,
  }));
}

function importAssets(entries: ChoiceScriptArchiveEntry[]): AssetSummary[] {
  return entries
    .map((entry) => ({ ...entry, path: normalizePath(entry.name) }))
    .filter((entry) => entry.bytes.length > 0 && !entry.path.toLowerCase().endsWith(".txt") && basename(entry.path) !== "project.json")
    .map((entry, index) => {
      const fileName = basename(entry.path);
      return {
        id: normalizeIdentifier(fileName.replace(/\.[^.]+$/, "") || `asset_${index + 1}`),
        path: stripMygamePrefix(entry.path),
        kind: assetKind(fileName),
        desc: fileName,
        fileName,
        mimeType: mimeType(fileName),
        size: entry.bytes.length,
        dataUrl: `data:${mimeType(fileName)};base64,${bytesToBase64(entry.bytes)}`,
      };
    });
}

function commandName(line: string): string | null {
  const match = line.trim().match(/^\*([a-z_]+)/i);
  return match?.[1].toLowerCase() ?? null;
}

function commandValue(line: string, command: string): string {
  return line.trim().replace(command, "").trim();
}

function inferVariableType(value: string): VariableSummary["type"] {
  if (/^(true|false)$/i.test(value)) return "boolean";
  if (/^-?\d+(\.\d+)?$/.test(value)) return "number";
  return "string";
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function basename(path: string): string {
  return normalizePath(path).split("/").at(-1) ?? path;
}

function stripMygamePrefix(path: string): string {
  return normalizePath(path).replace(/^.*?mygame\//i, "");
}

function assetKind(fileName: string): AssetSummary["kind"] {
  const mime = mimeType(fileName);
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.includes("json") || mime.startsWith("text/")) return "data";
  return "other";
}

function mimeType(fileName: string): string {
  const ext = fileName.split(".").at(-1)?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "wav") return "audio/wav";
  if (ext === "json") return "application/json";
  if (ext === "csv") return "text/csv";
  return "application/octet-stream";
}

function bytesToBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = bytes[index + 1] ?? 0;
    const c = bytes[index + 2] ?? 0;
    output += chars[a >> 2];
    output += chars[((a & 3) << 4) | (b >> 4)];
    output += index + 1 < bytes.length ? chars[((b & 15) << 2) | (c >> 6)] : "=";
    output += index + 2 < bytes.length ? chars[c & 63] : "=";
  }
  return output;
}

function normalizeIdentifier(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "asset";
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
