import type { ChoiceForgeProject, ChoiceCondition, ChoiceOption, FakeChoiceOption, LintIssue, SceneGraph, StoryEdge, StoryNode, VariableSet, VariableSummary } from "./types";

const TERMINAL_NODE_TYPES = new Set<StoryNode["type"]>(["ending", "finish", "goto", "goto_scene", "return", "restore_checkpoint"]);

export interface ChoiceForgeExportFile {
  path: string;
  encoding: "utf-8" | "binary";
  content: string | Uint8Array;
}

export interface ChoiceForgeExportPackage {
  format: "choiceforge.export";
  version: 1;
  project: {
    title: string;
    author: string;
  };
  files: ChoiceForgeExportFile[];
}

export function generateNodeChoiceScript(node: StoryNode, edges: StoryEdge[] = []): string {
  const lines: string[] = [];
  const nodeLabel = generatedNodeLabel(node.id);

  lines.push(`*label ${nodeLabel}`);
  if (node.type === "label") lines.push(`*label ${stripCommandPrefix(node.title, "*label")}`);
  if (node.type !== "comment" && node.type !== "temp" && node.type !== "params" && node.body?.trim()) lines.push(node.body);
  node.sets?.forEach((set) => lines.push(generateSet(set)));

  if (node.type === "choice") {
    if (node.prompt?.trim()) lines.push(node.prompt);
    lines.push("*choice");
    node.options?.forEach((option) => {
      lines.push(`  ${generateOptionHeader(option)}`);
      option.sets?.forEach((set) => lines.push(`    ${generateSet(set)}`));
      lines.push(`    *goto ${generatedNodeLabel(option.to)}`);
    });
  }

  if (node.type === "fake_choice") {
    if (node.prompt?.trim()) lines.push(node.prompt);
    lines.push("*fake_choice");
    node.fakeOptions?.forEach((option) => {
      lines.push(`  ${generateOptionHeader(option)}`);
      option.sets?.forEach((set) => lines.push(`    ${generateSet(set)}`));
    });
  }

  if (node.type === "if") {
    node.branches?.forEach((branch) => {
      lines.push(branch.expr ? `*${branch.kind} (${branch.expr})` : `*${branch.kind}`);
      branch.sets?.forEach((set) => lines.push(`  ${generateSet(set)}`));
      lines.push(`  *goto ${generatedNodeLabel(branch.to)}`);
    });
  }

  if (node.type === "gosub_scene" && node.target) {
    const label = node.body?.trim();
    lines.push(label ? `*gosub_scene ${node.target} ${label}` : `*gosub_scene ${node.target}`);
  }
  if (node.type === "image" && node.target?.trim()) {
    const alignment = node.inputMin?.trim() || "none";
    const alt = node.prompt?.trim();
    lines.push(alt ? `*image ${node.target} ${alignment} ${alt}` : `*image ${node.target} ${alignment}`);
  }
  if (node.type === "goto_scene" && node.target) lines.push(`*goto_scene ${node.target}`);
  if (node.type === "goto") lines.push(`*goto ${stripCommandPrefix(node.title, "*goto")}`);
  if (node.type === "gosub") lines.push(stripCommandPrefix(node.title, "*gosub").startsWith("*") ? node.title : `*gosub ${stripCommandPrefix(node.title, "*gosub")}`);
  if (node.type === "return") lines.push("*return");
  if (node.type === "ending") lines.push("*ending");
  if (node.type === "finish") lines.push("*finish");
  if (node.type === "checkpoint") lines.push(`*save_checkpoint ${stripCommandPrefix(node.title, "*save_checkpoint")}`);
  if (node.type === "restore_checkpoint") lines.push(`*restore_checkpoint ${stripCommandPrefix(node.title, "*restore_checkpoint")}`.trimEnd());
  if (node.type === "page_break") lines.push(`*page_break ${stripCommandPrefix(node.title, "*page_break") || "Continue"}`);
  if (node.type === "comment") {
    const comments = (node.body?.trim() || stripCommandPrefix(node.title, "*comment") || "ChoiceForge comment").split("\n");
    comments.forEach((comment) => lines.push(`*comment ${comment.trim()}`));
  }
  if (node.type === "input_text") lines.push(`*input_text ${node.inputVar ?? stripCommandPrefix(node.title, "*input_text")}`);
  if (node.type === "input_number") lines.push(`*input_number ${node.inputVar ?? stripCommandPrefix(node.title, "*input_number")} ${node.inputMin ?? "0"} ${node.inputMax ?? "100"}`);
  if (node.type === "rand") lines.push(`*rand ${node.inputVar ?? stripCommandPrefix(node.title, "*rand")} ${node.inputMin ?? "1"} ${node.inputMax ?? "100"}`);
  if (node.type === "temp") {
    const varName = node.inputVar ?? stripCommandPrefix(node.title, "*temp");
    const initial = node.body?.trim() ?? "0";
    lines.push(`*temp ${varName} ${initial}`);
  }
  if (node.type === "params") {
    const params = (node.body?.trim() ?? "").split(/\s+/).filter(Boolean);
    if (params.length) lines.push(`*params ${params.join(" ")}`);
  }

  const flowTarget = edges.find((edge) => edge.from === node.id && edge.kind === "flow")?.to;
  if (flowTarget && !TERMINAL_NODE_TYPES.has(node.type) && node.type !== "choice" && node.type !== "if") {
    lines.push(`*goto ${generatedNodeLabel(flowTarget)}`);
  }

  return lines.join("\n") || "# empty";
}

export function generateSceneChoiceScript(project: ChoiceForgeProject, sceneName = project.sceneTitle): string {
  const graph = getSceneGraph(project, sceneName);
  if (graph.sourceText !== undefined) return graph.sourceText.replace(/\s+$/g, "");
  const edges = mergeGraphEdges(graph.edges, deriveNodeEdges(graph.nodes));
  const incoming = new Map(graph.nodes.map((node) => [node.id, 0]));
  edges.forEach((edge) => incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1));

  return [...graph.nodes]
    .sort((a, b) => {
      if (a.id === "n1") return -1;
      if (b.id === "n1") return 1;
      return a.y - b.y || a.x - b.x;
    })
    .map((node) => {
      const section = generateNodeChoiceScript(node, graph.edges);
      const hasIncoming = (incoming.get(node.id) ?? 0) > 0 || node.id === "n1";
      return `${hasIncoming ? "" : "*comment ChoiceForge: orphan visual node\n"}${section}`;
    })
    .join("\n\n");
}

export function generateStartupChoiceScript(project: ChoiceForgeProject): string {
  if (project.startupSource !== undefined) return `${project.startupSource.replace(/\s+$/g, "")}\n`;
  const lines: string[] = [
    `*title ${project.title}`,
    `*author ${project.author}`,
    "*scene_list",
  ];

  project.scenes
    .filter((scene) => !scene.special && scene.name !== "startup")
    .forEach((scene) => lines.push(`  ${scene.name}`));

  if (project.variables.length) lines.push("");
  project.variables.forEach((variable) => lines.push(`*create ${variable.name} ${variable.initial}`));

  if (project.achievements.length) lines.push("");
  project.achievements.forEach((achievement) => {
    const visibility = achievement.hidden ? "hidden" : "visible";
    lines.push(`*achievement ${achievement.id} ${visibility} ${achievement.points} ${achievement.title}`);
    lines.push(`  ${achievement.preDesc || achievement.desc}`);
    lines.push(`  ${achievement.postDesc || achievement.desc}`);
  });

  lines.push("");
  lines.push(`*goto_scene ${project.sceneTitle}`);

  return `${lines.join("\n")}\n`;
}

export function generateStatsChoiceScript(project: ChoiceForgeProject): string {
  if (project.statsSource !== undefined) return `${project.statsSource.replace(/\s+$/g, "")}\n`;
  const lines: string[] = [];

  if (!project.variables.length && !project.achievements.length) {
    lines.push("*comment ChoiceForge: no stats configured yet");
    lines.push("No stats configured yet.");
    return `${lines.join("\n")}\n`;
  }

  const statVars = project.variables.filter((v) => v.showInStats !== false);
  if (statVars.length) {
    lines.push("*stat_chart");
    statVars.forEach((variable) => {
      if (variable.opposedLow !== undefined && variable.type === "number") {
        lines.push(`  opposed_pair ${variable.name}`);
        lines.push(`    ${formatStatsLabel(variable.desc || variable.name)}`);
        lines.push(`    ${formatStatsLabel(variable.opposedLow || variable.name)}`);
      } else {
        const chartType = variable.type === "number" && variable.fairmath ? "percent" : "text";
        lines.push(`  ${chartType} ${variable.name} ${formatStatsLabel(variable.desc || variable.name)}`);
      }
    });
  }

  if (project.achievements.length) {
    if (lines.length) lines.push("");
    lines.push("*achievements");
  }

  return `${lines.join("\n")}\n`;
}

export function generateProjectJson(project: ChoiceForgeProject): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const separator = dataUrl.indexOf(",");
  if (separator === -1) return new TextEncoder().encode(dataUrl);

  const header = dataUrl.slice(0, separator);
  const data = dataUrl.slice(separator + 1);

  if (!header.includes(";base64")) {
    return new TextEncoder().encode(decodeURIComponent(data));
  }

  const normalized = data.replace(/\s/g, "");
  const outputLength = Math.floor((normalized.length * 3) / 4) - (normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0);
  const bytes = new Uint8Array(Math.max(0, outputLength));
  let buffer = 0;
  let bits = 0;
  let index = 0;

  for (const char of normalized) {
    if (char === "=") break;
    const value = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index] = (buffer >> bits) & 0xff;
      index += 1;
    }
  }

  return bytes.slice(0, index);
}

