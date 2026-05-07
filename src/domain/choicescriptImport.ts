import type { AchievementSummary, AssetSummary, ChoiceCondition, ChoiceForgeProject, ChoiceOption, NodeType, SceneGraph, SceneSummary, StoryEdge, StoryNode, VariableSet, VariableSummary } from "./types";

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
  const nodes: StoryNode[] = [];
  const edges: StoryEdge[] = [];
  const pending: string[] = [];
  const pendingChoices: Array<{ nodeId: string; options: ImportedChoiceOption[] }> = [];
  const lines = content.split(/\r?\n/);
  let previous: StoryNode | null = null;

  const addNode = (node: Omit<StoryNode, "id" | "x" | "y" | "w"> & { w?: number }) => {
    const next: StoryNode = {
      ...node,
      id: `n${nodes.length + 1}`,
      x: 70 + (nodes.length % 4) * 380,
      y: 70 + Math.floor(nodes.length / 4) * 220,
      w: node.w ?? defaultImportedWidth(node.type),
    };
    if (previous && canAutoFlow(previous)) edges.push({ from: previous.id, to: next.id, kind: "flow" });
    nodes.push(next);
    previous = next;
    return next;
  };

  const flushPassage = () => {
    const body = pending.join("\n").trim();
    pending.length = 0;
    if (!body) return;
    addNode({ type: "passage", title: `${sceneName}_text_${nodes.length + 1}`, body });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const command = commandName(line);
    if (!command || /^\s+\S/.test(line)) {
      pending.push(line);
      continue;
    }

    if (command === "choice") {
      flushPassage();
      const block = collectIndentedBlock(lines, index);
      index += block.length - 1;
      const parsedChoice = parseChoiceBlock(block, nodes.length + 1);
      if (parsedChoice) {
        const choiceNode = addNode(parsedChoice.node);
        pendingChoices.push({ nodeId: choiceNode.id, options: parsedChoice.options });
      } else {
        addNode({ type: "passage", title: `${command}_block_${nodes.length + 1}`, body: block.join("\n").trimEnd(), w: 500 });
      }
      continue;
    }

    if (isComplexCommand(command)) {
      flushPassage();
      const block = collectIndentedBlock(lines, index);
      index += block.length - 1;
      addNode({ type: "passage", title: `${command}_block_${nodes.length + 1}`, body: block.join("\n").trimEnd(), w: 500 });
      continue;
    }

    const simpleNode = simpleCommandNode(command, line, nodes.length + 1);
    if (simpleNode) {
      flushPassage();
      addNode(simpleNode);
      continue;
    }

    pending.push(line);
  }

  flushPassage();

  if (!nodes.length) {
    addNode({ type: "passage", title: `${sceneName}_imported`, body: "" });
  }

  resolveImportedChoices(nodes, edges, pendingChoices);

  return { nodes, edges };
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

function simpleCommandNode(command: string, line: string, index: number): (Omit<StoryNode, "id" | "x" | "y" | "w"> & { w?: number }) | null {
  const value = commandValue(line, `*${command}`);
  if (command === "label") return { type: "label", title: `*label ${normalizeIdentifier(value || `label_${index}`)}` };
  if (command === "goto") return { type: "goto", title: `*goto ${normalizeIdentifier(value || "label")}` };
  if (command === "goto_scene") return { type: "goto_scene", title: `*goto_scene ${normalizeIdentifier(value || "scene")}`, target: normalizeIdentifier(value || "scene") };
  if (command === "gosub") return { type: "gosub", title: `*gosub ${value || "subroutine"}` };
  if (command === "ending") return { type: "ending", title: "*ending" };
  if (command === "finish") return { type: "finish", title: "*finish" };
  if (command === "save_checkpoint") return { type: "checkpoint", title: `*save_checkpoint ${normalizeIdentifier(value || `checkpoint_${index}`)}` };
  if (command === "page_break") return { type: "page_break", title: `*page_break ${value || "Continue"}` };
  if (command === "comment") return { type: "comment", title: "*comment", body: value || "Imported comment." };
  if (command === "input_text") return { type: "input_text", title: `*input_text ${normalizeIdentifier(value || "text")}`, inputVar: normalizeIdentifier(value || "text"), body: "Imported text input." };
  if (command === "input_number") {
    const [inputVar = "number", inputMin = "0", inputMax = "100"] = value.split(/\s+/);
    return { type: "input_number", title: `*input_number ${normalizeIdentifier(inputVar)}`, inputVar: normalizeIdentifier(inputVar), inputMin, inputMax, body: "Imported number input." };
  }
  if (command === "rand") {
    const [inputVar = "number", inputMin = "1", inputMax = "100"] = value.split(/\s+/);
    return { type: "rand", title: `*rand ${normalizeIdentifier(inputVar)}`, inputVar: normalizeIdentifier(inputVar), inputMin, inputMax };
  }
  if (command === "set") {
    const parsed = parseSet(value);
    return parsed ? { type: "passage", title: `set_${parsed.var}`, sets: [parsed] } : null;
  }
  return null;
}

