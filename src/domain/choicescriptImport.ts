import type { AchievementSummary, AssetSummary, ChoiceCondition, ChoiceForgeProject, ChoiceOption, ChoiceReuse, ConditionalBranch, FakeChoiceOption, NodeType, SceneGraph, SceneSummary, StoryEdge, StoryNode, VariableSet, VariableSummary } from "./types";

export interface ChoiceScriptArchiveEntry {
  name: string;
  bytes: Uint8Array;
}

export function importChoiceScriptSceneText(sceneName: string, content: string, currentGraph?: SceneGraph): SceneGraph {
  if (currentGraph && hasChoiceForgeLabels(content)) {
    return updateChoiceForgeSceneGraph(currentGraph, content);
  }
  return createImportedSceneGraph(sceneName, content);
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
  const stats = textFiles.find((entry) => basename(entry.path).toLowerCase() === "choicescript_stats.txt");
  const sceneTextFiles = textFiles.filter((entry) => !["startup.txt", "choicescript_stats.txt"].includes(basename(entry.path).toLowerCase()));
  const sceneFileMap = new Map(sceneTextFiles.map((entry) => [normalizeIdentifier(basename(entry.path).replace(/\.txt$/i, "")), decoder.decode(entry.bytes)]));
  const startupSceneText = extractStartupSceneText(startupText);
  const startupContentScene = startupSceneText.trim() ? startupContentSceneName(startupData.sceneNames, sceneFileMap) : null;
  if (startupContentScene) sceneFileMap.set(startupContentScene, startupSceneText);
  const sceneNames = unique([
    ...(startupContentScene ? [startupContentScene] : []),
    ...startupData.sceneNames,
    ...sceneTextFiles.map((entry) => normalizeIdentifier(basename(entry.path).replace(/\.txt$/i, ""))),
  ]);
  if (!sceneNames.length) throw new Error("no scene files found");

  const activeScene = sceneNames[0];
  const sceneData = Object.fromEntries(sceneNames.map((sceneName) => {
    const sourceText = sceneFileMap.get(sceneName) ?? "";
    const graph = createImportedSceneGraph(sceneName, sourceText);
    return [sceneName, sourceText ? { ...graph, sourceText } : graph];
  }));
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
    variables: applyImportedStatsText(startupData.variables, stats ? decoder.decode(stats.bytes) : ""),
    achievements: startupData.achievements,
    assets: importAssets(entries),
    nodes: sceneData[activeScene].nodes,
    edges: sceneData[activeScene].edges,
    sceneData,
    startupSource: startupText,
    statsSource: stats ? decoder.decode(stats.bytes) : undefined,
    lints: [],
  };
}

function applyImportedStatsText(variables: VariableSummary[], content: string): VariableSummary[] {
  const chartRows = parseStatChartRows(content.split(/\r?\n/));
  if (!chartRows.length) return variables;
  const rows = new Map(chartRows.map((row) => [row.name, row]));
  return variables.map((variable) => {
    const row = rows.get(variable.name);
    if (!row) return variable;
    if (row.chartType === "opposed_pair") {
      return { ...variable, desc: row.highLabel || variable.desc, opposedLow: row.lowLabel ?? "", fairmath: false };
    }
    return {
      ...variable,
      desc: row.label || variable.desc,
      fairmath: variable.type === "number" ? row.chartType === "percent" : false,
      opposedLow: undefined,
    };
  });
}

type StatChartRow =
  | { chartType: "percent" | "text"; name: string; label: string }
  | { chartType: "opposed_pair"; name: string; highLabel: string; lowLabel: string };

function parseStatChartRows(lines: string[]): StatChartRow[] {
  const rows: StatChartRow[] = [];
  let inChart = false;
  let pendingOpposed: { name: string } | null = null;
  let pendingHigh: string | null = null;
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (commandName(line) === "stat_chart") {
      inChart = true;
      pendingOpposed = null;
      pendingHigh = null;
      return;
    }
    if (!inChart || !trimmed) return;
    if (trimmed.startsWith("*")) {
      inChart = false;
      pendingOpposed = null;
      pendingHigh = null;
      return;
    }
    if (pendingOpposed) {
      if (pendingHigh === null) {
        pendingHigh = trimmed;
        return;
      }
      rows.push({ chartType: "opposed_pair", name: pendingOpposed.name, highLabel: pendingHigh, lowLabel: trimmed });
      pendingOpposed = null;
      pendingHigh = null;
      return;
    }
    const [chartType, rawName, ...labelParts] = trimmed.split(/\s+/);
    const name = normalizeIdentifier(rawName ?? "");
    if (chartType === "opposed_pair" && name) {
      pendingOpposed = { name };
      pendingHigh = null;
      return;
    }
    if ((chartType === "percent" || chartType === "text") && name) {
      rows.push({ chartType, name, label: labelParts.join(" ") });
    }
  });
  return rows;
}

