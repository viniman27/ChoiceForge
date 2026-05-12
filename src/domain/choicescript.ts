import type { ChoiceForgeProject, ChoiceCondition, ChoiceOption, FakeChoiceOption, LintIssue, SceneGraph, StoryEdge, StoryNode, VariableSet } from "./types";

const TERMINAL_NODE_TYPES = new Set<StoryNode["type"]>(["ending", "finish", "goto", "goto_scene"]);

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
  if (node.body?.trim()) lines.push(node.body);
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

  if (node.type === "goto_scene" && node.target) lines.push(`*goto_scene ${node.target}`);
  if (node.type === "goto") lines.push(`*goto ${stripCommandPrefix(node.title, "*goto")}`);
  if (node.type === "gosub") lines.push(stripCommandPrefix(node.title, "*gosub").startsWith("*") ? node.title : `*gosub ${stripCommandPrefix(node.title, "*gosub")}`);
  if (node.type === "ending") lines.push("*ending");
  if (node.type === "finish") lines.push("*finish");
  if (node.type === "checkpoint") lines.push(`*save_checkpoint ${stripCommandPrefix(node.title, "*save_checkpoint")}`);
  if (node.type === "page_break") lines.push(`*page_break ${stripCommandPrefix(node.title, "*page_break") || "Continue"}`);
  if (node.type === "comment") {
    const comments = (node.body?.trim() || stripCommandPrefix(node.title, "*comment") || "ChoiceForge comment").split("\n");
    comments.forEach((comment) => lines.push(`*comment ${comment.trim()}`));
  }
  if (node.type === "input_text") lines.push(`*input_text ${node.inputVar ?? stripCommandPrefix(node.title, "*input_text")}`);
  if (node.type === "input_number") lines.push(`*input_number ${node.inputVar ?? stripCommandPrefix(node.title, "*input_number")} ${node.inputMin ?? "0"} ${node.inputMax ?? "100"}`);
  if (node.type === "rand") lines.push(`*rand ${node.inputVar ?? stripCommandPrefix(node.title, "*rand")} ${node.inputMin ?? "1"} ${node.inputMax ?? "100"}`);

  const flowTarget = edges.find((edge) => edge.from === node.id && edge.kind === "flow")?.to;
  if (flowTarget && !TERMINAL_NODE_TYPES.has(node.type) && node.type !== "choice" && node.type !== "if") {
    lines.push(`*goto ${generatedNodeLabel(flowTarget)}`);
  }

  return lines.join("\n") || "# empty";
}