export function createExportPackage(project: ChoiceForgeProject): ChoiceForgeExportPackage {
  const sceneFiles = project.scenes
    .filter((scene) => !scene.special && !scene.isStart && scene.name !== "startup")
    .map((scene) => ({
      path: `mygame/${scene.name}.txt`,
      encoding: "utf-8" as const,
      content: `${generateSceneChoiceScript(project, scene.name)}\n`,
    }));
  const assetFiles = (project.assets ?? [])
    .filter((asset) => asset.dataUrl)
    .map((asset) => ({
      path: `mygame/${asset.path}`,
      encoding: "binary" as const,
      content: dataUrlToBytes(asset.dataUrl ?? ""),
    }));

  return {
    format: "choiceforge.export",
    version: 1,
    project: {
      title: project.title,
      author: project.author,
    },
    files: [
      {
        path: "_choiceforge/project.json",
        encoding: "utf-8",
        content: generateProjectJson(project),
      },
      {
        path: "mygame/startup.txt",
        encoding: "utf-8",
        content: generateStartupChoiceScript(project),
      },
      {
        path: "mygame/choicescript_stats.txt",
        encoding: "utf-8",
        content: generateStatsChoiceScript(project),
      },
      ...sceneFiles,
      ...assetFiles,
    ],
  };
}

export function lintProject(project: ChoiceForgeProject): LintIssue[] {
  const issues: LintIssue[] = [];
  const sceneNames = project.scenes
    .filter((scene) => !scene.isStart && !scene.special)
    .map((scene) => scene.name);

  lintProjectMetadata(project, issues);
  if (project.startupSource !== undefined) {
    lintPreservedStartupSource(project, project.startupSource, issues);
  }
  if (project.statsSource !== undefined) {
    lintPreservedStatsSource(project, project.statsSource, issues);
  }
  sceneNames.forEach((sceneName) => {
    const graph = getSceneGraph(project, sceneName);
    if (graph.sourceText !== undefined) {
      lintPreservedScriptSource(project, graph.sourceText, sceneName, "scene exports preserved ChoiceScript source", issues);
      return;
    }
    lintSceneGraph(project, graph, sceneName, issues);
  });

  lintSceneReachability(project, sceneNames, issues);

  issues.push({ level: "info", msg: "indent configured: 2 spaces; encoding UTF-8", scene: null });
  return issues;
}

function lintSceneReachability(project: ChoiceForgeProject, sceneNames: string[], issues: LintIssue[]) {
  if (sceneNames.length < 2) return;
  const sceneSet = new Set(sceneNames);
  const outgoing = new Map<string, Set<string>>(sceneNames.map((name) => [name, new Set()]));
  const addRef = (from: string, to: string) => {
    if (sceneSet.has(to) && from !== to) outgoing.get(from)?.add(to);
  };
  sceneNames.forEach((sceneName, index) => {
    const graph = getSceneGraph(project, sceneName);
    graph.nodes.forEach((node) => {
      if ((node.type === "goto_scene" || node.type === "gosub_scene") && node.target?.trim()) {
        addRef(sceneName, node.target.trim());
      }
    });
    const hasFinish = graph.nodes.some((node) => node.type === "finish");
    if (hasFinish && index + 1 < sceneNames.length) {
      addRef(sceneName, sceneNames[index + 1]!);
    }
    if (graph.sourceText) {
      let sourceHasFinish = false;
      graph.sourceText.split(/\r?\n/).forEach((line) => {
        const cmd = sourceCommand(line.trim());
        if (cmd === "goto_scene" || cmd === "gosub_scene") {
          const target = normalizeSourceIdentifier(sourceCommandValue(line.trim(), `*${cmd}`).split(/\s+/)[0] ?? "");
          if (target) addRef(sceneName, target);
        }
        if (cmd === "finish") sourceHasFinish = true;
      });
      if (sourceHasFinish && index + 1 < sceneNames.length) {
        addRef(sceneName, sceneNames[index + 1]!);
      }
    }
  });
  const reachable = new Set<string>();
  const visit = (name: string) => {
    if (!sceneSet.has(name) || reachable.has(name)) return;
    reachable.add(name);
    outgoing.get(name)?.forEach(visit);
  };
  visit(sceneNames[0]!);
  if (project.startupSource) {
    project.startupSource.split(/\r?\n/).forEach((line) => {
      const cmd = sourceCommand(line.trim());
      if (cmd === "goto_scene" || cmd === "gosub_scene") {
        const target = normalizeSourceIdentifier(sourceCommandValue(line.trim(), `*${cmd}`).split(/\s+/)[0] ?? "");
        if (target) visit(target);
      }
    });
  }
  sceneNames.forEach((name) => {
    if (!reachable.has(name)) {
      issues.push({ level: "warning", msg: `scene "${name}" has no incoming connections from other scenes`, scene: null });
    }
  });
}

function lintProjectMetadata(project: ChoiceForgeProject, issues: LintIssue[]) {
  if (!project.title.trim()) issues.push({ level: "error", msg: "project has an empty title", scene: null });
  if (!project.author.trim()) issues.push({ level: "error", msg: "project has an empty author", scene: null });
  const generatedExportPaths = generatedChoiceScriptExportPaths(project);

  findDuplicates(project.scenes.map((scene) => scene.name))
    .forEach((name) => issues.push({ level: "error", msg: `duplicate scene name: ${name}`, scene: null }));
  findDuplicates(project.variables.map((variable) => variable.name))
    .forEach((name) => issues.push({ level: "error", msg: `duplicate variable name: ${name}`, scene: null }));
  findDuplicates(project.achievements.map((achievement) => achievement.id))
    .forEach((id) => issues.push({ level: "error", msg: `duplicate achievement id: ${id}`, scene: null }));
  findDuplicates((project.assets ?? []).map((asset) => asset.id))
    .forEach((id) => issues.push({ level: "warning", msg: `duplicate asset id: ${id}`, scene: null }));
  findDuplicates((project.assets ?? []).map((asset) => asset.path))
    .forEach((path) => issues.push({ level: "warning", msg: `duplicate asset path: ${path}`, scene: null }));
  findDuplicates((project.assets ?? []).filter((asset) => asset.dataUrl).map((asset) => asset.path))
    .forEach((path) => issues.push({ level: "error", msg: `duplicate exported asset path: ${path}`, scene: null }));

  project.scenes.forEach((scene) => {
    if (!scene.name.trim()) issues.push({ level: "error", msg: "scene has an empty name", scene: null });
    if (scene.name.trim() && !isValidChoiceScriptIdentifier(scene.name)) {
      issues.push({ level: "error", msg: `scene has an invalid identifier: ${scene.name}`, scene: null });
    }
  });
  project.variables.forEach((variable) => {
    if (!variable.name.trim()) issues.push({ level: "error", msg: "variable has an empty name", scene: null });
    if (variable.name.trim() && !isValidChoiceScriptIdentifier(variable.name)) {
      issues.push({ level: "error", msg: `variable has an invalid identifier: ${variable.name}`, scene: null });
    }
    if (!variable.initial.trim()) issues.push({ level: "error", msg: `variable "${variable.name}" has an empty initial value`, scene: null });
    if (variable.initial.trim() && !isValidVariableInitial(variable)) {
      issues.push({ level: "error", msg: `variable "${variable.name}" has an invalid ${variable.type} initial value: ${variable.initial}`, scene: null });
    }
  });
  project.achievements.forEach((achievement) => {
    if (!achievement.id.trim()) issues.push({ level: "error", msg: "achievement has an empty id", scene: null });
    if (achievement.id.trim() && !isValidChoiceScriptIdentifier(achievement.id)) {
      issues.push({ level: "error", msg: `achievement has an invalid identifier: ${achievement.id}`, scene: null });
    }
    if (!achievement.title.trim()) {
      issues.push({ level: "error", msg: `achievement "${achievement.id}" has an empty title`, scene: null });
    }
    if (!(achievement.preDesc || achievement.desc).trim()) {
      issues.push({ level: "error", msg: `achievement "${achievement.id}" has an empty locked description`, scene: null });
    }
    if (!(achievement.postDesc || achievement.desc).trim()) {
      issues.push({ level: "error", msg: `achievement "${achievement.id}" has an empty unlocked description`, scene: null });
    }
    if (!Number.isInteger(achievement.points) || achievement.points < 0) {
      issues.push({ level: "error", msg: `achievement "${achievement.id}" has invalid points`, scene: null });
    }
  });
  (project.assets ?? []).forEach((asset) => {
    if (!asset.path.trim()) issues.push({ level: "warning", msg: `asset "${asset.id}" has an empty path`, scene: null });
    if (asset.path.trim() && !isSafeAssetPath(asset.path)) {
      issues.push({ level: "error", msg: `asset "${asset.id}" has an unsafe export path: ${asset.path}`, scene: null });
    }
    if (asset.dataUrl && generatedExportPaths.has(`mygame/${asset.path}`)) {
      issues.push({ level: "error", msg: `asset "${asset.id}" export path conflicts with a generated file: ${asset.path}`, scene: null });
    }
    const dataUrlIssue = asset.dataUrl ? assetDataUrlIssue(asset.dataUrl) : null;
    if (dataUrlIssue) {
      issues.push({ level: "error", msg: `asset "${asset.id}" has ${dataUrlIssue}`, scene: null });
    }
  });
}

function isValidVariableInitial(variable: ChoiceForgeProject["variables"][number]): boolean {
  const initial = variable.initial.trim();
  if (variable.type === "number") return /^-?\d+(\.\d+)?$/.test(initial);
  if (variable.type === "boolean") return /^(true|false)$/i.test(initial);
  return true;
}