function startupContentSceneName(sceneNames: string[], sceneFileMap: Map<string, string>): string {
  if (sceneNames.includes("startup") || sceneFileMap.has("startup")) return "startup";
  const existing = new Set([...sceneNames, ...sceneFileMap.keys()]);
  let candidate = "startup_prologue";
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `startup_prologue_${suffix}`;
    suffix += 1;
  }
  return candidate;
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
        sceneNames.push(normalizeIdentifier(line.trim()));
        continue;
      }
      if (line.trim().startsWith("*")) inSceneList = false;
    }

    if (command === "create") {
      const prevLine = index > 0 ? lines[index - 1] : "";
      const inlineComment = commandName(prevLine) === "comment" ? commandValue(prevLine, "*comment").trim() : "";
      const [, name = "variable", ...rest] = line.trim().split(/\s+/);
      const normalizedName = normalizeIdentifier(name || "variable");
      const initial = rest.join(" ") || "0";
      variables.push({
        name: normalizedName,
        type: inferVariableType(initial),
        initial,
        desc: inlineComment || normalizedName,
        uses: 0,
        fairmath: inferVariableType(initial) === "number",
      });
    }

    if (command === "achievement") {
      const parts = line.trim().split(/\s+/);
      const id = normalizeIdentifier(parts[1] ?? `achievement_${achievements.length + 1}`);
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

function extractStartupSceneText(text: string): string {
  const lines = text.split(/\r?\n/);
  const content: string[] = [];
  let inSceneList = false;
  let skipAchievementLines = 0;

  lines.forEach((line) => {
    const command = commandName(line);
    if (skipAchievementLines > 0) {
      skipAchievementLines -= 1;
      return;
    }
    if (inSceneList) {
      if (/^\s+\S/.test(line) && !line.trim().startsWith("*")) return;
      inSceneList = false;
    }
    if (command === "scene_list") {
      inSceneList = true;
      return;
    }
    if (command === "title" || command === "author" || command === "create") return;
    if (command === "achievement") {
      skipAchievementLines = 2;
      return;
    }
    content.push(line);
  });

  return content.join("\n").trim();
}

function createImportedSceneGraph(sceneName: string, content: string): SceneGraph {
  const nodes: StoryNode[] = [];
  const edges: StoryEdge[] = [];
  const pending: string[] = [];
  const pendingChoices: Array<{ nodeId: string; options: ImportedChoiceOption[] }> = [];
  const pendingIfs: Array<{ nodeId: string; branches: ImportedConditionalBranch[]; rawBlock: string }> = [];
  const pendingContinuations = new Set<string>();
  const lines = content.split(/\r?\n/);
  let previous: StoryNode | null = null;

  const addNode = (node: Omit<StoryNode, "id" | "x" | "y" | "w"> & { w?: number }, autoFlow = true) => {
    const next: StoryNode = {
      ...node,
      id: `n${nodes.length + 1}`,
      x: 70 + (nodes.length % 4) * 380,
      y: 70 + Math.floor(nodes.length / 4) * 220,
      w: node.w ?? defaultImportedWidth(node.type),
    };
    if (autoFlow && previous && canAutoFlow(previous)) edges.push({ from: previous.id, to: next.id, kind: "flow" });
    nodes.push(next);
    if (autoFlow && pendingContinuations.size) {
      [...pendingContinuations].forEach((sourceId) => {
        const source = nodes.find((candidate) => candidate.id === sourceId);
        if (source && canAutoFlow(source) && !edges.some((edge) => edge.kind === "flow" && edge.from === sourceId)) {
          edges.push({ from: sourceId, to: next.id, kind: "flow" });
        }
      });
      pendingContinuations.clear();
    }
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
        const inlineChoice = parseInlineChoiceBlock(block, nodes.length + 1);
        if (inlineChoice) {
          const choiceNode = addNode(inlineChoice.node);
          const inlineTargets = inlineChoice.options.map((option) => addInlineOptionNodes(option, addNode, edges));
          const options = inlineChoice.options.map((option, optionIndex): ChoiceOption => ({
            text: option.text,
            to: inlineTargets[optionIndex].targetId,
            body: inlineTargets[optionIndex].body,
            cond: option.cond ?? null,
            reuse: option.reuse,
            hideReuse: option.hideReuse,
            sets: option.sets.length ? option.sets : undefined,
          }));
          choiceNode.options = options;
          options.forEach((option, optionIndex) => {
            edges.push({
              from: choiceNode.id,
              to: option.to,
              kind: "choice",
              label: `#${optionIndex + 1}${option.cond ? ` *${option.cond.type}` : ""}`,
            });
          });
          inlineTargets.forEach((target) => {
            if (target.continuationId) pendingContinuations.add(target.continuationId);
          });
          previous = choiceNode;
        } else {
          addNode({ type: "passage", title: `${command}_block_${nodes.length + 1}`, body: block.join("\n").trimEnd(), w: 500 });
        }
      }
      continue;
    }

    if (command === "fake_choice") {
      flushPassage();
      const block = collectIndentedBlock(lines, index);
      index += block.length - 1;
      const parsedFakeChoice = parseFakeChoiceBlock(block, nodes.length + 1) ?? parseInlineFakeChoiceBlock(block, nodes.length + 1);
      if (parsedFakeChoice) {
        addNode(parsedFakeChoice);
      } else {
        addNode({ type: "passage", title: `${command}_block_${nodes.length + 1}`, body: block.join("\n").trimEnd(), w: 500 });
      }
      continue;
    }

    if (command === "if") {
      flushPassage();
      const block = collectIfChain(lines, index);
      index += block.length - 1;
      const parsedIf = parseIfBlock(block, nodes.length + 1);
      if (parsedIf) {
        const ifNode = addNode(parsedIf.node);
        pendingIfs.push({ nodeId: ifNode.id, branches: parsedIf.branches, rawBlock: block.join("\n").trimEnd() });
      } else {
        const inlineIf = parseInlineIfBlock(block, nodes.length + 1);
        if (inlineIf) {
          const ifNode = addNode(inlineIf.node);
          const inlineTargets = inlineIf.branches.map((branch) => addInlineBranchNodes(branch, addNode, edges));
          const branches = inlineIf.branches.map((branch, branchIndex) => {
            return {
              kind: branch.kind,
              expr: branch.expr,
              to: inlineTargets[branchIndex].targetId,
              sets: branch.sets.length ? branch.sets : undefined,
            };
          });
          ifNode.branches = branches;
          branches.forEach((branch) => {
            edges.push({
              from: ifNode.id,
              to: branch.to,
              kind: branch.kind,
              label: branch.kind === "else" ? "*else" : `*${branch.kind}`,
            });
          });
          inlineTargets.forEach((target) => {
            if (target.continuationId) pendingContinuations.add(target.continuationId);
          });
          previous = ifNode;
        } else {
          addNode({ type: "passage", title: `${command}_block_${nodes.length + 1}`, body: block.join("\n").trimEnd(), w: 500 });
        }
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

    if (command === "label" && commandName(lines[index + 1] ?? "") === "params") {
      flushPassage();
      const labelNode = simpleCommandNode(command, line, nodes.length + 1);
      if (labelNode) addNode({ ...labelNode, body: lines[index + 1].trim() });
      index += 1;
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
  resolveImportedIfs(nodes, edges, pendingIfs);

  return { nodes, edges };
}

function updateChoiceForgeSceneGraph(currentGraph: SceneGraph, content: string): SceneGraph {
  const sectionMap = splitChoiceForgeSections(content);
  const labelToNodeId = new Map(currentGraph.nodes.map((node) => [generatedNodeLabel(node.id), node.id]));
  const flowEdges: StoryEdge[] = [];
  const nodes = currentGraph.nodes.map((node) => {
    const section = sectionMap.get(generatedNodeLabel(node.id));
    if (!section) return { ...node };
    const next = updateChoiceForgeNode(node, section, labelToNodeId);
    const flowTarget = parseChoiceForgeFlowTarget(section, labelToNodeId);
    if (flowTarget && canAutoFlow(next)) flowEdges.push({ from: next.id, to: flowTarget, kind: "flow" });
    return next;
  });
  return { nodes, edges: flowEdges };
}

function hasChoiceForgeLabels(content: string): boolean {
  return /^\*label\s+cf_[a-zA-Z0-9_]+\s*$/m.test(content);
}

function splitChoiceForgeSections(content: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let currentLabel: string | null = null;
  let currentLines: string[] = [];

  content.split(/\r?\n/).forEach((line) => {
    const label = choiceForgeLabel(line);
    if (label) {
      if (currentLabel) sections.set(currentLabel, currentLines);
      currentLabel = label;
      currentLines = [];
      return;
    }
    if (currentLabel) currentLines.push(line);
  });

  if (currentLabel) sections.set(currentLabel, currentLines);
  return sections;
}

function updateChoiceForgeNode(node: StoryNode, section: string[], labelToNodeId: Map<string, string>): StoryNode {
  const topLevelSets = parseTopLevelSets(section);
  const body = parseChoiceForgeBody(section);
  const base: StoryNode = {
    ...node,
    body: body || undefined,
    sets: topLevelSets.length ? topLevelSets : undefined,
  };

  if (node.type === "label") {
    const label = section.map((line) => line.trim()).find((line) => line.startsWith("*label ") && !choiceForgeLabel(line));
    return label ? { ...base, title: `*label ${commandValue(label, "*label")}` } : base;
  }

  if (node.type === "choice") {
    const block = extractChoiceForgeCommandBlock(section, "choice");
    const parsed = block ? parseChoiceBlock(block, 1) : null;
    if (!parsed) return base;
    return {
      ...base,
      body: undefined,
      prompt: body || node.prompt,
      options: parsed.options.map((option, index) => ({
        text: option.text,
        to: labelToNodeId.get(option.targetLabel) ?? node.options?.[index]?.to ?? node.id,
        cond: option.cond ?? null,
        reuse: option.reuse,
        hideReuse: option.hideReuse,
        sets: option.sets,
      })),
    };
  }

  if (node.type === "fake_choice") {
    const block = extractChoiceForgeCommandBlock(section, "fake_choice");
    const parsed = block ? parseFakeChoiceBlock(block, 1) : null;
    return parsed ? { ...base, body: undefined, prompt: body || node.prompt, fakeOptions: parsed.fakeOptions } : base;
  }

  if (node.type === "if") {
    const block = extractChoiceForgeIfBlock(section);
    const parsed = block ? parseIfBlock(block, 1) : null;
    if (!parsed) return base;
    return {
      ...base,
      branches: parsed.branches.map((branch, index) => ({
        kind: branch.kind,
        expr: branch.expr,
        to: labelToNodeId.get(branch.targetLabel) ?? node.branches?.[index]?.to ?? node.id,
        sets: branch.sets,
      })),
    };
  }

  const commandNode = updateChoiceForgeCommandNode(base, section);
  return commandNode;
}

function updateChoiceForgeCommandNode(node: StoryNode, section: string[]): StoryNode {
  const commands = section.map((line) => line.trim()).filter((line) => line.startsWith("*"));
  const command = commands.find((line) => !choiceForgeLabel(line) && !line.startsWith("*set ") && !isChoiceForgeFlowGoto(line));
  if (!command) return node;
  const name = commandName(command);
  if (node.type === "goto_scene" && name === "goto_scene") {
    const target = normalizeIdentifier(commandValue(command, "*goto_scene"));
    return { ...node, title: `*goto_scene ${target}`, target };
  }
  if (node.type === "goto" && name === "goto") return { ...node, title: `*goto ${normalizeIdentifier(commandValue(command, "*goto"))}` };
  if (node.type === "gosub" && name === "gosub") return { ...node, title: `*gosub ${normalizeGosubValue(commandValue(command, "*gosub"))}` };
  if (node.type === "return" && name === "return") return { ...node, title: "*return" };
  if (node.type === "ending" && name === "ending") return { ...node, title: "*ending" };
  if (node.type === "finish" && name === "finish") return { ...node, title: "*finish" };
  if (node.type === "checkpoint" && name === "save_checkpoint") return { ...node, title: command };
  if (node.type === "restore_checkpoint" && name === "restore_checkpoint") return { ...node, title: command };
  if (node.type === "page_break" && name === "page_break") return { ...node, title: command };
  if (node.type === "comment" && name === "comment") return { ...node, title: "*comment", body: commands.filter((line) => line.startsWith("*comment")).map((line) => commandValue(line, "*comment")).join("\n") };
  if (node.type === "input_text" && name === "input_text") {
    const inputVar = normalizeIdentifier(commandValue(command, "*input_text"));
    return { ...node, title: `*input_text ${inputVar}`, inputVar };
  }
  if (node.type === "input_number" && name === "input_number") {
    const [inputVar, inputMin, inputMax] = commandValue(command, "*input_number").split(/\s+/);
    const normalizedInputVar = normalizeIdentifier(inputVar ?? "number");
    return { ...node, title: `*input_number ${normalizedInputVar}`, inputVar: normalizedInputVar, inputMin, inputMax };
  }
  if (node.type === "rand" && name === "rand") {
    const [inputVar, inputMin, inputMax] = commandValue(command, "*rand").split(/\s+/);
    const normalizedInputVar = normalizeIdentifier(inputVar ?? "number");
    return { ...node, title: `*rand ${normalizedInputVar}`, inputVar: normalizedInputVar, inputMin, inputMax };
  }
  if (node.type === "gosub_scene" && name === "gosub_scene") {
    const value = commandValue(command, "*gosub_scene");
    const [scenePart = "", labelPart] = value.split(/\s+/);
    const target = normalizeIdentifier(scenePart);
    return { ...node, title: `*gosub_scene ${target}`, target, body: labelPart ? normalizeIdentifier(labelPart) : undefined };
  }
  if (node.type === "image" && name === "image") {
    const value = commandValue(command, "*image");
    const [filename = "", alignment = "none", ...altParts] = value.split(/\s+/);
    return { ...node, title: `*image ${filename}`.trim(), target: filename, inputMin: alignment, prompt: altParts.join(" ").trim() || undefined };
  }
  if (node.type === "sound" && name === "sound") {
    const filename = commandValue(command, "*sound").trim().split(/\s+/)[0] ?? "";
    return { ...node, title: `*sound ${filename}`.trim(), target: filename };
  }
  if (node.type === "temp" && name === "temp") {
    const value = commandValue(command, "*temp");
    const [rawVar = "", ...restParts] = value.trim().split(/\s+/);
    const inputVar = normalizeIdentifier(rawVar || "temp_var");
    const body = restParts.join(" ").trim() || undefined;
    return { ...node, title: `*temp ${inputVar}`, inputVar, body };
  }
  if (node.type === "params" && name === "params") {
    const names = commandValue(command, "*params").trim().split(/\s+/).filter(Boolean).map(normalizeIdentifier);
    const body = names.join(" ");
    return { ...node, title: `*params${body ? ` ${body}` : ""}`, body: body || undefined };
  }
  return node;
}

function parseTopLevelSets(section: string[]): VariableSet[] {
  return section
    .filter((line) => line.startsWith("*set "))
    .map((line) => parseSet(commandValue(line.trim(), "*set")))
    .filter((set): set is VariableSet => Boolean(set));
}

function parseChoiceForgeBody(section: string[]): string {
  const bodyLines: string[] = [];
  for (const line of section) {
    const trimmed = line.trim();
    if (isChoiceForgeBodyStop(trimmed)) break;
    bodyLines.push(line);
  }
  return bodyLines.join("\n").trim();
}

function isChoiceForgeBodyStop(trimmed: string): boolean {
  if (!trimmed.startsWith("*")) return false;
  if (isChoiceForgeFlowGoto(trimmed)) return true;
  return ["*set ", "*temp ", "*params", "*choice", "*fake_choice", "*if", "*elseif", "*else", "*goto_scene", "*goto ", "*gosub", "*return", "*ending", "*finish", "*save_checkpoint", "*restore_checkpoint", "*page_break", "*comment", "*input_text", "*input_number", "*rand", "*image ", "*sound "].some((prefix) => trimmed.startsWith(prefix));
}

function extractChoiceForgeCommandBlock(section: string[], command: "choice" | "fake_choice"): string[] | null {
  const start = section.findIndex((line) => line.trim() === `*${command}`);
  if (start < 0) return null;
  const block = [section[start]];
  for (let index = start + 1; index < section.length; index += 1) {
    if (section[index].trim() && !/^\s/.test(section[index])) break;
    block.push(section[index]);
  }
  return block;
}

function extractChoiceForgeIfBlock(section: string[]): string[] | null {
  const start = section.findIndex((line) => line.trim().startsWith("*if"));
  if (start < 0) return null;
  return section.slice(start).filter((line) => !isChoiceForgeFlowGoto(line.trim()));
}

function parseChoiceForgeFlowTarget(section: string[], labelToNodeId: Map<string, string>): string | null {
  const flow = section.map((line) => line.trim()).find(isChoiceForgeFlowGoto);
  return flow ? labelToNodeId.get(commandValue(flow, "*goto")) ?? null : null;
}

function isChoiceForgeFlowGoto(line: string): boolean {
  return /^\*goto\s+cf_[a-zA-Z0-9_]+\s*$/.test(line);
}

function choiceForgeLabel(line: string): string | null {
  return line.trim().match(/^\*label\s+(cf_[a-zA-Z0-9_]+)\s*$/)?.[1] ?? null;
}

function generatedNodeLabel(id: string): string {
  return `cf_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function createSceneSummaries(sceneNames: string[], activeScene: string, sceneData: Record<string, SceneGraph>): SceneSummary[] {
  return sceneNames.map((sceneName) => ({
    id: importedSceneId(sceneName),
    name: sceneName,
    words: countWords(sceneData[sceneName]?.sourceText ?? sceneData[sceneName]?.nodes.map((node) => node.body ?? "").join("\n") ?? ""),
    nodes: sceneData[sceneName]?.nodes.length ?? 0,
    current: sceneName === activeScene,
  }));
}

function importedSceneId(sceneName: string): string {
  return sceneName === "startup" ? "scene_startup" : sceneName;
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
  if (command === "gosub") return { type: "gosub", title: `*gosub ${normalizeGosubValue(value || "subroutine")}` };
  if (command === "return") return { type: "return", title: "*return" };
  if (command === "ending") return { type: "ending", title: "*ending" };
  if (command === "finish") return { type: "finish", title: "*finish" };
  if (command === "save_checkpoint") return { type: "checkpoint", title: `*save_checkpoint ${normalizeIdentifier(value || `checkpoint_${index}`)}` };
  if (command === "restore_checkpoint") return { type: "restore_checkpoint", title: `*restore_checkpoint ${value ? normalizeIdentifier(value) : ""}`.trimEnd() };
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
  if (command === "temp") {
    const [rawVar = "", ...restParts] = value.trim().split(/\s+/);
    const inputVar = normalizeIdentifier(rawVar || "temp_var");
    const initial = restParts.join(" ").trim();
    return { type: "temp", title: `*temp ${inputVar}`, inputVar, body: initial || undefined };
  }
  if (command === "params") {
    const names = value.trim().split(/\s+/).filter(Boolean).map(normalizeIdentifier);
    const body = names.join(" ");
    return { type: "params", title: `*params${body ? ` ${body}` : ""}`, body: body || undefined, w: 280 };
  }
  if (command === "gosub_scene") {
    const [scenePart = "scene", labelPart] = value.trim().split(/\s+/);
    const target = normalizeIdentifier(scenePart);
    return { type: "gosub_scene", title: `*gosub_scene ${target}`, target, body: labelPart ? normalizeIdentifier(labelPart) : undefined };
  }
  if (command === "image") {
    const [filename = "", alignment = "none", ...altParts] = value.trim().split(/\s+/);
    const alt = altParts.join(" ").trim();
    return { type: "image", title: `*image ${filename}`.trim(), target: filename, inputMin: alignment, prompt: alt || undefined };
  }
  if (command === "sound") {
    const filename = value.trim().split(/\s+/)[0] ?? "";
    return { type: "sound", title: `*sound ${filename}`.trim(), target: filename };
  }
  if (command === "set") {
    const parsed = parseSet(value);
    return parsed ? { type: "set", title: `*set ${parsed.var}`, sets: [parsed] } : null;
  }
  if (command === "achieve") {
    const id = normalizeIdentifier(value.trim().split(/\s+/)[0] ?? "");
    return id ? { type: "achieve", title: `*achieve ${id}`, target: id } : null;
  }
  return null;
}

function parseSet(value: string): VariableSet | null {
  const [variable, maybeOp, ...rest] = value.trim().split(/\s+/);
  if (!variable || !maybeOp) return null;
  const normalizedVariable = normalizeIdentifier(variable);
  if (["=", "+", "-", "%+", "%-"].includes(maybeOp)) {
    const setValue = rest.join(" ").trim();
    return setValue ? { var: normalizedVariable, op: maybeOp as VariableSet["op"], val: setValue } : null;
  }
  return { var: normalizedVariable, op: "=", val: [maybeOp, ...rest].join(" ").trim() };
}

function normalizeGosubValue(value: string): string {
  const [target = "subroutine", ...args] = value.trim().split(/\s+/);
  return [normalizeIdentifier(target), ...args].join(" ").trim();
}

function isComplexCommand(command: string): boolean {
  return ["elseif", "else", "selectable_if"].includes(command);
}

function canAutoFlow(node: StoryNode): boolean {
  if (["choice", "if", "ending", "finish", "goto", "goto_scene", "return", "restore_checkpoint"].includes(node.type)) return false;
  if (node.body?.trim().match(/^\*(choice|fake_choice|if|elseif|else|selectable_if)\b/i)) return false;
  return true;
}

interface ImportedChoiceOption {
  text: string;
  targetLabel: string;
  cond?: ChoiceCondition | null;
  reuse?: ChoiceReuse;
  hideReuse?: boolean;
  sets: VariableSet[];
}

interface ImportedConditionalBranch {
  kind: ConditionalBranch["kind"];
  expr?: string;
  targetLabel: string;
  sets: VariableSet[];
}

interface InlineConditionalBranch {
  kind: ConditionalBranch["kind"];
  expr?: string;
  bodyLines: string[];
  sets: VariableSet[];
}

interface InlineChoiceOption {
  text: string;
  cond?: ChoiceCondition | null;
  reuse?: ChoiceReuse;
  hideReuse?: boolean;
  bodyLines: string[];
  sets: VariableSet[];
}

type ImportedNodeDraft = Omit<StoryNode, "id" | "x" | "y" | "w"> & { w?: number };

function collectIndentedBlock(lines: string[], startIndex: number): string[] {
  const block = [lines[startIndex]];
  let index = startIndex;
  while (index + 1 < lines.length && (/^\s/.test(lines[index + 1]) || !lines[index + 1].trim())) {
    index += 1;
    block.push(lines[index]);
  }
  return block;
}

function collectIfChain(lines: string[], startIndex: number): string[] {
  const block = collectIndentedBlock(lines, startIndex);
  let index = startIndex + block.length;
  while (index < lines.length) {
    if (!lines[index].trim()) {
      block.push(lines[index]);
      index += 1;
      continue;
    }
    const command = commandName(lines[index]);
    if (/^\s/.test(lines[index]) || (command !== "elseif" && command !== "else")) break;
    const branchBlock = collectIndentedBlock(lines, index);
    block.push(...branchBlock);
    index += branchBlock.length;
  }
  return block;
}

function parseChoiceBlock(block: string[], index: number): { node: Omit<StoryNode, "id" | "x" | "y" | "w"> & { w?: number }; options: ImportedChoiceOption[] } | null {
  const options: ImportedChoiceOption[] = [];
  let current: ImportedChoiceOption | null = null;
  let guardCond: ChoiceCondition | null = null;

  for (const line of block.slice(1)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const indent = line.length - line.trimStart().length;
    const isTopLevel = indent <= 3;

    if (isTopLevel && /^\*(if|elseif)\s/i.test(trimmed)) {
      if (current) { options.push(current); current = null; }
      const m = trimmed.match(/^\*(if|elseif)\s+\((.+)\)$/i);
      if (!m) return null;
      guardCond = { type: "if", expr: normalizeExpressionIdentifiers(m[2].trim()) };
      continue;
    }
    if (isTopLevel && /^\*else$/i.test(trimmed)) {
      if (current) { options.push(current); current = null; }
      guardCond = null;
      continue;
    }

    const header = parseChoiceHeader(trimmed);
    if (header) {
      if (current) options.push(current);
      current = { ...header, cond: header.cond ?? (!isTopLevel ? guardCond : null), targetLabel: "", sets: [] };
      if (isTopLevel) guardCond = null;
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

function parseInlineChoiceBlock(block: string[], index: number): { node: ImportedNodeDraft; options: InlineChoiceOption[] } | null {
  const options: InlineChoiceOption[] = [];
  let current: InlineChoiceOption | null = null;
  let currentIsDeep = false;
  let guardCond: ChoiceCondition | null = null;
  let guardActive = false;

  for (const line of block.slice(1)) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) current.bodyLines.push("");
      continue;
    }
    const indent = line.length - line.trimStart().length;
    const isTopLevel = indent <= 3;

    if (isTopLevel && /^\*(if|elseif)\s/i.test(trimmed) && !trimmed.includes("#")) {
      if (current) { options.push(cleanInlineOption(current)); current = null; }
      const m = trimmed.match(/^\*(if|elseif)\s+\((.+)\)$/i);
      if (!m) return null;
      guardCond = { type: "if", expr: normalizeExpressionIdentifiers(m[2].trim()) };
      guardActive = true;
      currentIsDeep = false;
      continue;
    }
    if (isTopLevel && /^\*else$/i.test(trimmed)) {
      if (current) { options.push(cleanInlineOption(current)); current = null; }
      guardCond = null;
      guardActive = true;
      currentIsDeep = false;
      continue;
    }

    const header = parseChoiceHeader(trimmed);
    const isNormalHeader = header && isChoiceOptionHeaderLine(line);
    const isDeepHeader = header && guardActive && !isTopLevel;

    if (isNormalHeader || isDeepHeader) {
      if (current) options.push(cleanInlineOption(current));
      const isDeep = !!isDeepHeader;
      current = { ...header, cond: header.cond ?? (isDeep ? guardCond : null), bodyLines: [], sets: [] };
      currentIsDeep = isDeep;
      if (isNormalHeader) { guardCond = null; guardActive = false; }
      continue;
    }

    if (!current) return null;
    const bodyLine = currentIsDeep
      ? removeChoiceOptionIndent(removeChoiceOptionIndent(line))
      : removeChoiceOptionIndent(line);
    const bodyCommand = commandName(bodyLine);
    if (bodyCommand === "set") {
      const set = parseSet(commandValue(bodyLine.trim(), "*set"));
      if (set) current.sets.push(set);
      continue;
    }
    current.bodyLines.push(bodyLine);
  }

  if (current) options.push(cleanInlineOption(current));
  if (!options.length || options.some((option) => !option.bodyLines.length && !option.sets.length)) return null;

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

function parseFakeChoiceBlock(block: string[], index: number): (Omit<StoryNode, "id" | "x" | "y" | "w"> & { w?: number }) | null {
  const options: FakeChoiceOption[] = [];
  let current: FakeChoiceOption | null = null;
  let guardCond: ChoiceCondition | null = null;

  for (const line of block.slice(1)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const indent = line.length - line.trimStart().length;
    const isTopLevel = indent <= 3;

    if (isTopLevel && /^\*(if|elseif)\s/i.test(trimmed) && !trimmed.includes("#")) {
      if (current) { options.push(current); current = null; }
      const m = trimmed.match(/^\*(if|elseif)\s+\((.+)\)$/i);
      if (!m) return null;
      guardCond = { type: "if", expr: normalizeExpressionIdentifiers(m[2].trim()) };
      continue;
    }
    if (isTopLevel && /^\*else$/i.test(trimmed)) {
      if (current) { options.push(current); current = null; }
      guardCond = null;
      continue;
    }

    const header = parseChoiceHeader(trimmed);
    if (header) {
      if (current) options.push(current);
      current = { text: header.text, cond: header.cond ?? (!isTopLevel ? guardCond : null), reuse: header.reuse, hideReuse: header.hideReuse, sets: [] };
      if (isTopLevel) guardCond = null;
      continue;
    }
    if (!current) return null;
    if (trimmed.startsWith("*set ")) {
      const set = parseSet(commandValue(trimmed, "*set"));
      if (set) current.sets = [...(current.sets ?? []), set];
      continue;
    }
    if (trimmed.startsWith("*comment")) continue;
    return null;
  }

  if (current) options.push(current);
  if (!options.length) return null;
  return {
    type: "fake_choice",
    title: `imported_fake_choice_${index}`,
    prompt: "Choose:",
    fakeOptions: options,
    w: 360,
  };
}

function parseInlineFakeChoiceBlock(block: string[], index: number): (Omit<StoryNode, "id" | "x" | "y" | "w"> & { w?: number }) | null {
  const options: FakeChoiceOption[] = [];
  let current: { option: FakeChoiceOption; bodyLines: string[] } | null = null;
  let currentIsDeep = false;
  let guardCond: ChoiceCondition | null = null;
  let guardActive = false;

  for (const line of block.slice(1)) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) current.bodyLines.push("");
      continue;
    }
    const indent = line.length - line.trimStart().length;
    const isTopLevel = indent <= 3;

    if (isTopLevel && /^\*(if|elseif)\s/i.test(trimmed) && !trimmed.includes("#")) {
      if (current) { options.push(flushInlineFakeOption(current)); current = null; }
      const m = trimmed.match(/^\*(if|elseif)\s+\((.+)\)$/i);
      if (!m) return null;
      guardCond = { type: "if", expr: normalizeExpressionIdentifiers(m[2].trim()) };
      guardActive = true;
      currentIsDeep = false;
      continue;
    }
    if (isTopLevel && /^\*else$/i.test(trimmed)) {
      if (current) { options.push(flushInlineFakeOption(current)); current = null; }
      guardCond = null;
      guardActive = true;
      currentIsDeep = false;
      continue;
    }

    const header = parseChoiceHeader(trimmed);
    const isNormalHeader = header && isChoiceOptionHeaderLine(line);
    const isDeepHeader = header && guardActive && !isTopLevel;

    if (isNormalHeader || isDeepHeader) {
      if (current) options.push(flushInlineFakeOption(current));
      const isDeep = !!isDeepHeader;
      current = { option: { text: header.text, cond: header.cond ?? (isDeep ? guardCond : null), reuse: header.reuse, hideReuse: header.hideReuse, sets: [] }, bodyLines: [] };
      currentIsDeep = isDeep;
      if (isNormalHeader) { guardCond = null; guardActive = false; }
      continue;
    }

    if (!current) return null;
    const bodyLine = currentIsDeep
      ? removeChoiceOptionIndent(removeChoiceOptionIndent(line))
      : removeChoiceOptionIndent(line);
    const bodyCommand = commandName(bodyLine);
    if (bodyCommand === "set") {
      const set = parseSet(commandValue(bodyLine.trim(), "*set"));
      if (set) current.option.sets = [...(current.option.sets ?? []), set];
      continue;
    }
    if (bodyCommand === "comment") continue;
    current.bodyLines.push(bodyLine);
  }

  if (current) options.push(flushInlineFakeOption(current));
  if (!options.length || options.every((opt) => !opt.body)) return null;
  return {
    type: "fake_choice",
    title: `imported_fake_choice_${index}`,
    prompt: "Choose:",
    fakeOptions: options,
    w: 360,
  };
}

function flushInlineFakeOption(current: { option: FakeChoiceOption; bodyLines: string[] }): FakeChoiceOption {
  const firstContent = current.bodyLines.findIndex((line) => line.trim());
  let lastContent = -1;
  for (let i = current.bodyLines.length - 1; i >= 0; i -= 1) {
    if (current.bodyLines[i].trim()) { lastContent = i; break; }
  }
  const trimmed = firstContent >= 0 ? current.bodyLines.slice(firstContent, lastContent + 1) : [];
  const body = trimmed.join("\n").trim() || undefined;
  return { ...current.option, body };
}

function parseIfBlock(block: string[], index: number): { node: Omit<StoryNode, "id" | "x" | "y" | "w"> & { w?: number }; branches: ImportedConditionalBranch[] } | null {
  const branches: ImportedConditionalBranch[] = [];
  let current: ImportedConditionalBranch | null = null;

  for (const line of block) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const branchHeader = parseIfHeader(trimmed);
    if (branchHeader) {
      if (current) branches.push(current);
      current = { ...branchHeader, targetLabel: "", sets: [] };
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

  if (current) branches.push(current);
  if (!branches.length || branches.some((branch) => !branch.targetLabel)) return null;
  if (branches[0]?.kind !== "if") return null;

  return {
    node: {
      type: "if",
      title: `imported_if_${index}`,
      branches: [],
      w: 320,
    },
    branches,
  };
}

function parseInlineIfBlock(block: string[], index: number): { node: ImportedNodeDraft; branches: InlineConditionalBranch[] } | null {
  const branches: InlineConditionalBranch[] = [];
  let current: InlineConditionalBranch | null = null;

  for (const line of block) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) current.bodyLines.push("");
      continue;
    }
    const branchHeader = parseIfHeader(trimmed);
    if (branchHeader && !/^\s/.test(line)) {
      if (current) branches.push(cleanInlineBranch(current));
      current = { ...branchHeader, bodyLines: [], sets: [] };
      continue;
    }
    if (!current) return null;
    const bodyLine = removeOneIndent(line);
    const bodyCommand = commandName(bodyLine);
    if (bodyCommand === "set") {
      const set = parseSet(commandValue(bodyLine.trim(), "*set"));
      if (set) current.sets.push(set);
      continue;
    }
    current.bodyLines.push(bodyLine);
  }

  if (current) branches.push(cleanInlineBranch(current));
  if (!branches.length || branches[0]?.kind !== "if") return null;

  return {
    node: {
      type: "if",
      title: `imported_if_${index}`,
      branches: [],
      w: 320,
    },
    branches,
  };
}

const BODY_TERMINAL_COMMANDS = new Set(["goto", "goto_scene", "return", "restore_checkpoint", "finish", "ending"]);
const BODY_STRUCTURED_COMMANDS = new Set(["gosub", "gosub_scene", "page_break", "rand", "input_text", "input_number", "save_checkpoint", "temp", "image", "sound", "achieve"]);

function buildBodyNodeChain(
  bodyLines: string[],
  titlePrefix: string,
  addNode: (node: ImportedNodeDraft, autoFlow?: boolean) => StoryNode,
  edges: StoryEdge[],
): { firstId: string | null; lastId: string | null; pendingLastIds: string[]; hasTerminal: boolean } {
  let proseBuf: string[] = [];
  let prevId: string | null = null;
  let firstId: string | null = null;
  let hasTerminal = false;
  const pendingLinks: string[] = [];

  const linkAll = (newId: string) => {
    if (prevId) edges.push({ from: prevId, to: newId, kind: "flow" });
    for (const id of pendingLinks) edges.push({ from: id, to: newId, kind: "flow" });
    pendingLinks.length = 0;
    if (!firstId) firstId = newId;
    prevId = newId;
  };

  const flushProse = () => {
    const text = proseBuf.join("\n").trim();
    proseBuf = [];
    if (!text) return;
    const n = addNode({ type: "passage", title: `${titlePrefix}_body`, body: text, w: 420 }, false);
    linkAll(n.id);
  };

  let i = 0;
  while (i < bodyLines.length) {
    const line = bodyLines[i];
    const trimmed = line.trim();
    i += 1;
    if (!trimmed) { proseBuf.push(""); continue; }
    const command = commandName(trimmed);
    if (command === "comment") continue;

    if (command && BODY_TERMINAL_COMMANDS.has(command)) {
      flushProse();
      const termNode = simpleCommandNode(command, trimmed, 1);
      if (termNode) { const n = addNode(termNode, false); linkAll(n.id); }
      hasTerminal = true;
      break;
    }

    if (command === "choice" || command === "fake_choice") {
      flushProse();
      const block = [line];
      while (i < bodyLines.length && (/^\s/.test(bodyLines[i]) || !bodyLines[i].trim())) {
        block.push(bodyLines[i]);
        i += 1;
      }
      if (command === "choice") {
        const parsed = parseInlineChoiceBlock(block, 1);
        if (parsed) {
          const choiceNode = addNode(parsed.node, false);
          linkAll(choiceNode.id);
          const optTargets = parsed.options.map((opt) => addInlineOptionNodes(opt, addNode, edges));
          const options: ChoiceOption[] = parsed.options.map((opt, idx) => ({
            text: opt.text,
            to: optTargets[idx].targetId,
            body: optTargets[idx].body,
            cond: opt.cond ?? null,
            reuse: opt.reuse,
            hideReuse: opt.hideReuse,
            sets: opt.sets.length ? opt.sets : undefined,
          }));
          choiceNode.options = options;
          options.forEach((opt, idx) => {
            edges.push({ from: choiceNode.id, to: opt.to, kind: "choice", label: `#${idx + 1}${opt.cond ? ` *${opt.cond.type}` : ""}` });
          });
          prevId = null;
          pendingLinks.length = 0;
          optTargets.forEach((t) => { if (t.continuationId) pendingLinks.push(t.continuationId); });
        } else {
          proseBuf.push(...block);
        }
      } else {
        const parsed = parseFakeChoiceBlock(block, 1) ?? parseInlineFakeChoiceBlock(block, 1);
        if (parsed) {
          const n = addNode(parsed, false);
          linkAll(n.id);
        } else {
          proseBuf.push(...block);
        }
      }
      continue;
    }

    if (command === "if") {
      flushProse();
      const block = [line];
      while (i < bodyLines.length && (/^\s/.test(bodyLines[i]) || !bodyLines[i].trim())) {
        block.push(bodyLines[i]);
        i += 1;
      }
      while (i < bodyLines.length) {
        const nextCmd = commandName(bodyLines[i].trim());
        if (nextCmd !== "elseif" && nextCmd !== "else") break;
        block.push(bodyLines[i]);
        i += 1;
        while (i < bodyLines.length && (/^\s/.test(bodyLines[i]) || !bodyLines[i].trim())) {
          block.push(bodyLines[i]);
          i += 1;
        }
      }
      const inlineIf = parseInlineIfBlock(block, 1);
      if (inlineIf) {
        const ifNode = addNode(inlineIf.node, false);
        linkAll(ifNode.id);
        const branchTargets = inlineIf.branches.map((branch) => addInlineBranchNodes(branch, addNode, edges));
        const branches = inlineIf.branches.map((branch, idx) => ({
          kind: branch.kind,
          expr: branch.expr,
          to: branchTargets[idx].targetId,
          sets: branch.sets.length ? branch.sets : undefined,
        }));
        ifNode.branches = branches;
        branches.forEach((branch) => {
          edges.push({ from: ifNode.id, to: branch.to, kind: branch.kind, label: branch.kind === "else" ? "*else" : `*${branch.kind}` });
        });
        prevId = null;
        pendingLinks.length = 0;
        branchTargets.forEach((t) => { if (t.continuationId) pendingLinks.push(t.continuationId); });
      } else {
        proseBuf.push(...block);
      }
      continue;
    }

    if (command && BODY_STRUCTURED_COMMANDS.has(command)) {
      flushProse();
      const cmdNode = simpleCommandNode(command, trimmed, 1);
      if (cmdNode) { const n = addNode(cmdNode, false); linkAll(n.id); }
      continue;
    }

    proseBuf.push(line);
  }

  flushProse();
  return { firstId, lastId: prevId, pendingLastIds: [...pendingLinks], hasTerminal };
}

