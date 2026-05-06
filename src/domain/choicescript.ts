import type { ChoiceForgeProject, ChoiceCondition, ChoiceOption, LintIssue, SceneGraph, StoryEdge, StoryNode, VariableSet } from "./types";

const TERMINAL_NODE_TYPES = new Set<StoryNode["type"]>(["ending", "goto", "goto_scene"]);

export interface ChoiceForgeExportFile {
  path: string;
  encoding: "utf-8";
  content: string;
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
    lines.push("*choice");
    node.options?.forEach((option) => {
      lines.push(`  ${generateOptionHeader(option)}`);
      lines.push(`    *goto ${generatedNodeLabel(option.to)}`);
    });
  }

  if (node.type === "if") {
    node.branches?.forEach((branch) => {
      lines.push(branch.expr ? `*${branch.kind} (${branch.expr})` : `*${branch.kind}`);
      lines.push(`  *goto ${generatedNodeLabel(branch.to)}`);
    });
  }

  if (node.type === "goto_scene" && node.target) lines.push(`*goto_scene ${node.target}`);
  if (node.type === "goto") lines.push(`*goto ${stripCommandPrefix(node.title, "*goto")}`);
  if (node.type === "gosub") lines.push(stripCommandPrefix(node.title, "*gosub").startsWith("*") ? node.title : `*gosub ${stripCommandPrefix(node.title, "*gosub")}`);
  if (node.type === "ending") lines.push("*ending");
  if (node.type === "checkpoint") lines.push(`*save_checkpoint ${stripCommandPrefix(node.title, "*save_checkpoint")}`);

  const flowTarget = edges.find((edge) => edge.from === node.id && edge.kind === "flow")?.to;
  if (flowTarget && !TERMINAL_NODE_TYPES.has(node.type) && node.type !== "choice" && node.type !== "if") {
    lines.push(`*goto ${generatedNodeLabel(flowTarget)}`);
  }

  return lines.join("\n") || "# empty";
}

export function generateSceneChoiceScript(project: ChoiceForgeProject, sceneName = project.sceneTitle): string {
  const graph = getSceneGraph(project, sceneName);
  const incoming = new Map(graph.nodes.map((node) => [node.id, 0]));
  graph.edges.forEach((edge) => incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1));

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

