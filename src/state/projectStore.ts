import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sampleProjects } from "../data/sampleProject";
import { lintProject } from "../domain/choicescript";
import type { AchievementSummary, AssetSummary, ChoiceForgeProject, Language, NodeType, SceneGraph, SceneSummary, StoryEdge, StoryNode, VariableSummary } from "../domain/types";

const STORAGE_KEY = "choiceforge.project.v2";
const HISTORY_LIMIT = 50;

function cloneProject(project: ChoiceForgeProject): ChoiceForgeProject {
  return structuredClone(project);
}

function loadInitialProject(): ChoiceForgeProject {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return commitProject(hydrateProject(cloneProject(sampleProjects.en)));

  try {
    return commitProject(hydrateProject(JSON.parse(saved) as ChoiceForgeProject));
  } catch {
    return commitProject(hydrateProject(cloneProject(sampleProjects.en)));
  }
}

export interface ProjectActions {
  canUndo: boolean;
  undo: () => void;
  setProject: (project: ChoiceForgeProject) => void;
  resetProject: (language: Language) => ChoiceForgeProject;
  selectScene: (id: string) => void;
  updateNode: (id: string, patch: Partial<StoryNode>) => void;
  moveNode: (id: string, x: number, y: number) => void;
  layoutNodes: () => void;
  addNode: (type: NodeType, id: string, position: { x: number; y: number }) => void;
  deleteNode: (id: string) => void;
  connectNodes: (from: string, to: string) => void;
  addFlowEdge: (from: string, to: string) => void;
  deleteFlowEdge: (from: string, to: string) => void;
  addScene: () => void;
  updateScene: (id: string, patch: Partial<SceneSummary>) => void;
  duplicateScene: (id: string) => void;
  deleteScene: (id: string) => void;
  addVariable: () => void;
  updateVariable: (name: string, patch: Partial<VariableSummary>) => void;
  addAchievement: () => void;
  updateAchievement: (id: string, patch: Partial<AchievementSummary>) => void;
  deleteAchievement: (id: string) => void;
  addAsset: () => void;
  updateAsset: (id: string, patch: Partial<AssetSummary>) => void;
  deleteAsset: (id: string) => void;
}