function mergeBodyContinuations(
  firstId: string,
  lastId: string | null,
  pendingLastIds: string[],
  hasTerminal: boolean,
  titlePrefix: string,
  addNode: (node: ImportedNodeDraft, autoFlow?: boolean) => StoryNode,
  edges: StoryEdge[],
): { targetId: string; continuationId: string | null } {
  const all = [...(lastId && !hasTerminal ? [lastId] : []), ...pendingLastIds];
  if (all.length === 0) return { targetId: firstId, continuationId: null };
  if (all.length === 1) return { targetId: firstId, continuationId: all[0] };
  const merge = addNode({ type: "passage", title: `${titlePrefix}_merge`, body: "", w: 320 }, false);
  all.forEach((id) => edges.push({ from: id, to: merge.id, kind: "flow" }));
  return { targetId: firstId, continuationId: merge.id };
}

function addInlineBranchNodes(
  branch: InlineConditionalBranch,
  addNode: (node: ImportedNodeDraft, autoFlow?: boolean) => StoryNode,
  edges: StoryEdge[],
): { targetId: string; continuationId: string | null } {
  const { firstId, lastId, pendingLastIds, hasTerminal } = buildBodyNodeChain(branch.bodyLines, `if_${branch.kind}`, addNode, edges);
  if (!firstId) {
    const emptyNode = addNode({ type: "passage", title: `if_${branch.kind}_empty`, body: "", w: 320 }, false);
    return { targetId: emptyNode.id, continuationId: emptyNode.id };
  }
  return mergeBodyContinuations(firstId, lastId, pendingLastIds, hasTerminal, `if_${branch.kind}`, addNode, edges);
}