export function generateSceneChoiceScript(project: ChoiceForgeProject, sceneName = project.sceneTitle): string {
  const graph = getSceneGraph(project, sceneName);
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
  const lines: string[] = [];

  if (!project.variables.length && !project.achievements.length) {
    lines.push("*comment ChoiceForge: no stats configured yet");
    lines.push("No stats configured yet.");
    return `${lines.join("\n")}\n`;
  }

  if (project.variables.length) {
    lines.push("*stat_chart");
    project.variables.forEach((variable) => {
      const chartType = variable.type === "number" && variable.fairmath ? "percent" : "text";
      lines.push(`  ${chartType} ${variable.name} ${formatStatsLabel(variable.desc || variable.name)}`);
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
  sceneNames.forEach((sceneName) => {
    lintSceneGraph(project, getSceneGraph(project, sceneName), sceneName, issues);
  });

  issues.push({ level: "info", msg: "indent configured: 2 spaces; encoding UTF-8", scene: null });
  return issues;
}

function lintProjectMetadata(project: ChoiceForgeProject, issues: LintIssue[]) {
  findDuplicates(project.scenes.map((scene) => scene.name))
    .forEach((name) => issues.push({ level: "error", msg: `duplicate scene name: ${name}`, scene: null }));
  findDuplicates(project.variables.map((variable) => variable.name))
    .forEach((name) => issues.push({ level: "error", msg: `duplicate variable name: ${name}`, scene: null }));
  findDuplicates(project.achievements.map((achievement) => achievement.id))
    .forEach((id) => issues.push({ level: "error", msg: `duplicate achievement id: ${id}`, scene: null }));
  findDuplicates((project.assets ?? []).map((asset) => asset.path))
    .forEach((path) => issues.push({ level: "warning", msg: `duplicate asset path: ${path}`, scene: null }));

  project.scenes.forEach((scene) => {
    if (!scene.name.trim()) issues.push({ level: "error", msg: "scene has an empty name", scene: null });
  });
  project.variables.forEach((variable) => {
    if (!variable.name.trim()) issues.push({ level: "error", msg: "variable has an empty name", scene: null });
    if (!variable.initial.trim()) issues.push({ level: "error", msg: `variable "${variable.name}" has an empty initial value`, scene: null });
  });
  project.achievements.forEach((achievement) => {
    if (!achievement.id.trim()) issues.push({ level: "error", msg: "achievement has an empty id", scene: null });
    if (!Number.isFinite(achievement.points) || achievement.points < 0) {
      issues.push({ level: "error", msg: `achievement "${achievement.id}" has invalid points`, scene: null });
    }
  });
  (project.assets ?? []).forEach((asset) => {
    if (!asset.path.trim()) issues.push({ level: "warning", msg: `asset "${asset.id}" has an empty path`, scene: null });
  });
}

function lintSceneGraph(project: ChoiceForgeProject, graph: SceneGraph, sceneName: string, issues: LintIssue[]) {
  const edges = mergeGraphEdges(graph.edges, deriveNodeEdges(graph.nodes));
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const labels = new Set([
    ...graph.nodes.map((node) => generatedNodeLabel(node.id)),
    ...graph.nodes.filter((node) => node.type === "label").map((node) => stripCommandPrefix(node.title, "*label")),
  ]);
  const variables = new Set(project.variables.map((variable) => variable.name));
  const variableTypes = new Map(project.variables.map((variable) => [variable.name, variable]));
  const achievements = new Set(project.achievements.map((achievement) => achievement.id));
  const scenes = new Set(project.scenes.filter((scene) => !scene.isStart && !scene.special).map((scene) => scene.name));
  const outgoing = new Map(graph.nodes.map((node) => [node.id, 0]));
  const incoming = new Map(graph.nodes.map((node) => [node.id, 0]));

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.from)) {
      issues.push({ level: "error", msg: `edge starts from a missing node: ${edge.from}`, scene: sceneName });
    }
    if (!nodeIds.has(edge.to)) {
      issues.push({ level: "error", msg: `edge points to a missing node: ${edge.to}`, scene: sceneName });
    }
    outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  });

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

    extractAchievementCommands(node.body ?? "").forEach((id) => {
      if (!achievements.has(id)) issues.push({ level: "error", msg: `*achieve uses an undeclared achievement: ${id}`, scene: sceneName, node: node.id });
    });

    if (node.type === "choice") lintChoiceNode(node, nodeIds, variables, variableTypes, issues, sceneName);
    if (node.type === "fake_choice") lintFakeChoiceNode(node, variables, variableTypes, issues, sceneName);
    if (node.type === "if") lintIfNode(node, nodeIds, variables, variableTypes, issues, sceneName);

    if (node.type === "goto_scene" && node.target && !scenes.has(node.target)) {
      issues.push({ level: "error", msg: `*goto_scene points to a missing scene: ${node.target}`, scene: sceneName, node: node.id });
    }

    if (node.type === "goto") {
      const label = stripCommandPrefix(node.title, "*goto");
      if (label && !labels.has(label)) issues.push({ level: "error", msg: `*goto points to a missing label: ${label}`, scene: sceneName, node: node.id });
    }

    if (node.type === "gosub") {
      const label = stripCommandPrefix(node.title, "*gosub");
      if (label && !labels.has(label)) issues.push({ level: "error", msg: `*gosub points to a missing label: ${label}`, scene: sceneName, node: node.id });
    }

    if (node.type === "input_text" || node.type === "input_number" || node.type === "rand") {
      lintInputNode(node, variables, variableTypes, issues, sceneName);
    }
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
  node.options?.forEach((option, index) => {
    if (!option.text.trim()) issues.push({ level: "error", msg: `option #${index + 1} is empty in "${node.title}"`, scene: sceneName, node: node.id });
    if (!nodeIds.has(option.to)) issues.push({ level: "error", msg: `option #${index + 1} points to a missing node: ${option.to}`, scene: sceneName, node: node.id });
    lintCondition(option.cond, variables, issues, sceneName, node.id);
    option.sets?.forEach((set) => lintSet(set, variables, variableTypes, issues, sceneName, node.id));
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
  node.fakeOptions?.forEach((option, index) => {
    if (!option.text.trim()) issues.push({ level: "error", msg: `fake choice option #${index + 1} is empty in "${node.title}"`, scene: sceneName, node: node.id });
    lintCondition(option.cond, variables, issues, sceneName, node.id);
    option.sets?.forEach((set) => lintSet(set, variables, variableTypes, issues, sceneName, node.id));
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
  node.branches?.forEach((branch) => {
    if (branch.kind === "else" && branch.expr?.trim()) {
      issues.push({ level: "error", msg: "*else branch cannot have a condition", scene: sceneName, node: node.id });
    }
    if ((branch.kind === "if" || branch.kind === "elseif") && !branch.expr?.trim()) {
      issues.push({ level: "error", msg: `*${branch.kind} branch needs a condition`, scene: sceneName, node: node.id });
    }
    if (!nodeIds.has(branch.to)) issues.push({ level: "error", msg: `branch *${branch.kind} points to a missing node: ${branch.to}`, scene: sceneName, node: node.id });
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
      const target = labels.get(stripCommandPrefix(node.title, "*gosub"));
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

function lintCondition(condition: ChoiceCondition | null | undefined, variables: Set<string>, issues: LintIssue[], scene: string, node: string) {
  if (!condition) return;
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
  const variableName = node.inputVar ?? stripCommandPrefix(node.title, command);
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

function lintExpression(expression: string | undefined, variables: Set<string>, issues: LintIssue[], scene: string, node: string) {
  if (!expression) return;
  extractExpressionNames(expression).forEach((name) => {
    if (!variables.has(name)) issues.push({ level: "warning", msg: `condition uses an undeclared variable: ${name}`, scene, node });
  });
}

function extractVariableReferences(text: string): string[] {
  return [...text.matchAll(/\$\{([a-zA-Z_][\w]*)\}/g)].map((match) => match[1]);
}

function extractAchievementCommands(text: string): string[] {
  return [...text.matchAll(/^\s*\*achieve\s+([a-z_][\w]*)\s*$/gim)].map((match) => match[1]);
}

function extractExpressionNames(expression: string): string[] {
  const reserved = new Set(["and", "or", "not", "true", "false"]);
  return [...stripQuotedStrings(expression).matchAll(/\b[a-zA-Z_][\w]*\b/g)]
    .map((match) => match[0])
    .filter((name) => !reserved.has(name));
}

function stripQuotedStrings(expression: string): string {
  return expression.replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g, " ");
}