function isValidChoiceScriptIdentifier(value: string): boolean {
  return /^[a-z_][a-z0-9_]*$/.test(value);
}

function isSafeAssetPath(path: string): boolean {
  const normalized = path.trim();
  if (!normalized || normalized.includes("\\")) return false;
  if (normalized.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(normalized)) return false;
  return normalized.split("/").every((part) => part && part !== "." && part !== "..");
}

function generatedChoiceScriptExportPaths(project: ChoiceForgeProject): Set<string> {
  return new Set([
    "mygame/startup.txt",
    "mygame/choicescript_stats.txt",
    ...project.scenes
      .filter((scene) => !scene.special && !scene.isStart && scene.name !== "startup")
      .map((scene) => `mygame/${scene.name}.txt`),
  ]);
}

function assetDataUrlIssue(dataUrl: string): string | null {
  if (!dataUrl.startsWith("data:")) return null;
  const separator = dataUrl.indexOf(",");
  if (separator === -1) return "a malformed data URL";
  const header = dataUrl.slice(0, separator);
  const data = dataUrl.slice(separator + 1);
  if (header.includes(";base64")) {
    const normalized = data.replace(/\s/g, "");
    if (normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || /=/.test(normalized.replace(/=+$/, ""))) {
      return "invalid base64 data";
    }
    return null;
  }
  try {
    decodeURIComponent(data);
  } catch {
    return "invalid URL-encoded data";
  }
  return null;
}

function lintSceneGraph(project: ChoiceForgeProject, graph: SceneGraph, sceneName: string, issues: LintIssue[]) {
  const edges = mergeGraphEdges(graph.edges, deriveNodeEdges(graph.nodes));
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const labels = new Set([
    ...graph.nodes.map((node) => generatedNodeLabel(node.id)),
    ...graph.nodes.filter((node) => node.type === "label").map((node) => stripCommandPrefix(node.title, "*label")),
  ]);
  const generatedLabels = new Set(graph.nodes.map((node) => generatedNodeLabel(node.id)));
  const humanLabels = graph.nodes
    .filter((node) => node.type === "label")
    .map((node) => ({ node, label: stripCommandPrefix(node.title, "*label") }));
  const tempVarNames = new Set(
    graph.nodes.filter((node) => node.type === "temp" && node.inputVar?.trim()).map((node) => node.inputVar!.trim()),
  );
  const paramsVarNames = new Set(
    graph.nodes.filter((node) => node.type === "params").flatMap((node) => (node.body?.trim() ?? "").split(/\s+/).filter(Boolean)),
  );
  const variables = new Set([...project.variables.map((variable) => variable.name), ...tempVarNames, ...paramsVarNames]);
  const variableTypes = new Map(project.variables.map((variable) => [variable.name, variable]));
  const achievements = new Set(project.achievements.map((achievement) => achievement.id));
  const scenes = new Set(project.scenes.filter((scene) => !scene.isStart && !scene.special).map((scene) => scene.name));
  const hasGosub = graph.nodes.some((node) => node.type === "gosub");
  const checkpointSlots = new Set(graph.nodes.filter((node) => node.type === "checkpoint").map((node) => checkpointSlot(node.title, "*save_checkpoint")));
  const outgoing = new Map(graph.nodes.map((node) => [node.id, 0]));
  const incoming = new Map(graph.nodes.map((node) => [node.id, 0]));
  const flowOutgoing = new Map(graph.nodes.map((node) => [node.id, 0]));

  lintNodeIds(graph.nodes, issues, sceneName);
  edges.forEach((edge) => {
    if (!nodeIds.has(edge.from)) {
      issues.push({ level: "error", msg: `edge starts from a missing node: ${edge.from}`, scene: sceneName });
    }
    if (!nodeIds.has(edge.to)) {
      issues.push({ level: "error", msg: `edge points to a missing node: ${edge.to}`, scene: sceneName });
    }
    if (edge.kind === "flow") flowOutgoing.set(edge.from, (flowOutgoing.get(edge.from) ?? 0) + 1);
    outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  });

  lintLabels(humanLabels, generatedLabels, issues, sceneName);

  graph.nodes.forEach((node) => {
    if (node.id !== "n1" && (incoming.get(node.id) ?? 0) === 0) {
      issues.push({ level: "warning", msg: `node "${node.title}" has no incoming connection`, scene: sceneName, node: node.id });
    }

    if (!TERMINAL_NODE_TYPES.has(node.type) && node.type !== "choice" && node.type !== "if" && (outgoing.get(node.id) ?? 0) === 0) {
      issues.push({ level: "info", msg: `node "${node.title}" has no visual output`, scene: sceneName, node: node.id });
    }

    node.sets?.forEach((set) => lintSet(set, variables, variableTypes, issues, sceneName, node.id));

    extractVariableReferences(node.body ?? "").forEach((name) => {
      if (!variables.has(name)) issues.push({ level: "warning", msg: `text uses an undeclared variable: ${name}`, scene: sceneName, node: node.id });
    });

    lintAchievementCommands(node.body ?? "", achievements, issues, sceneName, node.id);

    if (node.type === "choice") lintChoiceNode(node, nodeIds, variables, variableTypes, issues, sceneName);
    if (node.type === "fake_choice") lintFakeChoiceNode(node, variables, variableTypes, issues, sceneName);
    if (node.type === "if") lintIfNode(node, nodeIds, variables, variableTypes, issues, sceneName);

    if (node.type === "goto_scene") {
      const target = node.target?.trim() ?? "";
      if (!target) {
        issues.push({ level: "error", msg: "*goto_scene needs a scene target", scene: sceneName, node: node.id });
      } else if (!isValidChoiceScriptIdentifier(target)) {
        issues.push({ level: "error", msg: `*goto_scene has an invalid scene identifier: ${target}`, scene: sceneName, node: node.id });
      } else if (!scenes.has(target)) {
        issues.push({ level: "error", msg: `*goto_scene points to a missing scene: ${target}`, scene: sceneName, node: node.id });
      }
    }

    if (node.type === "gosub_scene") {
      const target = node.target?.trim() ?? "";
      if (!target) {
        issues.push({ level: "error", msg: "*gosub_scene needs a scene target", scene: sceneName, node: node.id });
      } else if (!isValidChoiceScriptIdentifier(target)) {
        issues.push({ level: "error", msg: `*gosub_scene has an invalid scene identifier: ${target}`, scene: sceneName, node: node.id });
      } else if (!scenes.has(target)) {
        issues.push({ level: "error", msg: `*gosub_scene points to a missing scene: ${target}`, scene: sceneName, node: node.id });
      }
      if ((flowOutgoing.get(node.id) ?? 0) === 0) {
        issues.push({ level: "warning", msg: "*gosub_scene has no flow continuation for the return", scene: sceneName, node: node.id });
      }
    }

    if (node.type === "passage" && node.body) {
      const wc = countBodyWords(node.body);
      if (wc > 600) issues.push({ level: "warning", msg: `passage "${node.title}" is very long (${wc} words)`, scene: sceneName, node: node.id });
    }

    if (node.type === "image" && !node.target?.trim()) {
      issues.push({ level: "warning", msg: "*image needs a filename", scene: sceneName, node: node.id });
    }

    if (node.type === "goto") {
      const label = stripCommandPrefix(node.title, "*goto");
      if (!label) {
        issues.push({ level: "error", msg: "*goto needs a label target", scene: sceneName, node: node.id });
      } else if (!isValidChoiceScriptIdentifier(label)) {
        issues.push({ level: "error", msg: `*goto has an invalid label identifier: ${label}`, scene: sceneName, node: node.id });
      } else if (!labels.has(label)) {
        issues.push({ level: "error", msg: `*goto points to a missing label: ${label}`, scene: sceneName, node: node.id });
      }
    }

    if (node.type === "gosub") {
      const label = gosubTarget(node.title);
      if (!label) {
        issues.push({ level: "error", msg: "*gosub needs a label target", scene: sceneName, node: node.id });
      } else if (!isValidChoiceScriptIdentifier(label)) {
        issues.push({ level: "error", msg: `*gosub has an invalid label identifier: ${label}`, scene: sceneName, node: node.id });
      } else if (!labels.has(label)) {
        issues.push({ level: "error", msg: `*gosub points to a missing label: ${label}`, scene: sceneName, node: node.id });
      }
      if ((flowOutgoing.get(node.id) ?? 0) === 0) {
        issues.push({ level: "warning", msg: "*gosub has no flow continuation for *return", scene: sceneName, node: node.id });
      }
    }

    if (node.type === "return" && !hasGosub) {
      issues.push({ level: "warning", msg: "*return appears in a scene with no *gosub nodes", scene: sceneName, node: node.id });
    }

    if (node.type === "page_break" && !stripCommandPrefix(node.title, "*page_break")) {
      issues.push({ level: "error", msg: "*page_break needs a button label", scene: sceneName, node: node.id });
    }

    if (node.type === "checkpoint" && !checkpointSlot(node.title, "*save_checkpoint")) {
      issues.push({ level: "error", msg: "*save_checkpoint needs a checkpoint name", scene: sceneName, node: node.id });
    }

    if (node.type === "restore_checkpoint") {
      const slot = checkpointSlot(node.title, "*restore_checkpoint");
      if (!checkpointSlots.has(slot)) {
        const label = slot ? ` "${slot}"` : "";
        issues.push({ level: "warning", msg: `*restore_checkpoint${label} has no matching *save_checkpoint in this scene`, scene: sceneName, node: node.id });
      }
    }

    if (node.type === "input_text" || node.type === "input_number" || node.type === "rand") {
      lintInputNode(node, variables, variableTypes, issues, sceneName);
    }

    if (node.type === "temp") {
      const varName = (node.inputVar ?? stripCommandPrefix(node.title, "*temp")).trim();
      if (!varName || !isValidChoiceScriptIdentifier(varName)) {
        issues.push({ level: "error", msg: `*temp has an invalid variable identifier: ${varName || "(empty)"}`, scene: sceneName, node: node.id });
      } else if (project.variables.some((variable) => variable.name === varName)) {
        issues.push({ level: "warning", msg: `*temp shadows a global variable: ${varName}`, scene: sceneName, node: node.id });
      }
      if (!node.body?.trim()) {
        issues.push({ level: "warning", msg: `*temp "${varName}" has no initial value (defaults to 0)`, scene: sceneName, node: node.id });
      }
    }

    if (node.type === "params") {
      const rawParams = (node.body?.trim() ?? "").split(/\s+/).filter(Boolean);
      if (!rawParams.length) {
        issues.push({ level: "error", msg: "*params has no parameter names", scene: sceneName, node: node.id });
      }
      rawParams.forEach((param) => {
        if (!isValidChoiceScriptIdentifier(param)) {
          issues.push({ level: "error", msg: `*params has an invalid parameter identifier: ${param}`, scene: sceneName, node: node.id });
        } else if (project.variables.some((variable) => variable.name === param)) {
          issues.push({ level: "warning", msg: `*params shadows a global variable: ${param}`, scene: sceneName, node: node.id });
        }
      });
      const duplicateParams = findDuplicates(rawParams);
      duplicateParams.forEach((param) => {
        issues.push({ level: "error", msg: `*params has a duplicate parameter name: ${param}`, scene: sceneName, node: node.id });
      });
    }
  });
}