function addInlineOptionNodes(
  option: InlineChoiceOption,
  addNode: (node: ImportedNodeDraft, autoFlow?: boolean) => StoryNode,
  edges: StoryEdge[],
): { targetId: string; continuationId: string | null; body?: string } {
  const isPureProse = option.bodyLines.every((line) => {
    const cmd = commandName(line.trim());
    return !cmd || (!BODY_TERMINAL_COMMANDS.has(cmd) && !BODY_STRUCTURED_COMMANDS.has(cmd) && cmd !== "comment" && cmd !== "choice" && cmd !== "fake_choice" && cmd !== "if");
  });

  if (isPureProse) {
    const bodyText = option.bodyLines.join("\n").trim();
    if (bodyText) {
      const emptyNode = addNode({ type: "passage", title: "choice_option_empty", body: "", w: 320 }, false);
      return { targetId: emptyNode.id, continuationId: emptyNode.id, body: bodyText };
    }
  }

  const { firstId, lastId, pendingLastIds, hasTerminal } = buildBodyNodeChain(option.bodyLines, "choice_option", addNode, edges);
  if (!firstId) {
    const emptyNode = addNode({ type: "passage", title: "choice_option_empty", body: "", w: 320 }, false);
    return { targetId: emptyNode.id, continuationId: emptyNode.id };
  }
  return mergeBodyContinuations(firstId, lastId, pendingLastIds, hasTerminal, "choice_option", addNode, edges);
}