export function createExportPackage(project: ChoiceForgeProject): ChoiceForgeExportPackage {
  const sceneFiles = project.scenes
    .filter((scene) => !scene.special && !scene.isStart && scene.name !== "startup")
    .map((scene) => ({
      path: `mygame/${scene.name}.txt`,
      encoding: "utf-8" as const,
      content: `${generateSceneChoiceScript(project, scene.name)}\n`,
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
        path: "project.json",
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
    ],
  };
}

export function lintProject(project: ChoiceForgeProject): LintIssue[] {
  const issues: LintIssue[] = [];
  const nodeIds = new Set(project.nodes.map((node) => node.id));
  const labels = new Set([
    ...project.nodes.map((node) => generatedNodeLabel(node.id)),
    ...project.nodes.filter((node) => node.type === "label").map((node) => stripCommandPrefix(node.title, "*label")),
  ]);
  const variables = new Set(project.variables.map((variable) => variable.name));
  const scenes = new Set(project.scenes.map((scene) => scene.name));
  const outgoing = new Map(project.nodes.map((node) => [node.id, 0]));
  const incoming = new Map(project.nodes.map((node) => [node.id, 0]));

  project.edges.forEach((edge) => {
    if (!nodeIds.has(edge.from)) {
      issues.push({ level: "error", msg: `aresta sai de no inexistente: ${edge.from}`, scene: project.sceneTitle });
    }
    if (!nodeIds.has(edge.to)) {
      issues.push({ level: "error", msg: `aresta aponta para no inexistente: ${edge.to}`, scene: project.sceneTitle });
    }
    outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  });

  project.nodes.forEach((node) => {
    if (node.id !== "n1" && (incoming.get(node.id) ?? 0) === 0) {
      issues.push({ level: "warning", msg: `no "${node.title}" nao recebe nenhuma conexao`, scene: project.sceneTitle, node: node.id });
    }

    if (!TERMINAL_NODE_TYPES.has(node.type) && node.type !== "choice" && node.type !== "if" && (outgoing.get(node.id) ?? 0) === 0) {
      issues.push({ level: "info", msg: `no "${node.title}" nao tem saida visual`, scene: project.sceneTitle, node: node.id });
    }

    node.sets?.forEach((set) => {
      if (!variables.has(set.var)) {
        issues.push({ level: "error", msg: `*set usa variavel nao criada: ${set.var}`, scene: project.sceneTitle, node: node.id });
      }
    });

    extractVariableReferences(node.body ?? "").forEach((name) => {
      if (!variables.has(name)) issues.push({ level: "warning", msg: `texto usa variavel nao criada: ${name}`, scene: project.sceneTitle, node: node.id });
    });

    node.options?.forEach((option, index) => {
      if (!option.text.trim()) issues.push({ level: "error", msg: `opcao #${index + 1} vazia em "${node.title}"`, scene: project.sceneTitle, node: node.id });
      if (!nodeIds.has(option.to)) issues.push({ level: "error", msg: `opcao #${index + 1} aponta para no inexistente: ${option.to}`, scene: project.sceneTitle, node: node.id });
      lintCondition(option.cond, variables, issues, project.sceneTitle, node.id);
    });

    node.branches?.forEach((branch) => {
      if (!nodeIds.has(branch.to)) issues.push({ level: "error", msg: `branch *${branch.kind} aponta para no inexistente: ${branch.to}`, scene: project.sceneTitle, node: node.id });
      lintExpression(branch.expr, variables, issues, project.sceneTitle, node.id);
    });

    if (node.type === "goto_scene" && node.target && !scenes.has(node.target)) {
      issues.push({ level: "error", msg: `*goto_scene aponta para cena inexistente: ${node.target}`, scene: project.sceneTitle, node: node.id });
    }

    if (node.type === "goto") {
      const label = stripCommandPrefix(node.title, "*goto");
      if (label && !labels.has(label)) issues.push({ level: "error", msg: `*goto aponta para label inexistente: ${label}`, scene: project.sceneTitle, node: node.id });
    }
  });

  issues.push({ level: "info", msg: "indentacao configurada: 2 espacos; encoding UTF-8", scene: null });
  return issues;
}

function generateSet(set: VariableSet): string {
  return `*set ${set.var} ${set.op === "=" ? set.val : `${set.op} ${set.val}`}`;
}

function generatedNodeLabel(id: string): string {
  return `cf_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function getSceneGraph(project: ChoiceForgeProject, sceneName: string): SceneGraph {
  return project.sceneData?.[sceneName] ?? { nodes: project.nodes, edges: project.edges };
}

function generateOptionHeader(option: ChoiceOption): string {
  const reuse = option.hideReuse ? "*hide_reuse " : "";
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

function lintExpression(expression: string | undefined, variables: Set<string>, issues: LintIssue[], scene: string, node: string) {
  if (!expression) return;
  extractExpressionNames(expression).forEach((name) => {
    if (!variables.has(name)) issues.push({ level: "warning", msg: `condicao usa variavel nao criada: ${name}`, scene, node });
  });
}

function extractVariableReferences(text: string): string[] {
  return [...text.matchAll(/\$\{([a-zA-Z_][\w]*)\}/g)].map((match) => match[1]);
}

function extractExpressionNames(expression: string): string[] {
  const reserved = new Set(["and", "or", "not", "true", "false"]);
  return [...expression.matchAll(/\b[a-zA-Z_][\w]*\b/g)]
    .map((match) => match[0])
    .filter((name) => !reserved.has(name));
}