function lintPreservedScriptSource(project: ChoiceForgeProject, sourceText: string, sceneName: string, infoMessage: string, issues: LintIssue[]) {
  const scenes = new Set(project.scenes.filter((scene) => !scene.isStart && !scene.special).map((scene) => scene.name));
  const variableNames = new Set(project.variables.map((variable) => variable.name));
  const variableTypes = new Map(project.variables.map((variable) => [variable.name, variable]));
  const localVariables = new Map<string, number>();
  const achievements = new Set(project.achievements.map((achievement) => achievement.id));
  const labels = new Map<string, number>();
  const referencedLabels: Array<{ label: string; line: number }> = [];
  const savedCheckpoints = new Set<string>();
  const restoredCheckpoints: Array<{ slot: string; line: number }> = [];
  const returnLines: number[] = [];
  let hasGosub = false;
  const lines = sourceText.split(/\r?\n/);

  issues.push({ level: "info", msg: infoMessage, scene: sceneName, line: 1 });

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    const command = sourceCommand(trimmed);
    if (command === "label") {
      const label = sourceCommandValue(trimmed, "*label").split(/\s+/)[0] ?? "";
      lintPreservedLabelLine(labels, label, sceneName, lineNumber, issues);
    }
    if (command === "goto") {
      const label = sourceCommandValue(trimmed, "*goto").split(/\s+/)[0] ?? "";
      lintPreservedJumpLine(referencedLabels, "*goto", label, sceneName, lineNumber, issues);
    }
    if (command === "gosub") {
      hasGosub = true;
      const label = sourceCommandValue(trimmed, "*gosub").split(/\s+/)[0] ?? "";
      lintPreservedJumpLine(referencedLabels, "*gosub", label, sceneName, lineNumber, issues);
    }
    if (command === "return") {
      returnLines.push(lineNumber);
    }
    if (command === "goto_scene") {
      const rawTarget = sourceCommandValue(trimmed, "*goto_scene").split(/\s+/)[0] ?? "";
      const target = normalizeSourceIdentifier(rawTarget);
      if (!rawTarget) issues.push({ level: "error", msg: "*goto_scene needs a scene target", scene: sceneName, line: lineNumber });
      else if (!isValidChoiceScriptIdentifier(rawTarget)) issues.push({ level: "error", msg: `*goto_scene has an invalid scene identifier: ${rawTarget}`, scene: sceneName, line: lineNumber });
      else if (!scenes.has(target)) issues.push({ level: "error", msg: `*goto_scene points to a missing scene: ${target}`, scene: sceneName, line: lineNumber });
    }
    if (command === "gosub_scene") {
      const rawTarget = sourceCommandValue(trimmed, "*gosub_scene").split(/\s+/)[0] ?? "";
      const target = normalizeSourceIdentifier(rawTarget);
      if (!rawTarget) issues.push({ level: "error", msg: "*gosub_scene needs a scene target", scene: sceneName, line: lineNumber });
      else if (!isValidChoiceScriptIdentifier(rawTarget)) issues.push({ level: "error", msg: `*gosub_scene has an invalid scene identifier: ${rawTarget}`, scene: sceneName, line: lineNumber });
      else if (!scenes.has(target)) issues.push({ level: "error", msg: `*gosub_scene points to a missing scene: ${target}`, scene: sceneName, line: lineNumber });
    }
    if (command === "image") {
      const filename = sourceCommandValue(trimmed, "*image").split(/\s+/)[0] ?? "";
      if (!filename) issues.push({ level: "warning", msg: "*image needs a filename", scene: sceneName, line: lineNumber });
    }
    if (command === "save_checkpoint") {
      const slot = sourceCommandValue(trimmed, "*save_checkpoint");
      if (!slot) issues.push({ level: "error", msg: "*save_checkpoint needs a checkpoint name", scene: sceneName, line: lineNumber });
      savedCheckpoints.add(slot);
    }
    if (command === "restore_checkpoint") {
      restoredCheckpoints.push({ slot: sourceCommandValue(trimmed, "*restore_checkpoint"), line: lineNumber });
    }
    if (command === "page_break" && !sourceCommandValue(trimmed, "*page_break")) {
      issues.push({ level: "error", msg: "*page_break needs a button label", scene: sceneName, line: lineNumber });
    }
    if (command === "set") {
      lintPreservedSetLine(variableNames, variableTypes, trimmed, sceneName, lineNumber, issues);
    }
    if (command === "temp") {
      lintPreservedTempLine(variableNames, localVariables, trimmed, sceneName, lineNumber, issues);
    }
    if (command === "params") {
      lintPreservedParamsLine(variableNames, localVariables, trimmed, sceneName, lineNumber, issues);
    }
    if (command === "input_text" || command === "input_number" || command === "rand") {
      lintPreservedInputCommand(variableNames, variableTypes, command, trimmed, sceneName, lineNumber, issues);
    }
    if (command === "if" || command === "elseif" || command === "selectable_if") {
      lintPreservedConditionLine(command, sourceConditionExpression(trimmed, command), variableNames, issues, sceneName, lineNumber);
    }
    const achievementMatch = trimmed.match(/^\*achieve(?:\s+(.+?))?\s*$/i);
    if (achievementMatch) {
      const rawAchievement = (achievementMatch[1] ?? "").trim();
      const achievement = normalizeSourceIdentifier(rawAchievement);
      if (!rawAchievement) {
        issues.push({ level: "error", msg: "*achieve needs an achievement id", scene: sceneName, line: lineNumber });
      } else if (!isValidChoiceScriptIdentifier(rawAchievement)) {
        issues.push({ level: "error", msg: `*achieve has an invalid achievement identifier: ${rawAchievement}`, scene: sceneName, line: lineNumber });
      } else if (!achievements.has(achievement)) {
        issues.push({ level: "error", msg: `*achieve uses an undeclared achievement: ${achievement}`, scene: sceneName, line: lineNumber });
      }
    }
  });

  referencedLabels.forEach(({ label, line }) => {
    if (!labels.has(label)) issues.push({ level: "error", msg: `jump points to a missing label: ${label}`, scene: sceneName, line });
  });
  restoredCheckpoints.forEach(({ slot, line }) => {
    if (!savedCheckpoints.has(slot)) {
      const label = slot ? ` "${slot}"` : "";
      issues.push({ level: "warning", msg: `*restore_checkpoint${label} has no matching *save_checkpoint in this scene`, scene: sceneName, line });
    }
  });
  if (!hasGosub) {
    returnLines.forEach((line) => {
      issues.push({ level: "warning", msg: "*return appears in a scene with no *gosub commands", scene: sceneName, line });
    });
  }
}

function lintPreservedLabelLine(labels: Map<string, number>, label: string, sceneName: string, lineNumber: number, issues: LintIssue[]) {
  if (!label) {
    issues.push({ level: "error", msg: "*label needs a name", scene: sceneName, line: lineNumber });
    return;
  }
  if (!isValidChoiceScriptIdentifier(label)) {
    issues.push({ level: "error", msg: `*label has an invalid identifier: ${label}`, scene: sceneName, line: lineNumber });
    return;
  }
  if (labels.has(label)) {
    issues.push({ level: "error", msg: `duplicate *label in source: ${label}`, scene: sceneName, line: lineNumber });
    return;
  }
  labels.set(label, lineNumber);
}

function lintPreservedJumpLine(
  referencedLabels: Array<{ label: string; line: number }>,
  command: "*goto" | "*gosub",
  label: string,
  sceneName: string,
  lineNumber: number,
  issues: LintIssue[],
) {
  if (!label) {
    issues.push({ level: "error", msg: `${command} needs a label target`, scene: sceneName, line: lineNumber });
    return;
  }
  if (!isValidChoiceScriptIdentifier(label)) {
    issues.push({ level: "error", msg: `${command} has an invalid label identifier: ${label}`, scene: sceneName, line: lineNumber });
    return;
  }
  referencedLabels.push({ label, line: lineNumber });
}