function cleanInlineBranch(branch: InlineConditionalBranch): InlineConditionalBranch {
  const firstContent = branch.bodyLines.findIndex((line) => line.trim());
  let lastContent = -1;
  for (let index = branch.bodyLines.length - 1; index >= 0; index -= 1) {
    if (branch.bodyLines[index].trim()) {
      lastContent = index;
      break;
    }
  }
  return {
    ...branch,
    bodyLines: firstContent >= 0 ? branch.bodyLines.slice(firstContent, lastContent + 1) : [],
  };
}

function cleanInlineOption(option: InlineChoiceOption): InlineChoiceOption {
  const firstContent = option.bodyLines.findIndex((line) => line.trim());
  let lastContent = -1;
  for (let index = option.bodyLines.length - 1; index >= 0; index -= 1) {
    if (option.bodyLines[index].trim()) {
      lastContent = index;
      break;
    }
  }
  return {
    ...option,
    bodyLines: firstContent >= 0 ? option.bodyLines.slice(firstContent, lastContent + 1) : [],
  };
}

function removeOneIndent(line: string): string {
  return line.replace(/^( {2}|\t)/, "");
}

function removeChoiceOptionIndent(line: string): string {
  return line.replace(/^( {4}|\t\t| {2}|\t)/, "");
}