function parseSet(value: string): VariableSet | null {
  const match = value.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(%[+-]|[=+-])\s+(.+)$/);
  if (!match) return null;
  const [, variable, op, setValue] = match;
  return { var: variable, op: op as VariableSet["op"], val: setValue.trim() };
}

function isComplexCommand(command: string): boolean {
  return ["fake_choice", "if", "elseif", "else", "selectable_if"].includes(command);
}

function canAutoFlow(node: StoryNode): boolean {
  if (["choice", "if", "ending", "finish", "goto", "goto_scene"].includes(node.type)) return false;
  if (node.body?.trim().match(/^\*(choice|fake_choice|if|elseif|else|selectable_if)\b/i)) return false;
  return true;
}

interface ImportedChoiceOption {
  text: string;
  targetLabel: string;
  cond?: ChoiceCondition | null;
  hideReuse?: boolean;
  sets: VariableSet[];
}

function collectIndentedBlock(lines: string[], startIndex: number): string[] {
  const block = [lines[startIndex]];
  let index = startIndex;
  while (index + 1 < lines.length && (/^\s/.test(lines[index + 1]) || !lines[index + 1].trim())) {
    index += 1;
    block.push(lines[index]);
  }
  return block;
}

function parseChoiceBlock(block: string[], index: number): { node: Omit<StoryNode, "id" | "x" | "y" | "w"> & { w?: number }; options: ImportedChoiceOption[] } | null {
  const options: ImportedChoiceOption[] = [];
  let current: ImportedChoiceOption | null = null;

  for (const line of block.slice(1)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const header = parseChoiceHeader(trimmed);
    if (header) {
      if (current) options.push(current);
      current = { ...header, targetLabel: "", sets: [] };
      continue;
    }
    if (!current) return null;
    if (trimmed.startsWith("*set ")) {
      const set = parseSet(commandValue(trimmed, "*set"));
      if (set) current.sets.push(set);
      continue;
    }
    if (trimmed.startsWith("*goto ")) {
      current.targetLabel = normalizeIdentifier(commandValue(trimmed, "*goto"));
      continue;
    }
    if (trimmed.startsWith("*comment")) continue;
    return null;
  }

  if (current) options.push(current);
  if (!options.length || options.some((option) => !option.targetLabel)) return null;
  return {
    node: {
      type: "choice",
      title: `imported_choice_${index}`,
      prompt: "Choose:",
      options: [],
      w: 360,
    },
    options,
  };
}

function parseChoiceHeader(trimmed: string): Pick<ImportedChoiceOption, "text" | "cond" | "hideReuse"> | null {
  if (trimmed.startsWith("#")) return { text: trimmed.replace(/^#+/, "").trim(), cond: null };

  const selectable = trimmed.match(/^\*selectable_if\s+\((.+)\)\s+#(.+)$/i);
  if (selectable) return { text: selectable[2].trim(), cond: { type: "selectable_if", expr: selectable[1].trim() } };

  const conditional = trimmed.match(/^\*if\s+\((.+)\)\s+#(.+)$/i);
  if (conditional) return { text: conditional[2].trim(), cond: { type: "if", expr: conditional[1].trim() } };

  const hideReuse = trimmed.match(/^\*hide_reuse\s+#(.+)$/i);
  if (hideReuse) return { text: hideReuse[1].trim(), cond: null, hideReuse: true };

  return null;
}

function resolveImportedChoices(nodes: StoryNode[], edges: StoryEdge[], pendingChoices: Array<{ nodeId: string; options: ImportedChoiceOption[] }>) {
  if (!pendingChoices.length) return;
  const labels = new Map(
    nodes
      .filter((node) => node.type === "label")
      .map((node) => [normalizeIdentifier(commandValue(node.title, "*label")), node.id]),
  );

  pendingChoices.forEach(({ nodeId, options }) => {
    const node = nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    const resolvedOptions = options
      .map((option): ChoiceOption | null => {
        const target = labels.get(option.targetLabel);
        if (!target) return null;
        return {
          text: option.text,
          to: target,
          cond: option.cond ?? null,
          hideReuse: option.hideReuse,
          sets: option.sets,
        };
      })
      .filter((option): option is ChoiceOption => Boolean(option));
    if (resolvedOptions.length !== options.length) {
      node.body = [
        "*comment ChoiceForge import: unresolved choice targets",
        ...(node.body ? [node.body] : []),
      ].join("\n");
      return;
    }
    node.options = resolvedOptions;
    resolvedOptions.forEach((option, index) => {
      edges.push({
        from: node.id,
        to: option.to,
        kind: "choice",
        label: `#${index + 1}${option.cond ? ` *${option.cond.type}` : ""}`,
      });
    });
  });
}

function defaultImportedWidth(type: NodeType): number {
  if (type === "passage") return 340;
  if (["goto_scene", "checkpoint", "page_break", "comment", "input_text", "input_number", "rand"].includes(type)) return 280;
  return 240;
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