function lintPreservedTempLine(
  variables: Set<string>,
  localVariables: Map<string, number>,
  line: string,
  sceneName: string,
  lineNumber: number,
  issues: LintIssue[],
) {
  const [, rawName = "", ...rest] = line.split(/\s+/);
  const normalizedName = normalizeSourceIdentifier(rawName);

  if (!rawName || !isValidChoiceScriptIdentifier(rawName)) {
    issues.push({ level: "error", msg: `*temp has an invalid variable identifier: ${rawName || "(empty)"}`, scene: sceneName, line: lineNumber });
    return;
  }
  if (!rest.join(" ").trim()) {
    issues.push({ level: "error", msg: `*temp has an empty initial value: ${normalizedName}`, scene: sceneName, line: lineNumber });
  }
  if (localVariables.has(normalizedName)) {
    issues.push({ level: "warning", msg: `*temp repeats local variable: ${normalizedName}`, scene: sceneName, line: lineNumber });
  }
  localVariables.set(normalizedName, lineNumber);
  variables.add(normalizedName);
}

function lintPreservedParamsLine(
  variables: Set<string>,
  localVariables: Map<string, number>,
  line: string,
  sceneName: string,
  lineNumber: number,
  issues: LintIssue[],
) {
  const params = sourceCommandValue(line, "*params").split(/\s+/).filter(Boolean);
  if (!params.length) {
    issues.push({ level: "error", msg: "*params needs at least one parameter", scene: sceneName, line: lineNumber });
    return;
  }
  params.forEach((rawName) => {
    const normalizedName = normalizeSourceIdentifier(rawName);
    if (!isValidChoiceScriptIdentifier(rawName)) {
      issues.push({ level: "error", msg: `*params has an invalid parameter identifier: ${rawName}`, scene: sceneName, line: lineNumber });
      return;
    }
    if (localVariables.has(normalizedName)) {
      issues.push({ level: "warning", msg: `*params repeats local variable: ${normalizedName}`, scene: sceneName, line: lineNumber });
    }
    localVariables.set(normalizedName, lineNumber);
    variables.add(normalizedName);
  });
}

function lintPreservedSetLine(
  variables: Set<string>,
  variableTypes: Map<string, ChoiceForgeProject["variables"][number]>,
  line: string,
  sceneName: string,
  lineNumber: number,
  issues: LintIssue[],
) {
  const [rawVariable = "", maybeOp = "", ...rest] = sourceCommandValue(line, "*set").split(/\s+/);
  const variable = normalizeSourceIdentifier(rawVariable);
  if (!rawVariable || !isValidChoiceScriptIdentifier(rawVariable)) {
    issues.push({ level: "error", msg: `*set has an invalid variable identifier: ${rawVariable || "(empty)"}`, scene: sceneName, line: lineNumber });
    return;
  }
  if (!maybeOp) {
    issues.push({ level: "error", msg: `*set has an empty value: ${variable}`, scene: sceneName, line: lineNumber });
    return;
  }
  const isExplicitOperator = ["=", "+", "-", "%+", "%-"].includes(maybeOp);
  if (isExplicitOperator && !rest.join(" ").trim()) {
    issues.push({ level: "error", msg: `*set has an empty value: ${variable}`, scene: sceneName, line: lineNumber });
  }
  if (!variables.has(variable)) {
    issues.push({ level: "warning", msg: `*set uses an undeclared variable: ${variable}`, scene: sceneName, line: lineNumber });
    return;
  }
  const globalVariable = variableTypes.get(variable);
  if (globalVariable && globalVariable.type !== "number" && isExplicitOperator && maybeOp !== "=") {
    issues.push({ level: "error", msg: `*set ${variable} uses an invalid operator for ${globalVariable.type}: ${maybeOp}`, scene: sceneName, line: lineNumber });
  }
  if (globalVariable?.type === "number" && (maybeOp === "%+" || maybeOp === "%-") && !globalVariable.fairmath) {
    issues.push({ level: "warning", msg: `*set ${variable} uses fairmath without a percent stat format`, scene: sceneName, line: lineNumber });
  }
}

function lintPreservedInputCommand(
  variables: Set<string>,
  variableTypes: Map<string, ChoiceForgeProject["variables"][number]>,
  command: string,
  line: string,
  sceneName: string,
  lineNumber: number,
  issues: LintIssue[],
) {
  const [rawVariable = "", rawMin = "", rawMax = ""] = sourceCommandValue(line, `*${command}`).split(/\s+/);
  const variable = normalizeSourceIdentifier(rawVariable);
  if (!rawVariable || !isValidChoiceScriptIdentifier(rawVariable)) {
    issues.push({ level: "error", msg: `*${command} has an invalid variable identifier: ${rawVariable || "(empty)"}`, scene: sceneName, line: lineNumber });
    return;
  }
  if (!variables.has(variable)) {
    issues.push({ level: "warning", msg: `*${command} uses an undeclared variable: ${variable}`, scene: sceneName, line: lineNumber });
  }
  const globalVariable = variableTypes.get(variable);
  if (command === "input_text" && globalVariable && globalVariable.type !== "string") {
    issues.push({ level: "error", msg: `*input_text requires a string variable: ${variable}`, scene: sceneName, line: lineNumber });
  }
  if ((command === "input_number" || command === "rand") && globalVariable && globalVariable.type !== "number") {
    issues.push({ level: "error", msg: `*${command} requires a number variable: ${variable}`, scene: sceneName, line: lineNumber });
  }
  if (command !== "input_number" && command !== "rand") return;
  const min = Number(rawMin);
  const max = Number(rawMax);
  if (!rawMin || !rawMax || !Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    issues.push({ level: "error", msg: `*${command} has invalid bounds: ${rawMin || "(empty)"} ${rawMax || "(empty)"}`, scene: sceneName, line: lineNumber });
  }
}

function lintPreservedConditionLine(
  command: string,
  expression: string,
  variables: Set<string>,
  issues: LintIssue[],
  sceneName: string,
  lineNumber: number,
) {
  if (!expression.trim()) {
    issues.push({ level: "error", msg: `*${command} condition is empty`, scene: sceneName, line: lineNumber });
    return;
  }
  lintSourceExpression(expression, variables, issues, sceneName, lineNumber);
}

function lintPreservedStartupSource(project: ChoiceForgeProject, sourceText: string, issues: LintIssue[]) {
  lintPreservedScriptSource(project, sourceText, "startup", "startup exports preserved ChoiceScript source", issues);

  const playableScenes = new Set(project.scenes.filter((scene) => !scene.isStart && !scene.special).map((scene) => scene.name));
  const listedScenes = new Map<string, number>();
  const declaredVariables = new Map<string, number>();
  const declaredAchievements = new Map<string, number>();
  const projectVariables = new Map(project.variables.map((variable) => [variable.name, variable]));
  const projectAchievements = new Set(project.achievements.map((achievement) => achievement.id));
  let foundSceneList = false;
  let inSceneList = false;

  sourceText.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    const command = sourceCommand(trimmed);

    if (command === "create") {
      lintPreservedCreateLine(projectVariables, declaredVariables, trimmed, lineNumber, issues);
    }
    if (command === "achievement") {
      lintPreservedAchievementLine(projectAchievements, declaredAchievements, trimmed, lineNumber, issues);
    }
    if (command === "title" && !sourceCommandValue(trimmed, "*title")) {
      issues.push({ level: "error", msg: "startup.txt has an empty *title", scene: "startup", line: lineNumber });
    }
    if (command === "author" && !sourceCommandValue(trimmed, "*author")) {
      issues.push({ level: "error", msg: "startup.txt has an empty *author", scene: "startup", line: lineNumber });
    }

    if (command === "scene_list") {
      foundSceneList = true;
      inSceneList = true;
      return;
    }
    if (!inSceneList) return;
    if (!trimmed) return;
    if (trimmed.startsWith("*")) {
      inSceneList = false;
      return;
    }
    if (!/^\s+\S/.test(line)) {
      inSceneList = false;
      return;
    }

    const rawSceneName = trimmed.split(/\s+/)[0] ?? "";
    const sceneName = normalizeSourceIdentifier(rawSceneName);
    if (!rawSceneName || !isValidChoiceScriptIdentifier(rawSceneName)) {
      issues.push({ level: "error", msg: `*scene_list has an invalid scene identifier: ${rawSceneName || "(empty)"}`, scene: "startup", line: lineNumber });
      return;
    }
    if (listedScenes.has(sceneName)) {
      issues.push({ level: "warning", msg: `*scene_list repeats scene: ${sceneName}`, scene: "startup", line: lineNumber });
    }
    listedScenes.set(sceneName, lineNumber);
    if (!playableScenes.has(sceneName)) {
      issues.push({ level: "error", msg: `*scene_list points to a missing scene: ${sceneName}`, scene: "startup", line: lineNumber });
    }
  });

  if (!foundSceneList) {
    issues.push({ level: "error", msg: "startup.txt needs a *scene_list", scene: "startup", line: 1 });
  }
  playableScenes.forEach((sceneName) => {
    if (!listedScenes.has(sceneName)) {
      issues.push({ level: "warning", msg: `*scene_list omits project scene: ${sceneName}`, scene: "startup", line: 1 });
    }
  });
  project.variables.forEach((variable) => {
    if (!declaredVariables.has(variable.name)) {
      issues.push({ level: "warning", msg: `startup.txt omits project variable: ${variable.name}`, scene: "startup", line: 1 });
    }
  });
  project.achievements.forEach((achievement) => {
    if (!declaredAchievements.has(achievement.id)) {
      issues.push({ level: "warning", msg: `startup.txt omits project achievement: ${achievement.id}`, scene: "startup", line: 1 });
    }
  });
}