function isChoiceOptionHeaderLine(line: string): boolean {
  return /^\s{1,3}(#|\*(hide|disable|allow)_reuse\b|\*(selectable_if|if)\b)/i.test(line);
}

function parseIfHeader(trimmed: string): Pick<ImportedConditionalBranch, "kind" | "expr"> | null {
  const conditional = trimmed.match(/^\*if\s+\(?(.+?)\)?$/i);
  if (conditional) return { kind: "if", expr: normalizeExpressionIdentifiers(stripOuterParens(conditional[1].trim())) };

  const elseif = trimmed.match(/^\*elseif\s+\(?(.+?)\)?$/i);
  if (elseif) return { kind: "elseif", expr: normalizeExpressionIdentifiers(stripOuterParens(elseif[1].trim())) };

  if (/^\*else$/i.test(trimmed)) return { kind: "else" };
  return null;
}

function parseChoiceHeader(trimmed: string): Pick<ImportedChoiceOption, "text" | "cond" | "reuse" | "hideReuse"> | null {
  const reuse = trimmed.match(/^\*(hide|disable|allow)_reuse\s+(.+)$/i);
  const reuseMode = reuse?.[1]?.toLowerCase() as ChoiceReuse | undefined;
  const optionText = reuse?.[2]?.trim() ?? trimmed;

  if (optionText.startsWith("#")) return { text: optionText.replace(/^#+/, "").trim(), cond: null, reuse: reuseMode, hideReuse: reuseMode === "hide" };

  const selectable = optionText.match(/^\*selectable_if\s+\((.+)\)\s+#(.+)$/i);
  if (selectable) return { text: selectable[2].trim(), cond: { type: "selectable_if", expr: normalizeExpressionIdentifiers(selectable[1].trim()) }, reuse: reuseMode, hideReuse: reuseMode === "hide" };

  const conditional = optionText.match(/^\*if\s+\((.+)\)\s+#(.+)$/i);
  if (conditional) return { text: conditional[2].trim(), cond: { type: "if", expr: normalizeExpressionIdentifiers(conditional[1].trim()) }, reuse: reuseMode, hideReuse: reuseMode === "hide" };

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
          reuse: option.reuse,
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

function resolveImportedIfs(nodes: StoryNode[], edges: StoryEdge[], pendingIfs: Array<{ nodeId: string; branches: ImportedConditionalBranch[]; rawBlock: string }>) {
  if (!pendingIfs.length) return;
  const labels = labelMap(nodes);

  pendingIfs.forEach(({ nodeId, branches, rawBlock }) => {
    const node = nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    const resolvedBranches = branches
      .map((branch): ConditionalBranch | null => {
        const target = labels.get(branch.targetLabel);
        if (!target) return null;
        return {
          kind: branch.kind,
          expr: branch.expr,
          to: target,
          sets: branch.sets,
        };
      })
      .filter((branch): branch is ConditionalBranch => Boolean(branch));
    if (resolvedBranches.length !== branches.length) {
      Object.assign(node, {
        type: "passage",
        title: `if_block_${node.id}`,
        body: rawBlock,
        branches: undefined,
        w: 500,
      });
      return;
    }
    node.branches = resolvedBranches;
    resolvedBranches.forEach((branch) => {
      edges.push({
        from: node.id,
        to: branch.to,
        kind: branch.kind,
        label: branch.kind === "else" ? "*else" : `*${branch.kind}`,
      });
    });
  });
}

function labelMap(nodes: StoryNode[]): Map<string, string> {
  return new Map(
    nodes
      .filter((node) => node.type === "label")
      .map((node) => [normalizeIdentifier(commandValue(node.title, "*label")), node.id]),
  );
}

function stripOuterParens(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) return trimmed.slice(1, -1).trim();
  return trimmed;
}

function normalizeExpressionIdentifiers(expression: string): string {
  const reserved = new Set(["and", "or", "not", "true", "false"]);
  return expression.replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|[a-zA-Z_][a-zA-Z0-9_-]*/g, (match) => {
    if (match.startsWith("\"") || match.startsWith("'")) return match;
    const lower = match.toLowerCase();
    return reserved.has(lower) ? lower : normalizeIdentifier(match);
  });
}

function defaultImportedWidth(type: NodeType): number {
  if (type === "passage") return 340;
  if (["goto_scene", "checkpoint", "restore_checkpoint", "page_break", "comment", "input_text", "input_number", "rand", "gosub_scene", "image", "sound", "temp", "params"].includes(type)) return 280;
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