export function useProjectStore() {
  const [project, setProjectState] = useState(loadInitialProject);
  const [historyLength, setHistoryLength] = useState(0);
  const historyRef = useRef<ChoiceForgeProject[]>([]);

  const pushHistory = useCallback((snapshot: ChoiceForgeProject) => {
    const nextHistory = [...historyRef.current, cloneProject(snapshot)].slice(-HISTORY_LIMIT);
    historyRef.current = nextHistory;
    setHistoryLength(nextHistory.length);
  }, []);

  const setTrackedProjectState = useCallback((updater: ChoiceForgeProject | ((current: ChoiceForgeProject) => ChoiceForgeProject)) => {
    setProjectState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      if (next === current) return current;
      pushHistory(current);
      return next;
    });
  }, [pushHistory]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    }, 400);

    return () => window.clearTimeout(handle);
  }, [project]);

  const lintedProject = useMemo(() => ({ ...project, lints: lintProject(project) }), [project]);

  const actions = useMemo<ProjectActions>(() => ({
    canUndo: historyLength > 0,
    undo: () => {
      const previous = historyRef.current.at(-1);
      if (!previous) return;
      const nextHistory = historyRef.current.slice(0, -1);
      historyRef.current = nextHistory;
      setHistoryLength(nextHistory.length);
      const restored = commitProject(hydrateProject(cloneProject(previous)));
      setProjectState(restored);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
    },
    setProject: (nextProject) => {
      const syncedProject = commitProject(hydrateProject(nextProject));
      setTrackedProjectState(syncedProject);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(syncedProject));
    },
    resetProject: (language) => {
      const fresh = commitProject(hydrateProject(cloneProject(sampleProjects[language])));
      setTrackedProjectState(fresh);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    },
    selectScene: (id) => {
      setTrackedProjectState((current) => {
        const saved = commitProject(current);
        const scene = current.scenes.find((candidate) => candidate.id === id);
        if (!scene || scene.isStart || scene.special) return current;
        const graph = saved.sceneData?.[scene.name] ?? createEmptySceneGraph(scene.name);
        return commitProject({
          ...saved,
          sceneTitle: scene.name,
          sceneSubtitle: `${scene.name}.txt - ${scene.words.toLocaleString()} words`,
          scenes: saved.scenes.map((candidate) => ({ ...candidate, current: candidate.id === id })),
          nodes: graph.nodes,
          edges: graph.edges,
        });
      });
    },
    updateNode: (id, patch) => {
      setTrackedProjectState((current) => commitProject({
        ...current,
        nodes: current.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
      }));
    },
    moveNode: (id, x, y) => {
      setTrackedProjectState((current) => commitProject({
        ...current,
        nodes: current.nodes.map((node) => (node.id === id ? { ...node, x, y } : node)),
      }));
    },
    layoutNodes: () => {
      setTrackedProjectState((current) => commitProject({
        ...current,
        nodes: layoutStoryNodes(current),
      }));
    },
    addNode: (type, id, position) => {
      setTrackedProjectState((current) => {
        if (current.nodes.some((node) => node.id === id)) return current;
        const node = createStoryNode(type, id, position, current);
        return commitProject({
          ...current,
          nodes: [...current.nodes, node],
          scenes: current.scenes.map((scene) => (
            scene.name === current.sceneTitle ? { ...scene, nodes: scene.nodes + 1 } : scene
          )),
        });
      });
    },
    deleteNode: (id) => {
      setTrackedProjectState((current) => {
        if (current.nodes.length <= 1) return current;
        const nodes = current.nodes.filter((node) => node.id !== id);
        if (nodes.length === current.nodes.length) return current;

        return commitProject({
          ...current,
          nodes: nodes.map((node) => ({
            ...node,
            options: node.options?.filter((option) => option.to !== id),
            branches: node.branches?.filter((branch) => branch.to !== id),
          })),
          edges: current.edges.filter((edge) => edge.from !== id && edge.to !== id),
          scenes: current.scenes.map((scene) => (
            scene.name === current.sceneTitle ? { ...scene, nodes: Math.max(0, scene.nodes - 1) } : scene
          )),
        });
      });
    },
    connectNodes: (from, to) => {
      setTrackedProjectState((current) => {
        const source = current.nodes.find((node) => node.id === from);
        const target = current.nodes.find((node) => node.id === to);
        if (!source || !target || from === to) return current;

        if (source.type === "choice") {
          if (source.options?.some((option) => option.to === to)) return current;
          return commitProject({
            ...current,
            nodes: current.nodes.map((node) => (
              node.id === from
                ? { ...node, options: [...(node.options ?? []), { text: `Go to ${target.title}`, to, cond: null }] }
                : node
            )),
          });
        }

        if (source.type === "if") {
          if (source.branches?.some((branch) => branch.to === to)) return current;
          const branches = source.branches ?? [];
          const elseIndex = branches.findIndex((branch) => branch.kind === "else");
          const nextBranch = branches.length === 0
            ? { kind: "if" as const, expr: "true", to }
            : elseIndex >= 0
              ? { kind: "elseif" as const, expr: "true", to }
              : { kind: "else" as const, to };
          const nextBranches = elseIndex >= 0
            ? [...branches.slice(0, elseIndex), nextBranch, ...branches.slice(elseIndex)]
            : [...branches, nextBranch];
          return commitProject({
            ...current,
            nodes: current.nodes.map((node) => (
              node.id === from
                ? { ...node, branches: nextBranches }
                : node
            )),
          });
        }

        return addFlowEdgeToProject(current, from, to);
      });
    },
    addFlowEdge: (from, to) => {
      setTrackedProjectState((current) => addFlowEdgeToProject(current, from, to));
    },
    deleteFlowEdge: (from, to) => {
      setTrackedProjectState((current) => commitProject({
        ...current,
        edges: current.edges.filter((edge) => !(edge.from === from && edge.to === to && edge.kind === "flow")),
      }));
    },
    addScene: () => {
      setTrackedProjectState((current) => {
        const saved = commitProject(current);
        const name = nextAvailableName("new_scene", new Set(current.scenes.map((scene) => scene.name)));
        const graph = createEmptySceneGraph(name);
        const scene: SceneSummary = { id: name, name, words: countSceneWords(graph.nodes), nodes: graph.nodes.length, current: true };
        return commitProject({
          ...saved,
          sceneTitle: name,
          sceneSubtitle: `${name}.txt - ${scene.words.toLocaleString()} words`,
          scenes: [...saved.scenes.map((candidate) => ({ ...candidate, current: false })), scene],
          nodes: graph.nodes,
          edges: graph.edges,
          sceneData: { ...(saved.sceneData ?? {}), [name]: graph },
        });
      });
    },
    updateScene: (id, patch) => {
      setTrackedProjectState((current) => {
        const saved = commitProject(current);
        const currentScene = current.scenes.find((scene) => scene.id === id);
        if (!currentScene || currentScene.isStart || currentScene.special) return current;

        const nextName = patch.name ? normalizeIdentifier(patch.name) : undefined;
        const shouldRename = Boolean(nextName && nextName !== currentScene.name);
        const nextSceneData = shouldRename ? renameSceneGraphKey(saved.sceneData ?? {}, currentScene.name, nextName!) : saved.sceneData;
        const nodes = shouldRename ? saved.nodes.map((node) => (node.type === "goto_scene" && node.target === currentScene.name ? { ...node, target: nextName } : node)) : saved.nodes;

        return commitProject({
          ...saved,
          sceneTitle: current.sceneTitle === currentScene.name && nextName ? nextName : current.sceneTitle,
          scenes: saved.scenes.map((scene) => (scene.id === id ? { ...scene, ...patch, id: nextName || scene.id, name: nextName || scene.name } : scene)),
          sceneData: nextSceneData,
          nodes,
        });
      });
    },
    duplicateScene: (id) => {
      setTrackedProjectState((current) => {
        const saved = commitProject(current);
        const scene = saved.scenes.find((candidate) => candidate.id === id);
        if (!scene) return current;
        const name = nextAvailableName(`${scene.name}_copy`, new Set(saved.scenes.map((candidate) => candidate.name)));
        return commitProject({
          ...saved,
          scenes: [...saved.scenes, { ...scene, id: name, name, current: false, isStart: false, special: false }],
          sceneData: { ...(saved.sceneData ?? {}), [name]: structuredClone(saved.sceneData?.[scene.name] ?? createEmptySceneGraph(name)) },
        });
      });
    },
    deleteScene: (id) => {
      setTrackedProjectState((current) => {
        const saved = commitProject(current);
        const scene = saved.scenes.find((candidate) => candidate.id === id);
        if (!scene || scene.isStart || scene.special || saved.scenes.filter((candidate) => !candidate.special).length <= 2) return current;
        const sceneData = { ...(saved.sceneData ?? {}) };
        delete sceneData[scene.name];
        const scenes = saved.scenes.filter((candidate) => candidate.id !== id);
        const fallback = scenes.find((candidate) => !candidate.isStart && !candidate.special);
        const graph = fallback ? sceneData[fallback.name] ?? createEmptySceneGraph(fallback.name) : { nodes: saved.nodes, edges: saved.edges };
        return commitProject({
          ...saved,
          scenes: scenes.map((candidate) => ({ ...candidate, current: fallback?.id === candidate.id })),
          sceneData,
          sceneTitle: fallback?.name ?? saved.sceneTitle,
          nodes: saved.sceneTitle === scene.name ? graph.nodes : saved.nodes,
          edges: saved.sceneTitle === scene.name ? graph.edges : saved.edges,
        });
      });
    },
    addVariable: () => {
      setTrackedProjectState((current) => {
        const name = nextAvailableName("new_var", new Set(current.variables.map((variable) => variable.name)));
        const variable: VariableSummary = { name, type: "number", initial: "0", desc: "", uses: 0 };
        return commitProject({ ...current, variables: [...current.variables, variable] });
      });
    },
    updateVariable: (name, patch) => {
      setTrackedProjectState((current) => {
        const nextName = patch.name?.trim();
        const shouldRename = Boolean(nextName && nextName !== name);

        return commitProject({
          ...current,
          variables: current.variables.map((variable) => (variable.name === name ? { ...variable, ...patch, name: nextName || variable.name } : variable)),
          nodes: shouldRename ? current.nodes.map((node) => ({
            ...node,
            body: node.body ? renameVariableReferences(node.body, name, nextName!) : node.body,
            inputVar: node.inputVar === name ? nextName! : node.inputVar,
            sets: node.sets?.map((set) => (set.var === name ? { ...set, var: nextName! } : set)),
            options: node.options?.map((option) => ({
              ...option,
              cond: option.cond ? { ...option.cond, expr: renameExpressionName(option.cond.expr, name, nextName!) } : option.cond,
              sets: option.sets?.map((set) => (set.var === name ? { ...set, var: nextName! } : set)),
            })),
            fakeOptions: node.fakeOptions?.map((option) => ({
              ...option,
              cond: option.cond ? { ...option.cond, expr: renameExpressionName(option.cond.expr, name, nextName!) } : option.cond,
              sets: option.sets?.map((set) => (set.var === name ? { ...set, var: nextName! } : set)),
            })),
            branches: node.branches?.map((branch) => ({
              ...branch,
              expr: branch.expr ? renameExpressionName(branch.expr, name, nextName!) : branch.expr,
              sets: branch.sets?.map((set) => (set.var === name ? { ...set, var: nextName! } : set)),
            })),
          })) : current.nodes,
        });
      });
    },
    addAchievement: () => {
      setTrackedProjectState((current) => {
        const id = nextAvailableName("new_achievement", new Set(current.achievements.map((achievement) => achievement.id)));
        const achievement: AchievementSummary = {
          id,
          title: "New achievement",
          points: 5,
          desc: "Achievement description.",
          preDesc: "Achievement locked.",
          postDesc: "Achievement unlocked.",
        };
        return commitProject({ ...current, achievements: [...current.achievements, achievement] });
      });
    },
    updateAchievement: (id, patch) => {
      setTrackedProjectState((current) => {
        const nextId = patch.id ? normalizeIdentifier(patch.id) : undefined;
        return commitProject({
          ...current,
          achievements: current.achievements.map((achievement) => (
            achievement.id === id ? { ...achievement, ...patch, id: nextId || achievement.id } : achievement
          )),
        });
      });
    },
    deleteAchievement: (id) => {
      setTrackedProjectState((current) => commitProject({
        ...current,
        achievements: current.achievements.filter((achievement) => achievement.id !== id),
      }));
    },
    addAsset: () => {
      setTrackedProjectState((current) => {
        const assets = current.assets ?? [];
        const id = nextAvailableName("new_asset", new Set(assets.map((asset) => asset.id)));
        const asset: AssetSummary = { id, path: "images/new_asset.png", kind: "image", desc: "" };
        return commitProject({ ...current, assets: [...assets, asset] });
      });
    },
    updateAsset: (id, patch) => {
      setTrackedProjectState((current) => {
        const nextId = patch.id ? normalizeIdentifier(patch.id) : undefined;
        return commitProject({
          ...current,
          assets: (current.assets ?? []).map((asset) => (
            asset.id === id ? { ...asset, ...patch, id: nextId || asset.id } : asset
          )),
        });
      });
    },
    deleteAsset: (id) => {
      setTrackedProjectState((current) => commitProject({
        ...current,
        assets: (current.assets ?? []).filter((asset) => asset.id !== id),
      }));
    },
  }), [historyLength, setTrackedProjectState]);

  return { project, lintedProject, actions };
}