function lintPreservedCreateLine(
  projectVariables: Map<string, ChoiceForgeProject["variables"][number]>,
  declaredVariables: Map<string, number>,
  line: string,
  lineNumber: number,
  issues: LintIssue[],
) {
  const [, rawName = "", ...rest] = line.split(/\s+/);
  const normalizedName = normalizeSourceIdentifier(rawName);
  const initial = rest.join(" ");

  if (!rawName || !isValidChoiceScriptIdentifier(rawName)) {
    issues.push({ level: "error", msg: `*create has an invalid variable identifier: ${rawName || "(empty)"}`, scene: "startup", line: lineNumber });
    return;
  }
  if (!initial.trim()) {
    issues.push({ level: "error", msg: `*create has an empty initial value: ${normalizedName}`, scene: "startup", line: lineNumber });
  }
  const projectVariable = projectVariables.get(normalizedName);
  if (projectVariable && initial.trim() && !isValidVariableInitial({ ...projectVariable, initial })) {
    issues.push({ level: "error", msg: `*create ${normalizedName} has an invalid ${projectVariable.type} initial value: ${initial}`, scene: "startup", line: lineNumber });
  }
  if (declaredVariables.has(normalizedName)) {
    issues.push({ level: "error", msg: `startup.txt repeats *create variable: ${normalizedName}`, scene: "startup", line: lineNumber });
  }
  declaredVariables.set(normalizedName, lineNumber);
  if (!projectVariables.has(normalizedName)) {
    issues.push({ level: "warning", msg: `*create declares a variable missing from project metadata: ${normalizedName}`, scene: "startup", line: lineNumber });
  }
}

function lintPreservedAchievementLine(
  projectAchievements: Set<string>,
  declaredAchievements: Map<string, number>,
  line: string,
  lineNumber: number,
  issues: LintIssue[],
) {
  const [rawId = "", visibility = "", rawPoints = "", ...titleParts] = sourceCommandValue(line, "*achievement").split(/\s+/);
  const normalizedId = normalizeSourceIdentifier(rawId);
  const points = Number(rawPoints);
  const title = titleParts.join(" ").trim();

  if (!rawId || !isValidChoiceScriptIdentifier(rawId)) {
    issues.push({ level: "error", msg: `*achievement has an invalid identifier: ${rawId || "(empty)"}`, scene: "startup", line: lineNumber });
    return;
  }
  if (!visibility || (visibility !== "visible" && visibility !== "hidden")) {
    issues.push({ level: "error", msg: `*achievement has invalid visibility: ${visibility || "(empty)"}`, scene: "startup", line: lineNumber });
  }
  if (!rawPoints || !Number.isInteger(points) || points < 0) {
    issues.push({ level: "error", msg: `*achievement has invalid points: ${rawPoints || "(empty)"}`, scene: "startup", line: lineNumber });
  }
  if (!title) {
    issues.push({ level: "error", msg: `*achievement has an empty title: ${normalizedId}`, scene: "startup", line: lineNumber });
  }
  if (declaredAchievements.has(normalizedId)) {
    issues.push({ level: "error", msg: `startup.txt repeats *achievement: ${normalizedId}`, scene: "startup", line: lineNumber });
  }
  declaredAchievements.set(normalizedId, lineNumber);
  if (!projectAchievements.has(normalizedId)) {
    issues.push({ level: "warning", msg: `*achievement declares an achievement missing from project metadata: ${normalizedId}`, scene: "startup", line: lineNumber });
  }
}

function lintPreservedStatsSource(project: ChoiceForgeProject, sourceText: string, issues: LintIssue[]) {
  lintPreservedScriptSource(project, sourceText, "choicescript_stats", "stats screen exports preserved ChoiceScript source", issues);

  const statVariables = new Map(project.variables.map((variable) => [variable.name, variable]));
  let inStatChart = false;
  sourceText.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    const command = sourceCommand(trimmed);
    if (command === "stat_chart") {
      inStatChart = true;
      return;
    }
    if (command) {
      inStatChart = false;
      return;
    }
    if (!inStatChart || !trimmed) return;
    if (!/^\s+\S/.test(line)) {
      inStatChart = false;
      return;
    }
    const [chartType = "", rawVariable = ""] = trimmed.split(/\s+/, 2);
    if (!["percent", "text", "opposed_pair"].includes(chartType)) {
      issues.push({ level: "error", msg: `*stat_chart has an invalid row type: ${chartType || "(empty)"}`, scene: "choicescript_stats", line: lineNumber });
      return;
    }
    const variable = normalizeSourceIdentifier(rawVariable);
    if (!rawVariable || !isValidChoiceScriptIdentifier(rawVariable)) {
      issues.push({ level: "error", msg: `*stat_chart has an invalid variable identifier: ${rawVariable || "(empty)"}`, scene: "choicescript_stats", line: lineNumber });
      return;
    }
    const projectVariable = statVariables.get(variable);
    if (variable && !projectVariable) {
      issues.push({ level: "warning", msg: `*stat_chart uses an undeclared variable: ${variable}`, scene: "choicescript_stats", line: lineNumber });
    }
    if ((chartType === "percent" || chartType === "opposed_pair") && projectVariable && projectVariable.type !== "number") {
      issues.push({ level: "error", msg: `*stat_chart ${chartType} requires a number variable: ${variable}`, scene: "choicescript_stats", line: lineNumber });
    }
    if (chartType === "percent" && projectVariable?.type === "number" && !projectVariable.fairmath) {
      issues.push({ level: "warning", msg: `*stat_chart percent uses a number variable without percent stat format: ${variable}`, scene: "choicescript_stats", line: lineNumber });
    }
    if (chartType === "text" && projectVariable && projectVariable.type !== "string") {
      issues.push({ level: "error", msg: `*stat_chart text requires a string variable: ${variable}`, scene: "choicescript_stats", line: lineNumber });
    }
  });
}

function lintNodeIds(nodes: StoryNode[], issues: LintIssue[], sceneName: string) {
  const seen = new Set<string>();
  nodes.forEach((node) => {
    if (!node.id.trim()) {
      issues.push({ level: "error", msg: `node "${node.title}" has an empty id`, scene: sceneName });
      return;
    }
    if (seen.has(node.id)) {
      issues.push({ level: "error", msg: `duplicate node id in scene: ${node.id}`, scene: sceneName, node: node.id });
      return;
    }
    seen.add(node.id);
  });
}

function lintLabels(
  labels: Array<{ node: StoryNode; label: string }>,
  generatedLabels: Set<string>,
  issues: LintIssue[],
  sceneName: string,
) {
  const seen = new Map<string, StoryNode>();
  labels.forEach(({ node, label }) => {
    if (!label) {
      issues.push({ level: "error", msg: `*label node "${node.title}" has an empty label`, scene: sceneName, node: node.id });
      return;
    }
    if (!isValidChoiceScriptIdentifier(label)) {
      issues.push({ level: "error", msg: `*label has an invalid identifier: ${label}`, scene: sceneName, node: node.id });
      return;
    }
    if (generatedLabels.has(label)) {
      issues.push({ level: "error", msg: `*label collides with a generated ChoiceForge label: ${label}`, scene: sceneName, node: node.id });
      return;
    }
    const previous = seen.get(label);
    if (previous) {
      issues.push({ level: "error", msg: `duplicate *label in scene: ${label}`, scene: sceneName, node: node.id });
      return;
    }
    seen.set(label, node);
  });
}

function lintChoiceNode(
  node: StoryNode,
  nodeIds: Set<string>,
  variables: Set<string>,
  variableTypes: Map<string, ChoiceForgeProject["variables"][number]>,
  issues: LintIssue[],
  sceneName: string,
) {
  if (!node.options?.length) {
    issues.push({ level: "error", msg: `*choice node "${node.title}" has no options`, scene: sceneName, node: node.id });
  }
  const seenOptionText = new Set<string>();
  node.options?.forEach((option, index) => {
    if (!option.text.trim()) issues.push({ level: "error", msg: `option #${index + 1} is empty in "${node.title}"`, scene: sceneName, node: node.id });
    if (!nodeIds.has(option.to)) issues.push({ level: "error", msg: `option #${index + 1} points to a missing node: ${option.to}`, scene: sceneName, node: node.id });
    if (option.to === node.id) issues.push({ level: "warning", msg: `option #${index + 1} loops back to its own *choice node`, scene: sceneName, node: node.id });
    lintCondition(option.cond, variables, issues, sceneName, node.id);
    option.sets?.forEach((set) => lintSet(set, variables, variableTypes, issues, sceneName, node.id));
    const key = option.text.trim().toLowerCase();
    if (key && seenOptionText.has(key)) issues.push({ level: "warning", msg: `duplicate option text "${option.text.trim()}" in "${node.title}"`, scene: sceneName, node: node.id });
    seenOptionText.add(key);
  });
}

function lintFakeChoiceNode(
  node: StoryNode,
  variables: Set<string>,
  variableTypes: Map<string, ChoiceForgeProject["variables"][number]>,
  issues: LintIssue[],
  sceneName: string,
) {
  if (!node.fakeOptions?.length) {
    issues.push({ level: "error", msg: `*fake_choice node "${node.title}" has no options`, scene: sceneName, node: node.id });
  }
  const seenFakeText = new Set<string>();
  node.fakeOptions?.forEach((option, index) => {
    if (!option.text.trim()) issues.push({ level: "error", msg: `fake choice option #${index + 1} is empty in "${node.title}"`, scene: sceneName, node: node.id });
    lintCondition(option.cond, variables, issues, sceneName, node.id);
    option.sets?.forEach((set) => lintSet(set, variables, variableTypes, issues, sceneName, node.id));
    const key = option.text.trim().toLowerCase();
    if (key && seenFakeText.has(key)) issues.push({ level: "warning", msg: `duplicate fake_choice option text "${option.text.trim()}" in "${node.title}"`, scene: sceneName, node: node.id });
    seenFakeText.add(key);
  });
}