function renameVariableReferences(text: string, from: string, to: string): string {
  return text.replace(new RegExp(`\\$\\{${escapeRegex(from)}\\}`, "g"), `\${${to}}`);
}

function renameExpressionName(expression: string, from: string, to: string): string {
  return expression.replace(new RegExp(`\\b${escapeRegex(from)}\\b`, "g"), to);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nextAvailableName(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function hydrateProject(project: ChoiceForgeProject): ChoiceForgeProject {
  const activeSceneName = project.sceneTitle || project.scenes.find((scene) => !scene.isStart && !scene.special)?.name || "startup";
  const sceneData: Record<string, SceneGraph> = { ...(project.sceneData ?? {}) };
  if (!sceneData[activeSceneName]) {
    sceneData[activeSceneName] = { nodes: project.nodes ?? [], edges: project.edges ?? [] };
  }

  project.scenes
    .filter((scene) => !scene.isStart && !scene.special)
    .forEach((scene) => {
      if (!sceneData[scene.name]) sceneData[scene.name] = createEmptySceneGraph(scene.name);
    });

  const activeGraph = sceneData[activeSceneName] ?? createEmptySceneGraph(activeSceneName);
  return {
    ...project,
    sceneTitle: activeSceneName,
    sceneData,
    nodes: activeGraph.nodes,
    edges: activeGraph.edges,
    assets: project.assets ?? [],
    scenes: project.scenes.map((scene) => ({ ...scene, current: scene.name === activeSceneName })),
  };
}

function commitProject(project: ChoiceForgeProject): ChoiceForgeProject {
  return persistActiveScene(updateSceneCounts(syncDerivedEdges(project)));
}

function persistActiveScene(project: ChoiceForgeProject): ChoiceForgeProject {
  return {
    ...project,
    sceneData: {
      ...(project.sceneData ?? {}),
      [project.sceneTitle]: {
        nodes: project.nodes,
        edges: project.edges,
      },
    },
  };
}

function updateSceneCounts(project: ChoiceForgeProject): ChoiceForgeProject {
  return {
    ...project,
    scenes: project.scenes.map((scene) => (
      scene.name === project.sceneTitle ? { ...scene, nodes: project.nodes.length, words: countSceneWords(project.nodes) } : scene
    )),
  };
}

function createEmptySceneGraph(sceneName: string): SceneGraph {
  return {
    nodes: [
      {
        id: "n1",
        type: "passage",
        x: 70,
        y: 70,
        w: 300,
        title: `${sceneName}_start`,
        body: "",
      },
    ],
    edges: [],
  };
}

function renameSceneGraphKey(sceneData: Record<string, SceneGraph>, from: string, to: string): Record<string, SceneGraph> {
  const next = { ...sceneData };
  next[to] = next[from] ?? createEmptySceneGraph(to);
  delete next[from];
  return Object.fromEntries(Object.entries(next).map(([sceneName, graph]) => [
    sceneName,
    {
      nodes: graph.nodes.map((node) => (node.type === "goto_scene" && node.target === from ? { ...node, target: to, title: `*goto_scene ${to}` } : node)),
      edges: graph.edges,
    },
  ]));
}

function syncDerivedEdges(project: ChoiceForgeProject): ChoiceForgeProject {
  const manualEdges = project.edges.filter((edge) => edge.kind === "flow");
  return { ...project, edges: [...manualEdges, ...deriveNodeEdges(project.nodes)] };
}

function addFlowEdgeToProject(project: ChoiceForgeProject, from: string, to: string): ChoiceForgeProject {
  const source = project.nodes.find((node) => node.id === from);
  const target = project.nodes.find((node) => node.id === to);
  const sourceCanFlow = source && !["choice", "if", "ending", "goto", "goto_scene"].includes(source.type);
  if (!sourceCanFlow || !target || from === to || project.edges.some((edge) => edge.from === from && edge.to === to && edge.kind === "flow")) return project;
  return commitProject({ ...project, edges: [...project.edges, { from, to, kind: "flow" }] });
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

function stripCommandPrefix(value: string, command: string): string {
  return value.replace(command, "").replace(/^[-\s]+/, "").trim();
}

function layoutStoryNodes(project: ChoiceForgeProject): StoryNode[] {
  const nodes = project.nodes;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));

  project.edges.forEach((edge) => {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) return;
    outgoing.get(edge.from)?.push(edge.to);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  });

  const roots = nodes.filter((node) => node.id === "n1" || (incoming.get(node.id) ?? 0) === 0);
  const queue = roots.length ? roots.map((node) => node.id) : nodes.slice(0, 1).map((node) => node.id);
  const depth = new Map<string, number>(queue.map((id) => [id, 0]));

  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    const currentDepth = depth.get(id) ?? 0;
    outgoing.get(id)?.forEach((target) => {
      const nextDepth = currentDepth + 1;
      if (!depth.has(target) || nextDepth > (depth.get(target) ?? 0)) {
        depth.set(target, nextDepth);
        queue.push(target);
      }
    });
  }

  const maxDepth = Math.max(0, ...depth.values());
  nodes.forEach((node) => {
    if (!depth.has(node.id)) depth.set(node.id, maxDepth + 1);
  });

  const columns = new Map<number, StoryNode[]>();
  nodes.forEach((node) => {
    const column = depth.get(node.id) ?? 0;
    columns.set(column, [...(columns.get(column) ?? []), node]);
  });

  const orderedColumns = [...columns.entries()].sort(([a], [b]) => a - b);
  const positions = new Map<string, { x: number; y: number }>();
  orderedColumns.forEach(([column, columnNodes]) => {
    const sortedNodes = [...columnNodes].sort((a, b) => a.y - b.y || a.x - b.x);
    sortedNodes.forEach((node, row) => {
      positions.set(node.id, { x: 70 + column * 360, y: 70 + row * 210 });
    });
  });

  return nodes.map((node) => ({ ...node, ...(positions.get(node.id) ?? {}) }));
}