function lintIfNode(
  node: StoryNode,
  nodeIds: Set<string>,
  variables: Set<string>,
  variableTypes: Map<string, ChoiceForgeProject["variables"][number]>,
  issues: LintIssue[],
  sceneName: string,
) {
  if (!node.branches?.length) {
    issues.push({ level: "error", msg: `*if node "${node.title}" has no branches`, scene: sceneName, node: node.id });
  }
  let seenElse = false;
  node.branches?.forEach((branch, index) => {
    if (index === 0 && branch.kind !== "if") {
      issues.push({ level: "error", msg: `*if node "${node.title}" must start with an *if branch`, scene: sceneName, node: node.id });
    }
    if (seenElse) {
      issues.push({ level: "error", msg: `*if node "${node.title}" has a branch after *else`, scene: sceneName, node: node.id });
    }
    if (branch.kind === "else" && seenElse) {
      issues.push({ level: "error", msg: `*if node "${node.title}" has multiple *else branches`, scene: sceneName, node: node.id });
    }
    if (branch.kind === "else") seenElse = true;
    if (branch.kind === "else" && branch.expr?.trim()) {
      issues.push({ level: "error", msg: "*else branch cannot have a condition", scene: sceneName, node: node.id });
    }
    if ((branch.kind === "if" || branch.kind === "elseif") && !branch.expr?.trim()) {
      issues.push({ level: "error", msg: `*${branch.kind} branch needs a condition`, scene: sceneName, node: node.id });
    }
    if (!nodeIds.has(branch.to)) issues.push({ level: "error", msg: `branch *${branch.kind} points to a missing node: ${branch.to}`, scene: sceneName, node: node.id });
    if (branch.to === node.id) issues.push({ level: "warning", msg: `branch *${branch.kind} loops back to its own *if node`, scene: sceneName, node: node.id });
    lintExpression(branch.expr, variables, issues, sceneName, node.id);
    branch.sets?.forEach((set) => lintSet(set, variables, variableTypes, issues, sceneName, node.id));
  });
}

function generateSet(set: VariableSet): string {
  return `*set ${set.var} ${set.op === "=" ? set.val : `${set.op} ${set.val}`}`;
}

function generatedNodeLabel(id: string): string {
  return `cf_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function mergeGraphEdges(...edgeGroups: StoryEdge[][]): StoryEdge[] {
  const seen = new Set<string>();
  return edgeGroups.flat().filter((edge) => {
    const key = `${edge.from}:${edge.to}:${edge.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      if (seen.has(value)) duplicates.add(value);
      seen.add(value);
    });
  return [...duplicates];
}

function deriveNodeEdges(nodes: StoryNode[]): StoryEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const labels = new Map(
    nodes
      .filter((node) => node.type === "label")
      .map((node) => [stripCommandPrefix(node.title, "*label"), node.id]),
  );

  return nodes.flatMap((node): StoryEdge[] => {
    if (node.type === "choice") {
      return (node.options ?? [])
        .filter((option) => nodeIds.has(option.to))
        .map((option, index) => ({
          from: node.id,
          to: option.to,
          kind: "choice",
          label: `#${index + 1}${option.cond ? ` *${option.cond.type}` : ""}`,
        }));
    }

    if (node.type === "if") {
      return (node.branches ?? [])
        .filter((branch) => nodeIds.has(branch.to))
        .map((branch) => ({
          from: node.id,
          to: branch.to,
          kind: branch.kind,
          label: branch.kind === "else" ? "*else" : `*${branch.kind}`,
        }));
    }

    if (node.type === "goto") {
      const target = labels.get(stripCommandPrefix(node.title, "*goto"));
      return target ? [{ from: node.id, to: target, kind: "goto", label: "*goto" }] : [];
    }

    if (node.type === "gosub") {
      const target = labels.get(gosubTarget(node.title));
      return target ? [{ from: node.id, to: target, kind: "goto", label: "*gosub" }] : [];
    }

    return [];
  });
}

function getSceneGraph(project: ChoiceForgeProject, sceneName: string): SceneGraph {
  return project.sceneData?.[sceneName] ?? { nodes: project.nodes, edges: project.edges };
}

function generateOptionHeader(option: ChoiceOption | FakeChoiceOption): string {
  const reuseMode = option.reuse ?? (option.hideReuse ? "hide" : undefined);
  const reuse = reuseMode ? `*${reuseMode}_reuse ` : "";
  const condition = option.cond ? `*${option.cond.type} (${option.cond.expr}) ` : "";
  return `${reuse}${condition}#${option.text}`;
}

function formatStatsLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stripCommandPrefix(value: string, command: string): string {
  return value.replace(command, "").replace(/^[-\s]+/, "").trim();
}

function gosubTarget(value: string): string {
  return stripCommandPrefix(value, "*gosub").split(/\s+/)[0] ?? "";
}

function checkpointSlot(value: string, command: "*save_checkpoint" | "*restore_checkpoint"): string {
  return stripCommandPrefix(value, command);
}

function lintCondition(condition: ChoiceCondition | null | undefined, variables: Set<string>, issues: LintIssue[], scene: string, node: string) {
  if (!condition) return;
  if (!condition.expr.trim()) {
    issues.push({ level: "error", msg: `*${condition.type} condition is empty`, scene, node });
    return;
  }
  lintExpression(condition.expr, variables, issues, scene, node);
}

function lintSet(
  set: VariableSet,
  variables: Set<string>,
  variableTypes: Map<string, ChoiceForgeProject["variables"][number]>,
  issues: LintIssue[],
  scene: string,
  node: string,
) {
  if (!set.var.trim()) {
    issues.push({ level: "error", msg: "*set needs a variable target", scene, node });
    return;
  }
  if (!isValidChoiceScriptIdentifier(set.var)) {
    issues.push({ level: "error", msg: `*set has an invalid variable identifier: ${set.var}`, scene, node });
    return;
  }
  const variable = variableTypes.get(set.var);
  if (!variables.has(set.var) || !variable) {
    issues.push({ level: "error", msg: `*set uses an undeclared variable: ${set.var}`, scene, node });
    return;
  }
  if (variable.type !== "number" && set.op !== "=") {
    issues.push({ level: "error", msg: `*set ${set.var} uses an invalid operator for ${variable.type}: ${set.op}`, scene, node });
  }
  if (variable.type === "number" && (set.op === "%+" || set.op === "%-") && !variable.fairmath) {
    issues.push({ level: "warning", msg: `*set ${set.var} uses fairmath without a percent stat format`, scene, node });
  }
}

function lintInputNode(
  node: StoryNode,
  variables: Set<string>,
  variableTypes: Map<string, ChoiceForgeProject["variables"][number]>,
  issues: LintIssue[],
  scene: string,
) {
  const command = node.type === "input_text" ? "*input_text" : node.type === "input_number" ? "*input_number" : "*rand";
  const variableName = (node.inputVar ?? stripCommandPrefix(node.title, command)).trim();
  if (!variableName) {
    issues.push({ level: "error", msg: `${command} needs a variable target`, scene, node: node.id });
    return;
  }
  if (!isValidChoiceScriptIdentifier(variableName)) {
    issues.push({ level: "error", msg: `${command} has an invalid variable identifier: ${variableName}`, scene, node: node.id });
    return;
  }
  const variable = variableTypes.get(variableName);
  if (!variables.has(variableName) || !variable) {
    issues.push({ level: "error", msg: `${command} uses an undeclared variable: ${variableName}`, scene, node: node.id });
    return;
  }
  if (node.type === "input_text" && variable.type !== "string") {
    issues.push({ level: "error", msg: `*input_text requires a string variable: ${variableName}`, scene, node: node.id });
  }
  if (node.type === "input_number" || node.type === "rand") {
    if (variable.type !== "number") issues.push({ level: "error", msg: `${command} requires a number variable: ${variableName}`, scene, node: node.id });
    const min = Number(node.inputMin ?? (node.type === "rand" ? "1" : "0"));
    const max = Number(node.inputMax ?? "100");
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      issues.push({ level: "error", msg: `${command} has invalid bounds: ${node.inputMin ?? (node.type === "rand" ? "1" : "0")} ${node.inputMax ?? "100"}`, scene, node: node.id });
    }
  }
}

function lintAchievementCommands(text: string, achievements: Set<string>, issues: LintIssue[], scene: string, node: string) {
  extractAchievementCommandTargets(text).forEach((id) => {
    if (!id) {
      issues.push({ level: "error", msg: "*achieve needs an achievement id", scene, node });
      return;
    }
    if (!isValidChoiceScriptIdentifier(id)) {
      issues.push({ level: "error", msg: `*achieve has an invalid achievement identifier: ${id}`, scene, node });
      return;
    }
    if (!achievements.has(id)) {
      issues.push({ level: "error", msg: `*achieve uses an undeclared achievement: ${id}`, scene, node });
    }
  });
}

function lintExpression(expression: string | undefined, variables: Set<string>, issues: LintIssue[], scene: string, node: string) {
  if (!expression) return;
  extractExpressionNames(expression).forEach((name) => {
    if (!variables.has(name)) issues.push({ level: "warning", msg: `condition uses an undeclared variable: ${name}`, scene, node });
  });
}

function lintSourceExpression(expression: string, variables: Set<string>, issues: LintIssue[], scene: string, line: number) {
  extractExpressionNames(normalizeSourceExpressionIdentifiers(expression)).forEach((name) => {
    if (!variables.has(name)) issues.push({ level: "warning", msg: `condition uses an undeclared variable: ${name}`, scene, line });
  });
}

function extractVariableReferences(text: string): string[] {
  const dollar = [...text.matchAll(/\$\{([a-zA-Z_][\w]*)\}/g)].map((m) => m[1]);
  const at = [...text.matchAll(/@\{([a-zA-Z_][\w]*)\b/g)].map((m) => m[1]);
  return [...dollar, ...at];
}

export function extractAchievementCommandTargets(text: string): string[] {
  return [...text.matchAll(/^\s*\*achieve(?:\s+(.+?))?\s*$/gim)].map((match) => match[1]?.trim() ?? "");
}

export function stripAchieveCommands(text: string): string {
  return text.replace(/^\s*\*achieve(?:\s+.+?)?\s*$/gim, "").replace(/\n{3,}/g, "\n\n").trim();
}

function extractExpressionNames(expression: string): string[] {
  const reserved = new Set(["and", "or", "not", "true", "false"]);
  return [...stripQuotedStrings(expression).matchAll(/\b[a-zA-Z_][\w]*\b/g)]
    .map((match) => match[0])
    .filter((name) => !reserved.has(name));
}

function countBodyWords(text: string): number {
  return text
    .replace(/\$\{[^}]+\}/g, " ")
    .replace(/@\{[^}]+\}/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function stripQuotedStrings(expression: string): string {
  return expression.replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g, " ");
}

function sourceCommand(line: string): string | null {
  return line.match(/^\*([a-z_]+)/i)?.[1].toLowerCase() ?? null;
}

function sourceCommandValue(line: string, command: string): string {
  return line.replace(command, "").trim();
}

function sourceConditionExpression(line: string, command: string): string {
  const value = sourceCommandValue(line, `*${command}`).trim();
  const parenthesized = value.match(/^\((.*?)\)(?:\s+#.*)?$/)?.[1];
  if (parenthesized !== undefined) return parenthesized;
  return value.replace(/(?:^|\s)#.*$/, "");
}

function normalizeSourceExpressionIdentifiers(expression: string): string {
  const reserved = new Set(["and", "or", "not", "true", "false"]);
  return expression.replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|[a-zA-Z_][a-zA-Z0-9_-]*/g, (match) => {
    if (match.startsWith("\"") || match.startsWith("'")) return match;
    const lower = match.toLowerCase();
    return reserved.has(lower) ? lower : normalizeSourceIdentifier(match);
  });
}

function normalizeSourceIdentifier(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

export function computeVariableUses(project: ChoiceForgeProject): Map<string, number> {
  const counts = new Map(project.variables.map((variable) => [variable.name, 0]));
  const names = new Set(project.variables.map((variable) => variable.name));

  const tally = (name: string) => {
    if (names.has(name)) counts.set(name, (counts.get(name) ?? 0) + 1);
  };

  const scanNode = (node: StoryNode) => {
    node.sets?.forEach((set) => tally(set.var));
    if (node.inputVar) tally(node.inputVar);
    extractVariableReferences(node.body ?? "").forEach(tally);
    extractVariableReferences(node.prompt ?? "").forEach(tally);
    node.options?.forEach((option) => {
      option.sets?.forEach((set) => tally(set.var));
      if (option.cond?.expr) extractExpressionNames(option.cond.expr).forEach(tally);
    });
    node.fakeOptions?.forEach((option) => {
      option.sets?.forEach((set) => tally(set.var));
      if (option.cond?.expr) extractExpressionNames(option.cond.expr).forEach(tally);
    });
    node.branches?.forEach((branch) => {
      branch.sets?.forEach((set) => tally(set.var));
      if (branch.expr) extractExpressionNames(branch.expr).forEach(tally);
    });
  };

  const scanSource = (text: string) => {
    text.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      extractVariableReferences(trimmed).forEach(tally);
      const command = sourceCommand(trimmed);
      if (command === "set") {
        const varName = normalizeSourceIdentifier(sourceCommandValue(trimmed, "*set").split(/\s+/)[0] ?? "");
        if (varName) tally(varName);
      }
      if (command === "if" || command === "elseif") {
        extractExpressionNames(normalizeSourceExpressionIdentifiers(sourceCommandValue(trimmed, `*${command}`))).forEach(tally);
      }
      if (command === "input_text" || command === "input_number" || command === "rand") {
        const varName = normalizeSourceIdentifier(sourceCommandValue(trimmed, `*${command}`).split(/\s+/)[0] ?? "");
        if (varName) tally(varName);
      }
    });
  };

  const graphs = project.sceneData ? Object.values(project.sceneData) : [{ nodes: project.nodes, edges: project.edges }];
  graphs.forEach((graph) => {
    graph.nodes.forEach(scanNode);
    if (graph.sourceText) scanSource(graph.sourceText);
  });
  if (project.startupSource) scanSource(project.startupSource);
  if (project.statsSource) scanSource(project.statsSource);

  return counts;
}

export type VarLocation = {
  sceneName: string;
  nodeId: string;
  nodeTitle: string;
  kind: "write" | "read";
};

export function computeVariableLocations(project: ChoiceForgeProject): Map<string, VarLocation[]> {
  const result = new Map(project.variables.map((v) => [v.name, [] as VarLocation[]]));
  const names = new Set(project.variables.map((v) => v.name));

  const addLoc = (name: string, sceneName: string, nodeId: string, nodeTitle: string, kind: "write" | "read") => {
    if (!names.has(name)) return;
    const list = result.get(name)!;
    if (!list.some((l) => l.sceneName === sceneName && l.nodeId === nodeId && l.kind === kind)) {
      list.push({ sceneName, nodeId, nodeTitle, kind });
    }
  };

  const scanGraph = (sceneName: string, nodes: StoryNode[]) => {
    for (const node of nodes) {
      node.sets?.forEach((s) => addLoc(s.var, sceneName, node.id, node.title, "write"));
      if (node.inputVar) addLoc(node.inputVar, sceneName, node.id, node.title, "write");
      extractVariableReferences(node.body ?? "").forEach((n) => addLoc(n, sceneName, node.id, node.title, "read"));
      extractVariableReferences(node.prompt ?? "").forEach((n) => addLoc(n, sceneName, node.id, node.title, "read"));
      node.options?.forEach((opt) => {
        opt.sets?.forEach((s) => addLoc(s.var, sceneName, node.id, node.title, "write"));
        if (opt.cond?.expr) extractExpressionNames(opt.cond.expr).forEach((n) => addLoc(n, sceneName, node.id, node.title, "read"));
      });
      node.fakeOptions?.forEach((opt) => {
        opt.sets?.forEach((s) => addLoc(s.var, sceneName, node.id, node.title, "write"));
        if (opt.cond?.expr) extractExpressionNames(opt.cond.expr).forEach((n) => addLoc(n, sceneName, node.id, node.title, "read"));
      });
      node.branches?.forEach((branch) => {
        branch.sets?.forEach((s) => addLoc(s.var, sceneName, node.id, node.title, "write"));
        if (branch.expr) extractExpressionNames(branch.expr).forEach((n) => addLoc(n, sceneName, node.id, node.title, "read"));
      });
    }
  };

  if (project.sceneData) {
    for (const [sceneName, graph] of Object.entries(project.sceneData)) {
      scanGraph(sceneName, graph.nodes);
    }
  } else {
    scanGraph(project.sceneTitle, project.nodes);
  }

  return result;
}

export type AchievementLocation = {
  sceneName: string;
  nodeId: string;
  nodeTitle: string;
};

export function computeAchievementLocations(project: ChoiceForgeProject): Map<string, AchievementLocation[]> {
  const result = new Map(project.achievements.map((a) => [a.id, [] as AchievementLocation[]]));
  const ids = new Set(project.achievements.map((a) => a.id));

  const addLoc = (id: string, sceneName: string, nodeId: string, nodeTitle: string) => {
    if (!ids.has(id)) return;
    const list = result.get(id)!;
    if (!list.some((l) => l.sceneName === sceneName && l.nodeId === nodeId)) {
      list.push({ sceneName, nodeId, nodeTitle });
    }
  };

  const scanGraph = (sceneName: string, nodes: StoryNode[]) => {
    for (const node of nodes) {
      extractAchievementCommandTargets(node.body ?? "").forEach((id) => addLoc(id, sceneName, node.id, node.title));
    }
  };

  if (project.sceneData) {
    for (const [sceneName, graph] of Object.entries(project.sceneData)) {
      scanGraph(sceneName, graph.nodes);
    }
  } else {
    scanGraph(project.sceneTitle, project.nodes);
  }

  return result;
}

export function computeAchievementUses(project: ChoiceForgeProject): Map<string, number> {
  const counts = new Map(project.achievements.map((a) => [a.id, 0]));
  const ids = new Set(project.achievements.map((a) => a.id));
  const tally = (id: string) => {
    if (ids.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  };
  const scanText = (text: string) => extractAchievementCommandTargets(text).forEach(tally);
  const scanNode = (node: StoryNode) => scanText(node.body ?? "");
  const scanSource = (text: string) => {
    text.split(/\r?\n/).forEach((line) => {
      const cmd = sourceCommand(line.trim());
      if (cmd === "achieve") {
        const id = normalizeSourceIdentifier(sourceCommandValue(line.trim(), "*achieve").trim());
        if (id) tally(id);
      }
    });
  };
  const graphs = project.sceneData ? Object.values(project.sceneData) : [{ nodes: project.nodes, edges: project.edges }];
  graphs.forEach((graph) => {
    graph.nodes.forEach(scanNode);
    if (graph.sourceText) scanSource(graph.sourceText);
  });
  if (project.startupSource) scanSource(project.startupSource);
  if (project.statsSource) scanSource(project.statsSource);
  return counts;
}