function createStoryNode(type: NodeType, id: string, position: { x: number; y: number }, project: ChoiceForgeProject): StoryNode {
  const title = nextAvailableName(defaultNodeTitle(type), new Set(project.nodes.map((node) => node.title)));
  const base = { id, type, x: position.x, y: position.y, w: defaultNodeWidth(type), title };

  if (type === "passage") return { ...base, body: "New narrative passage." };
  if (type === "choice") return { ...base, prompt: "What happens next?", options: [] };
  if (type === "fake_choice") return { ...base, prompt: "What do you notice?", fakeOptions: [{ text: "Look closer.", cond: null }] };
  if (type === "if") return { ...base, branches: [{ kind: "if", expr: "true", to: project.nodes[0]?.id ?? id }] };
  if (type === "set") {
    const firstVariable = project.variables[0]?.name ?? "variable";
    return { ...base, title: `*set ${firstVariable}`, sets: [{ var: firstVariable, op: "=", val: "0" }] };
  }
  if (type === "label") return { ...base, title: `*label ${title}` };
  if (type === "goto") return { ...base, title: `*goto ${firstLabel(project) || "label"}` };
  if (type === "goto_scene") return { ...base, title: `*goto_scene ${firstScene(project)}`, target: firstScene(project) };
  if (type === "gosub") return { ...base, title: "*gosub subroutine" };
  if (type === "checkpoint") return { ...base, title: `*save_checkpoint ${title}` };
  if (type === "page_break") return { ...base, title: "*page_break Continue" };
  if (type === "comment") return { ...base, title: "*comment", body: "Author note." };
  if (type === "input_text") {
    const variable = firstVariable(project, "string") ?? project.variables[0]?.name ?? "text";
    return { ...base, title: `*input_text ${variable}`, inputVar: variable, body: "Enter a response." };
  }
  if (type === "input_number") {
    const variable = firstVariable(project, "number") ?? project.variables[0]?.name ?? "number";
    return { ...base, title: `*input_number ${variable}`, inputVar: variable, inputMin: "0", inputMax: "100", body: "Enter a number." };
  }
  if (type === "rand") {
    const variable = firstVariable(project, "number") ?? project.variables[0]?.name ?? "number";
    return { ...base, title: `*rand ${variable}`, inputVar: variable, inputMin: "1", inputMax: "100" };
  }
  return { ...base, title: "*ending" };
}

function defaultNodeTitle(type: NodeType): string {
  const titles: Record<NodeType, string> = {
    passage: "new_passage",
    choice: "new_choice",
    fake_choice: "new_fake_choice",
    if: "new_condition",
    set: "*set stats",
    label: "new_label",
    goto: "*goto",
    goto_scene: "*goto_scene",
    gosub: "*gosub",
    ending: "*ending",
    checkpoint: "new_checkpoint",
    page_break: "*page_break",
    comment: "new_comment",
    input_text: "*input_text",
    input_number: "*input_number",
    rand: "*rand",
  };
  return titles[type];
}

function defaultNodeWidth(type: NodeType): number {
  if (type === "choice" || type === "fake_choice") return 340;
  if (type === "passage") return 300;
  if (["checkpoint", "goto_scene", "page_break", "comment", "input_text", "input_number", "rand"].includes(type)) return 280;
  return 240;
}

function firstVariable(project: ChoiceForgeProject, type: VariableSummary["type"]): string | undefined {
  return project.variables.find((variable) => variable.type === type)?.name;
}

function firstLabel(project: ChoiceForgeProject): string {
  return project.nodes.find((node) => node.type === "label")?.title.replace("*label", "").trim() ?? "";
}

function firstScene(project: ChoiceForgeProject): string {
  return project.scenes.find((scene) => !scene.isStart && !scene.special)?.name ?? project.sceneTitle;
}

function countSceneWords(nodes: StoryNode[]): number {
  return nodes
    .flatMap((node) => [
      node.title,
      node.body ?? "",
      node.prompt ?? "",
      ...(node.options?.map((option) => option.text) ?? []),
      ...(node.fakeOptions?.map((option) => option.text) ?? []),
    ])
    .join(" ")
    .replace(/\$\{[^}]+\}/g, " ")
    .replace(/@\{[^}]+\}/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function normalizeIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^[^a-z_]+/, "")
    .replace(/_+/g, "_");
}
