import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sampleProjects } from "../data/sampleProject";
import { lintProject } from "../domain/choicescript";
import { layoutProjectGraphs, layoutSceneGraph } from "../domain/graphLayout";
import { importChoiceScriptSceneText } from "../domain/choicescriptImport";
import type { AchievementSummary, AssetSummary, ChoiceForgeProject, Language, NodeType, SceneGraph, SceneSummary, StoryEdge, StoryNode, VariableSummary } from "../domain/types";

const STORAGE_KEY = "choiceforge.project.v2";
const HISTORY_LIMIT = 50;
const SNAPSHOTS_INDEX_KEY = "choiceforge.snapshots.v1";
const MAX_SNAPSHOTS = 5;

export interface SnapshotMeta {
  id: string;
  name: string;
  createdAt: string;
  wordCount: number;
  sceneCount: number;
}

function snapshotDataKey(id: string) { return `choiceforge.snapshot.data.${id}`; }

function loadSnapshotIndex(): SnapshotMeta[] {
  try { return JSON.parse(window.localStorage.getItem(SNAPSHOTS_INDEX_KEY) ?? "[]"); }
  catch { return []; }
}

function persistSnapshotIndex(index: SnapshotMeta[]) {
  window.localStorage.setItem(SNAPSHOTS_INDEX_KEY, JSON.stringify(index));
}

function loadSnapshotData(id: string): ChoiceForgeProject | null {
  try { return JSON.parse(window.localStorage.getItem(snapshotDataKey(id)) ?? "null"); }
  catch { return null; }
}

function cloneProject(project: ChoiceForgeProject): ChoiceForgeProject {
  return structuredClone(project);
}

function loadInitialProject(): ChoiceForgeProject {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return commitProject(layoutProjectGraphs(hydrateProject(cloneProject(sampleProjects.en))));

  try {
    return commitProject(hydrateProject(JSON.parse(saved) as ChoiceForgeProject));
  } catch {
    return commitProject(layoutProjectGraphs(hydrateProject(cloneProject(sampleProjects.en))));
  }
}

function saveProjectSnapshot(project: ChoiceForgeProject) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

export interface ProjectActions {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  saveNow: () => void;
  setProject: (project: ChoiceForgeProject) => void;
  updateMetadata: (patch: Partial<Pick<ChoiceForgeProject, "title" | "author" | "wordGoal">>) => void;
  replaceCurrentSceneText: (content: string) => void;
  convertCurrentSceneToVisual: () => void;
  replaceStartupText: (content: string) => void;
  replaceStatsText: (content: string) => void;
  resetProject: (language: Language) => ChoiceForgeProject;
  selectScene: (id: string) => void;
  updateNode: (id: string, patch: Partial<StoryNode>) => void;
  bulkUpdateNodes: (ids: string[], patch: Partial<StoryNode>) => void;
  moveNode: (id: string, x: number, y: number) => void;
  layoutNodes: () => void;
  addNode: (type: NodeType, id: string, position: { x: number; y: number }) => void;
  duplicateNode: (id: string) => string | null;
  deleteNode: (id: string) => void;
  moveNodes: (moves: { id: string; x: number; y: number }[]) => void;
  deleteNodes: (ids: string[]) => void;
  replaceInNodes: (find: string, replace: string, scope: "scene" | "all") => number;
  pasteNodes: (nodes: StoryNode[], internalEdges: StoryEdge[], center: { x: number; y: number }) => string[];
  connectNodes: (from: string, to: string) => void;
  addFlowEdge: (from: string, to: string) => void;
  deleteFlowEdge: (from: string, to: string) => void;
  addScene: () => void;
  updateScene: (id: string, patch: Partial<SceneSummary>) => void;
  moveScene: (id: string, direction: "up" | "down") => void;
  moveSceneBefore: (id: string, beforeId: string | null) => void;
  duplicateScene: (id: string) => void;
  deleteScene: (id: string) => void;
  addVariable: () => void;
  updateVariable: (name: string, patch: Partial<VariableSummary>) => void;
  deleteVariable: (name: string) => void;
  moveVariable: (name: string, direction: "up" | "down") => void;
  addAchievement: () => void;
  updateAchievement: (id: string, patch: Partial<AchievementSummary>) => void;
  deleteAchievement: (id: string) => void;
  addAsset: () => void;
  updateAsset: (id: string, patch: Partial<AssetSummary>) => void;
  deleteAsset: (id: string) => void;
  saveSnapshot: (name: string) => void;
  restoreSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;
}

export function useProjectStore() {
  const [project, setProjectState] = useState(loadInitialProject);
  const [historyLength, setHistoryLength] = useState(0);
  const [futureLength, setFutureLength] = useState(0);
  const historyRef = useRef<ChoiceForgeProject[]>([]);
  const futureRef = useRef<ChoiceForgeProject[]>([]);
  const [snapshotIndex, setSnapshotIndex] = useState<SnapshotMeta[]>(loadSnapshotIndex);
  const projectRef = useRef(project);
  projectRef.current = project;

  const pushHistory = useCallback((snapshot: ChoiceForgeProject) => {
    const nextHistory = [...historyRef.current, cloneProject(snapshot)].slice(-HISTORY_LIMIT);
    historyRef.current = nextHistory;
    setHistoryLength(nextHistory.length);
    futureRef.current = [];
    setFutureLength(0);
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
      saveProjectSnapshot(project);
    }, 400);

    return () => window.clearTimeout(handle);
  }, [project]);

  useEffect(() => {
    const flush = () => saveProjectSnapshot(project);
    const visibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibilityChange);
    };
  }, [project]);

  const lintedProject = useMemo(() => ({ ...project, lints: lintProject(project) }), [project]);

  const actions = useMemo<ProjectActions>(() => ({
    canUndo: historyLength > 0,
    canRedo: futureLength > 0,
    undo: () => {
      const previous = historyRef.current.at(-1);
      if (!previous) return;
      setProjectState((current) => {
        const nextHistory = historyRef.current.slice(0, -1);
        historyRef.current = nextHistory;
        setHistoryLength(nextHistory.length);
        const nextFuture = [...futureRef.current, cloneProject(current)].slice(-HISTORY_LIMIT);
        futureRef.current = nextFuture;
        setFutureLength(nextFuture.length);
        const restored = commitProject(hydrateProject(cloneProject(previous)));
        saveProjectSnapshot(restored);
        return restored;
      });
    },
    redo: () => {
      const next = futureRef.current.at(-1);
      if (!next) return;
      setProjectState((current) => {
        const nextFuture = futureRef.current.slice(0, -1);
        futureRef.current = nextFuture;
        setFutureLength(nextFuture.length);
        const nextHistory = [...historyRef.current, cloneProject(current)].slice(-HISTORY_LIMIT);
        historyRef.current = nextHistory;
        setHistoryLength(nextHistory.length);
        const restored = commitProject(hydrateProject(cloneProject(next)));
        saveProjectSnapshot(restored);
        return restored;
      });
    },
    saveNow: () => {
      setProjectState((current) => {
        const saved = commitProject(current);
        saveProjectSnapshot(saved);
        return saved;
      });
    },
    setProject: (nextProject) => {
      const syncedProject = commitProject(layoutProjectGraphs(hydrateProject(nextProject)));
      setTrackedProjectState(syncedProject);
      saveProjectSnapshot(syncedProject);
    },
    updateMetadata: (patch) => {
      setTrackedProjectState((current) => commitProject(clearStartupSource({ ...current, ...patch })));
    },
    replaceCurrentSceneText: (content) => {
      setTrackedProjectState((current) => {
        const graph = { ...layoutSceneGraph(importChoiceScriptSceneText(current.sceneTitle, content, { nodes: current.nodes, edges: current.edges })), sourceText: content };
        return commitProject({
          ...current,
          nodes: graph.nodes,
          edges: graph.edges,
          sceneData: {
            ...(current.sceneData ?? {}),
            [current.sceneTitle]: graph,
          },
        });
      });
    },
    convertCurrentSceneToVisual: () => {
      setTrackedProjectState((current) => commitProject(clearActiveSceneSource(current)));
    },
    replaceStartupText: (content) => {
      setTrackedProjectState((current) => commitProject({ ...applyStartupText(current, content), startupSource: content }));
    },
    replaceStatsText: (content) => {
      setTrackedProjectState((current) => commitProject({ ...applyStatsText(current, content), statsSource: content }));
    },
    resetProject: (language) => {
      const fresh = commitProject(layoutProjectGraphs(hydrateProject(cloneProject(sampleProjects[language]))));
      setTrackedProjectState(fresh);
      saveProjectSnapshot(fresh);
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
      setTrackedProjectState((current) => commitProject(clearActiveSceneSource({
        ...current,
        nodes: current.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
      })));
    },
    bulkUpdateNodes: (ids, patch) => {
      const idSet = new Set(ids);
      setTrackedProjectState((current) => commitProject(clearActiveSceneSource({
        ...current,
        nodes: current.nodes.map((node) => (idSet.has(node.id) ? { ...node, ...patch } : node)),
      })));
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
        ...layoutSceneGraph({ nodes: current.nodes, edges: current.edges }),
      }));
    },
    addNode: (type, id, position) => {
      setTrackedProjectState((current) => {
        if (current.nodes.some((node) => node.id === id)) return current;
        const node = createStoryNode(type, id, position, current);
        return commitProject(clearActiveSceneSource({
          ...current,
          nodes: [...current.nodes, node],
          scenes: current.scenes.map((scene) => (
            scene.name === current.sceneTitle ? { ...scene, nodes: scene.nodes + 1 } : scene
          )),
        }));
      });
    },
    duplicateNode: (id) => {
      let newId: string | null = null;
      setTrackedProjectState((current) => {
        const node = current.nodes.find((n) => n.id === id);
        if (!node) return current;
        const allNodes = current.sceneData ? Object.values(current.sceneData).flatMap((g) => g.nodes) : current.nodes;
        const maxNum = allNodes.reduce((max, n) => {
          const match = /^n(\d+)$/.exec(n.id);
          return match ? Math.max(max, Number(match[1])) : max;
        }, 0);
        newId = `n${maxNum + 1}`;
        const cloned: StoryNode = { ...structuredClone(node), id: newId, x: node.x + 24, y: node.y + node.w + 24 };
        return commitProject(clearActiveSceneSource({
          ...current,
          nodes: [...current.nodes, cloned],
          scenes: current.scenes.map((scene) => (
            scene.name === current.sceneTitle ? { ...scene, nodes: scene.nodes + 1 } : scene
          )),
        }));
      });
      return newId;
    },
    deleteNode: (id) => {
      setTrackedProjectState((current) => {
        if (current.nodes.length <= 1) return current;
        const nodes = current.nodes.filter((node) => node.id !== id);
        if (nodes.length === current.nodes.length) return current;

        return commitProject(clearActiveSceneSource({
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
        }));
      });
    },
    moveNodes: (moves) => {
      if (!moves.length) return;
      const posMap = new Map(moves.map(({ id, x, y }) => [id, { x, y }]));
      setTrackedProjectState((current) => commitProject({
        ...current,
        nodes: current.nodes.map((node) => {
          const pos = posMap.get(node.id);
          return pos ? { ...node, ...pos } : node;
        }),
      }));
    },
    deleteNodes: (ids) => {
      if (!ids.length) return;
      const idSet = new Set(ids);
      setTrackedProjectState((current) => {
        const nodes = current.nodes.filter((node) => !idSet.has(node.id));
        if (nodes.length === current.nodes.length) return current;
        if (nodes.length === 0) return current;
        const deletedCount = current.nodes.length - nodes.length;
        return commitProject(clearActiveSceneSource({
          ...current,
          nodes: nodes.map((node) => ({
            ...node,
            options: node.options?.filter((option) => !idSet.has(option.to)),
            branches: node.branches?.filter((branch) => !idSet.has(branch.to)),
          })),
          edges: current.edges.filter((edge) => !idSet.has(edge.from) && !idSet.has(edge.to)),
          scenes: current.scenes.map((scene) => (
            scene.name === current.sceneTitle ? { ...scene, nodes: Math.max(0, scene.nodes - deletedCount) } : scene
          )),
        }));
      });
    },
    replaceInNodes: (find, replace, scope) => {
      if (!find) return 0;
      let count = 0;
      setTrackedProjectState((current) => {
        count = 0;
        const replaceText = (text: string): string => {
          if (!text.includes(find)) return text;
          count += text.split(find).length - 1;
          return text.replaceAll(find, replace);
        };
        const replaceInNode = (node: StoryNode): StoryNode => ({
          ...node,
          body: node.body !== undefined ? replaceText(node.body) : undefined,
          prompt: node.prompt !== undefined ? replaceText(node.prompt) : undefined,
          options: node.options?.map((opt) => ({ ...opt, text: replaceText(opt.text) })),
          fakeOptions: node.fakeOptions?.map((opt) => ({ ...opt, text: replaceText(opt.text) })),
        });
        if (scope === "scene") {
          return commitProject(clearActiveSceneSource({
            ...current,
            nodes: current.nodes.map(replaceInNode),
          }));
        }
        const newSceneData = current.sceneData
          ? Object.fromEntries(
              Object.entries(current.sceneData).map(([name, graph]) => [
                name,
                { nodes: graph.nodes.map(replaceInNode), edges: graph.edges },
              ])
            )
          : undefined;
        const currentNodes = newSceneData?.[current.sceneTitle]?.nodes ?? current.nodes.map(replaceInNode);
        return commitProject({ ...current, nodes: currentNodes, sceneData: newSceneData });
      });
      return count;
    },
    pasteNodes: (nodes, internalEdges, center) => {
      if (!nodes.length) return [];
      const newIds: string[] = [];
      setTrackedProjectState((current) => {
        newIds.length = 0;
        const allNodes = current.sceneData
          ? Object.values(current.sceneData).flatMap((g) => g.nodes)
          : current.nodes;
        const baseMax = allNodes.reduce((max, n) => {
          const match = /^n(\d+)$/.exec(n.id);
          return match ? Math.max(max, Number(match[1])) : max;
        }, 0);
        const idMap = new Map<string, string>();
        nodes.forEach((node, index) => {
          const newId = `n${baseMax + index + 1}`;
          idMap.set(node.id, newId);
          newIds.push(newId);
        });
        const minX = Math.min(...nodes.map((n) => n.x));
        const minY = Math.min(...nodes.map((n) => n.y));
        const maxX = Math.max(...nodes.map((n) => n.x + n.w));
        const maxY = Math.max(...nodes.map((n) => n.y + 120));
        const bboxCX = (minX + maxX) / 2;
        const bboxCY = (minY + maxY) / 2;
        const dx = Math.round(center.x - bboxCX);
        const dy = Math.round(center.y - bboxCY);
        const pasted = nodes.map((node) => ({
          ...structuredClone(node),
          id: idMap.get(node.id)!,
          x: Math.round(node.x + dx),
          y: Math.round(node.y + dy),
          options: node.options?.map((opt) => ({ ...opt, to: idMap.get(opt.to) ?? "" })).filter((opt) => opt.to),
          branches: node.branches?.map((branch) => ({ ...branch, to: idMap.get(branch.to) ?? "" })),
        }));
        const pastedEdges = internalEdges
          .filter((edge) => idMap.has(edge.from) && idMap.has(edge.to))
          .map((edge) => ({ ...edge, from: idMap.get(edge.from)!, to: idMap.get(edge.to)! }));
        return commitProject(clearActiveSceneSource({
          ...current,
          nodes: [...current.nodes, ...pasted],
          edges: [...current.edges, ...pastedEdges],
          scenes: current.scenes.map((scene) => (
            scene.name === current.sceneTitle ? { ...scene, nodes: scene.nodes + pasted.length } : scene
          )),
        }));
      });
      return newIds;
    },
    connectNodes: (from, to) => {
      setTrackedProjectState((current) => {
        const source = current.nodes.find((node) => node.id === from);
        const target = current.nodes.find((node) => node.id === to);
        if (!source || !target || from === to) return current;

        if (source.type === "choice") {
          if (source.options?.some((option) => option.to === to)) return current;
          return commitProject(clearActiveSceneSource({
            ...current,
            nodes: current.nodes.map((node) => (
              node.id === from
                ? { ...node, options: [...(node.options ?? []), { text: `Go to ${target.title}`, to, cond: null }] }
                : node
            )),
          }));
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
          return commitProject(clearActiveSceneSource({
            ...current,
            nodes: current.nodes.map((node) => (
              node.id === from
                ? { ...node, branches: nextBranches }
                : node
            )),
          }));
        }

        return addFlowEdgeToProject(current, from, to);
      });
    },
    addFlowEdge: (from, to) => {
      setTrackedProjectState((current) => addFlowEdgeToProject(current, from, to));
    },
    deleteFlowEdge: (from, to) => {
      setTrackedProjectState((current) => commitProject(clearActiveSceneSource({
        ...current,
        edges: current.edges.filter((edge) => !(edge.from === from && edge.to === to && edge.kind === "flow")),
      })));
    },
    addScene: () => {
      setTrackedProjectState((current) => {
        const saved = commitProject(current);
        const name = nextAvailableName("new_scene", new Set(current.scenes.map((scene) => scene.name)));
        const graph = createEmptySceneGraph(name);
        const scene: SceneSummary = { id: name, name, words: countSceneWords(graph.nodes), nodes: graph.nodes.length, current: true };
        return commitProject(clearStartupSource({
          ...saved,
          sceneTitle: name,
          sceneSubtitle: `${name}.txt - ${scene.words.toLocaleString()} words`,
          scenes: [...saved.scenes.map((candidate) => ({ ...candidate, current: false })), scene],
          nodes: graph.nodes,
          edges: graph.edges,
          sceneData: { ...(saved.sceneData ?? {}), [name]: graph },
        }));
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

        return commitProject(clearStartupSource({
          ...saved,
          sceneTitle: current.sceneTitle === currentScene.name && nextName ? nextName : current.sceneTitle,
          scenes: saved.scenes.map((scene) => (scene.id === id ? { ...scene, ...patch, id: nextName || scene.id, name: nextName || scene.name } : scene)),
          sceneData: nextSceneData,
          nodes,
        }));
      });
    },
    moveScene: (id, direction) => {
      setTrackedProjectState((current) => {
        const saved = commitProject(current);
        const movable = saved.scenes.filter((scene) => !scene.isStart && !scene.special);
        const currentIndex = movable.findIndex((scene) => scene.id === id);
        const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= movable.length) return current;

        const reorderedMovable = [...movable];
        [reorderedMovable[currentIndex], reorderedMovable[targetIndex]] = [reorderedMovable[targetIndex], reorderedMovable[currentIndex]];
        const queue = [...reorderedMovable];

        return commitProject(clearStartupSource({
          ...saved,
          scenes: saved.scenes.map((scene) => (scene.isStart || scene.special ? scene : queue.shift() ?? scene)),
        }));
      });
    },
    moveSceneBefore: (id, beforeId) => {
      setTrackedProjectState((current) => {
        const saved = commitProject(current);
        const movable = saved.scenes.filter((scene) => !scene.isStart && !scene.special);
        const dragged = movable.find((scene) => scene.id === id);
        if (!dragged || id === beforeId) return current;

        const withoutDragged = movable.filter((scene) => scene.id !== id);
        const targetIndex = beforeId ? withoutDragged.findIndex((scene) => scene.id === beforeId) : withoutDragged.length;
        if (targetIndex < 0) return current;
        const reorderedMovable = [
          ...withoutDragged.slice(0, targetIndex),
          dragged,
          ...withoutDragged.slice(targetIndex),
        ];
        const queue = [...reorderedMovable];

        return commitProject(clearStartupSource({
          ...saved,
          scenes: saved.scenes.map((scene) => (scene.isStart || scene.special ? scene : queue.shift() ?? scene)),
        }));
      });
    },
    duplicateScene: (id) => {
      setTrackedProjectState((current) => {
        const saved = commitProject(current);
        const scene = saved.scenes.find((candidate) => candidate.id === id);
        if (!scene) return current;
        const name = nextAvailableName(`${scene.name}_copy`, new Set(saved.scenes.map((candidate) => candidate.name)));
        return commitProject(clearStartupSource({
          ...saved,
          scenes: [...saved.scenes, { ...scene, id: name, name, current: false, isStart: false, special: false }],
          sceneData: { ...(saved.sceneData ?? {}), [name]: structuredClone(saved.sceneData?.[scene.name] ?? createEmptySceneGraph(name)) },
        }));
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
        const retargetedSceneData = fallback ? retargetGotoSceneReferences(sceneData, scene.name, fallback.name) : sceneData;
        const activeSceneName = saved.sceneTitle === scene.name ? fallback?.name ?? saved.sceneTitle : saved.sceneTitle;
        const graph = retargetedSceneData[activeSceneName] ?? (fallback ? createEmptySceneGraph(fallback.name) : { nodes: saved.nodes, edges: saved.edges });
        return commitProject(clearStartupSource({
          ...saved,
          scenes: scenes.map((candidate) => ({ ...candidate, current: candidate.name === activeSceneName })),
          sceneData: retargetedSceneData,
          sceneTitle: activeSceneName,
          nodes: graph.nodes,
          edges: graph.edges,
        }));
      });
    },
    addVariable: () => {
      setTrackedProjectState((current) => {
        const name = nextAvailableName("new_var", new Set(current.variables.map((variable) => variable.name)));
        const variable: VariableSummary = { name, type: "number", initial: "0", desc: "", uses: 0 };
        return commitProject(clearStatsSource(clearStartupSource({ ...current, variables: [...current.variables, variable] })));
      });
    },
    updateVariable: (name, patch) => {
      setTrackedProjectState((current) => {
        const saved = commitProject(current);
        const nextName = patch.name?.trim();
        const shouldRename = Boolean(nextName && nextName !== name);
        const sceneData = shouldRename
          ? mapSceneGraphs(saved, (graph) => ({
              ...graph,
              nodes: graph.nodes.map((node) => renameNodeVariable(node, name, nextName!)),
            }))
          : saved.sceneData;
        const activeGraph = sceneData?.[saved.sceneTitle];

        return commitProject(clearStatsSource(clearStartupSource({
          ...saved,
          variables: saved.variables.map((variable) => (variable.name === name ? { ...variable, ...patch, name: nextName || variable.name } : variable)),
          sceneData,
          nodes: shouldRename ? activeGraph?.nodes ?? saved.nodes.map((node) => renameNodeVariable(node, name, nextName!)) : saved.nodes,
          edges: shouldRename ? activeGraph?.edges ?? saved.edges : saved.edges,
        })));
      });
    },
    deleteVariable: (name) => {
      setTrackedProjectState((current) => {
        const saved = commitProject(current);
        const removed = saved.variables.find((variable) => variable.name === name);
        if (!removed) return current;
        const variables = saved.variables.filter((variable) => variable.name !== name);
        const inputFallback = variables.find((variable) => variable.type === removed.type) ?? variables[0];
        const sceneData = mapSceneGraphs(saved, (graph) => ({
          ...graph,
          nodes: graph.nodes.map((node) => removeNodeVariable(node, name, inputFallback)),
        }));
        const activeGraph = sceneData[saved.sceneTitle];
        return commitProject(clearStatsSource(clearStartupSource({
          ...saved,
          variables,
          sceneData,
          nodes: activeGraph?.nodes ?? saved.nodes.map((node) => removeNodeVariable(node, name, inputFallback)),
          edges: activeGraph?.edges ?? saved.edges,
        })));
      });
    },
    moveVariable: (name, direction) => {
      setTrackedProjectState((current) => {
        const saved = commitProject(current);
        const vars = saved.variables;
        const idx = vars.findIndex((v) => v.name === name);
        const targetIdx = direction === "up" ? idx - 1 : idx + 1;
        if (idx < 0 || targetIdx < 0 || targetIdx >= vars.length) return current;
        const reordered = [...vars];
        [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
        return commitProject(clearStartupSource({ ...saved, variables: reordered }));
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
        return commitProject(clearStatsSource(clearStartupSource({ ...current, achievements: [...current.achievements, achievement] })));
      });
    },
    updateAchievement: (id, patch) => {
      setTrackedProjectState((current) => {
        const saved = commitProject(current);
        const nextId = patch.id ? normalizeIdentifier(patch.id) : undefined;
        const shouldRename = Boolean(nextId && nextId !== id);
        const sceneData = shouldRename
          ? mapSceneGraphs(saved, (graph) => ({
              ...graph,
              nodes: graph.nodes.map((node) => renameNodeAchievement(node, id, nextId!)),
            }))
          : saved.sceneData;
        const activeGraph = sceneData?.[saved.sceneTitle];
        return commitProject(clearStatsSource(clearStartupSource({
          ...saved,
          achievements: saved.achievements.map((achievement) => (
            achievement.id === id ? { ...achievement, ...patch, id: nextId || achievement.id } : achievement
          )),
          sceneData,
          nodes: shouldRename ? activeGraph?.nodes ?? saved.nodes.map((node) => renameNodeAchievement(node, id, nextId!)) : saved.nodes,
          edges: shouldRename ? activeGraph?.edges ?? saved.edges : saved.edges,
        })));
      });
    },
    deleteAchievement: (id) => {
      setTrackedProjectState((current) => {
        const saved = commitProject(current);
        const sceneData = mapSceneGraphs(saved, (graph) => ({
          ...graph,
          nodes: graph.nodes.map((node) => removeNodeAchievement(node, id)),
        }));
        const activeGraph = sceneData[saved.sceneTitle];
        return commitProject(clearStatsSource(clearStartupSource({
          ...saved,
          achievements: saved.achievements.filter((achievement) => achievement.id !== id),
          sceneData,
          nodes: activeGraph?.nodes ?? saved.nodes.map((node) => removeNodeAchievement(node, id)),
          edges: activeGraph?.edges ?? saved.edges,
        })));
      });
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
    saveSnapshot: (name: string) => {
      const current = projectRef.current;
      const id = `snap_${Date.now()}`;
      const meta: SnapshotMeta = {
        id,
        name: name.trim() || new Date().toLocaleString(),
        createdAt: new Date().toISOString(),
        wordCount: current.scenes.reduce((sum, s) => sum + s.words, 0),
        sceneCount: current.scenes.filter((s) => !s.isStart && !s.special).length,
      };
      try { window.localStorage.setItem(snapshotDataKey(id), JSON.stringify(current)); } catch { return; }
      setSnapshotIndex((prev) => {
        const overflow = prev.slice(MAX_SNAPSHOTS - 1);
        overflow.forEach((m) => window.localStorage.removeItem(snapshotDataKey(m.id)));
        const next = [meta, ...prev].slice(0, MAX_SNAPSHOTS);
        persistSnapshotIndex(next);
        return next;
      });
    },
    restoreSnapshot: (id: string) => {
      const data = loadSnapshotData(id);
      if (!data) return;
      setTrackedProjectState(() => commitProject(hydrateProject(cloneProject(data))));
    },
    deleteSnapshot: (id: string) => {
      window.localStorage.removeItem(snapshotDataKey(id));
      setSnapshotIndex((prev) => {
        const next = prev.filter((s) => s.id !== id);
        persistSnapshotIndex(next);
        return next;
      });
    },
  }), [historyLength, setTrackedProjectState]);

  return { project, lintedProject, actions, snapshotIndex };
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

function mapSceneGraphs(project: ChoiceForgeProject, mapper: (graph: SceneGraph) => SceneGraph): Record<string, SceneGraph> {
  const sceneData = { ...(project.sceneData ?? {}) };
  project.scenes
    .filter((scene) => !scene.isStart && !scene.special)
    .forEach((scene) => {
      sceneData[scene.name] = mapper(sceneData[scene.name] ?? createEmptySceneGraph(scene.name));
    });
  return sceneData;
}

function renameNodeVariable(node: StoryNode, from: string, to: string): StoryNode {
  return {
    ...node,
    body: node.body ? renameVariableReferences(node.body, from, to) : node.body,
    inputVar: node.inputVar === from ? to : node.inputVar,
    sets: node.sets?.map((set) => (set.var === from ? { ...set, var: to } : set)),
    options: node.options?.map((option) => ({
      ...option,
      cond: option.cond ? { ...option.cond, expr: renameExpressionName(option.cond.expr, from, to) } : option.cond,
      sets: option.sets?.map((set) => (set.var === from ? { ...set, var: to } : set)),
    })),
    fakeOptions: node.fakeOptions?.map((option) => ({
      ...option,
      cond: option.cond ? { ...option.cond, expr: renameExpressionName(option.cond.expr, from, to) } : option.cond,
      sets: option.sets?.map((set) => (set.var === from ? { ...set, var: to } : set)),
    })),
    branches: node.branches?.map((branch) => ({
      ...branch,
      expr: branch.expr ? renameExpressionName(branch.expr, from, to) : branch.expr,
      sets: branch.sets?.map((set) => (set.var === from ? { ...set, var: to } : set)),
    })),
  };
}

function removeNodeVariable(node: StoryNode, name: string, inputFallback: VariableSummary | undefined): StoryNode {
  const inputPatch = node.inputVar === name
    ? {
        inputVar: inputFallback?.name,
        title: inputFallback ? replaceInputTitle(node, inputFallback.name) : node.title,
      }
    : {};
  return {
    ...node,
    ...inputPatch,
    sets: node.sets?.filter((set) => set.var !== name),
    options: node.options?.map((option) => ({ ...option, sets: option.sets?.filter((set) => set.var !== name) })),
    fakeOptions: node.fakeOptions?.map((option) => ({ ...option, sets: option.sets?.filter((set) => set.var !== name) })),
    branches: node.branches?.map((branch) => ({ ...branch, sets: branch.sets?.filter((set) => set.var !== name) })),
  };
}

function renameNodeAchievement(node: StoryNode, from: string, to: string): StoryNode {
  return {
    ...node,
    body: node.body ? replaceAchievementCommand(node.body, from, to) : node.body,
  };
}

function removeNodeAchievement(node: StoryNode, id: string): StoryNode {
  return {
    ...node,
    body: node.body ? removeAchievementCommand(node.body, id) : node.body,
  };
}

function replaceAchievementCommand(body: string, from: string, to: string): string {
  return body.replace(new RegExp(`(^\\s*\\*achieve\\s+)${escapeRegex(from)}(\\s*$)`, "gim"), `$1${to}$2`);
}

function removeAchievementCommand(body: string, id: string): string {
  return body
    .split("\n")
    .filter((line) => !new RegExp(`^\\s*\\*achieve\\s+${escapeRegex(id)}\\s*$`, "i").test(line))
    .join("\n")
    .trimEnd();
}

function nextAvailableName(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function applyStartupText(project: ChoiceForgeProject, content: string): ChoiceForgeProject {
  const lines = content.split(/\r?\n/);
  const title = commandValue(lines.find((line) => commandName(line) === "title") ?? "", "*title") || project.title;
  const author = commandValue(lines.find((line) => commandName(line) === "author") ?? "", "*author") || project.author;
  const sceneNames = parseSceneList(lines);
  const variables = parseCreates(lines, project.variables);
  const achievements = parseAchievements(lines, project.achievements);
  const scenes = reorderScenesFromStartup(project.scenes, sceneNames, project.sceneTitle);
  const sceneData = { ...(project.sceneData ?? {}) };

  scenes
    .filter((scene) => !scene.isStart && !scene.special)
    .forEach((scene) => {
      if (!sceneData[scene.name]) sceneData[scene.name] = createEmptySceneGraph(scene.name);
    });

  const activeSceneName = scenes.some((scene) => scene.name === project.sceneTitle && !scene.isStart && !scene.special)
    ? project.sceneTitle
    : scenes.find((scene) => !scene.isStart && !scene.special)?.name ?? project.sceneTitle;
  const activeGraph = sceneData[activeSceneName] ?? createEmptySceneGraph(activeSceneName);

  return {
    ...project,
    title,
    author,
    scenes: scenes.map((scene) => ({ ...scene, current: scene.name === activeSceneName })),
    variables,
    achievements,
    sceneTitle: activeSceneName,
    sceneSubtitle: `${activeSceneName}.txt - ${activeGraph.nodes.length} nodes`,
    sceneData,
    nodes: activeGraph.nodes,
    edges: activeGraph.edges,
  };
}

function applyStatsText(project: ChoiceForgeProject, content: string): ChoiceForgeProject {
  const chartRows = parseStatChartRows(content.split(/\r?\n/));
  if (!chartRows.length) return project;
  const rows = new Map(chartRows.map((row) => [row.name, row]));
  return {
    ...project,
    variables: project.variables.map((variable) => {
      const row = rows.get(variable.name);
      if (!row) return variable;
      return {
        ...variable,
        desc: row.label || variable.desc,
        fairmath: variable.type === "number" ? row.chartType === "percent" : false,
      };
    }),
  };
}

function parseSceneList(lines: string[]): string[] {
  const scenes: string[] = [];
  let inSceneList = false;
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (commandName(line) === "scene_list") {
      inSceneList = true;
      return;
    }
    if (!inSceneList) return;
    if (!trimmed) return;
    if (trimmed.startsWith("*")) {
      inSceneList = false;
      return;
    }
    scenes.push(normalizeIdentifier(trimmed));
  });
  return [...new Set(scenes)];
}

function parseCreates(lines: string[], currentVariables: VariableSummary[]): VariableSummary[] {
  const current = new Map(currentVariables.map((variable) => [variable.name, variable]));
  return lines
    .filter((line) => commandName(line) === "create")
    .map((line) => {
      const [, rawName = "variable", ...rest] = line.trim().split(/\s+/);
      const name = normalizeIdentifier(rawName) || "variable";
      const initial = rest.join(" ") || "0";
      const previous = current.get(name);
      const type = inferVariableType(initial);
      return {
        name,
        type,
        initial,
        desc: previous?.desc ?? name,
        uses: previous?.uses ?? 0,
        fairmath: type === "number" ? previous?.fairmath : false,
      };
    });
}

function parseAchievements(lines: string[], currentAchievements: AchievementSummary[]): AchievementSummary[] {
  const current = new Map(currentAchievements.map((achievement) => [achievement.id, achievement]));
  const achievements: AchievementSummary[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (commandName(lines[index]) !== "achievement") continue;
    const parts = lines[index].trim().split(/\s+/);
    const id = normalizeIdentifier(parts[1] ?? `achievement_${achievements.length + 1}`);
    const visibility = parts[2] ?? "visible";
    const points = Number(parts[3] ?? "0");
    const title = parts.slice(4).join(" ") || current.get(id)?.title || id;
    const preDesc = lines[index + 1]?.trim() || current.get(id)?.preDesc || title;
    const postDesc = lines[index + 2]?.trim() || current.get(id)?.postDesc || preDesc;
    achievements.push({
      id,
      title,
      points: Number.isFinite(points) ? points : current.get(id)?.points ?? 0,
      desc: current.get(id)?.desc || postDesc,
      preDesc,
      postDesc,
      hidden: visibility === "hidden",
    });
  }
  return achievements;
}

function parseStatChartRows(lines: string[]): Array<{ chartType: "percent" | "text"; name: string; label: string }> {
  const rows: Array<{ chartType: "percent" | "text"; name: string; label: string }> = [];
  let inChart = false;
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (commandName(line) === "stat_chart") {
      inChart = true;
      return;
    }
    if (!inChart || !trimmed) return;
    if (trimmed.startsWith("*")) {
      inChart = false;
      return;
    }
    const [chartType, name, ...labelParts] = trimmed.split(/\s+/);
    if ((chartType === "percent" || chartType === "text") && name) {
      rows.push({ chartType, name, label: labelParts.join(" ") });
    }
  });
  return rows;
}

function reorderScenesFromStartup(scenes: SceneSummary[], sceneNames: string[], activeSceneName: string): SceneSummary[] {
  const startup = scenes.find((scene) => scene.isStart) ?? { id: "startup", name: "startup", words: 0, nodes: 0, isStart: true };
  const stats = scenes.find((scene) => scene.special) ?? { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true };
  const existing = new Map(scenes.filter((scene) => !scene.isStart && !scene.special).map((scene) => [scene.name, scene]));
  const orderedNames = sceneNames.length ? sceneNames : [...existing.keys()];
  return [
    startup,
    ...orderedNames.map((name) => ({
      ...(existing.get(name) ?? { id: name, name, words: 0, nodes: 1 }),
      id: name,
      name,
      current: name === activeSceneName,
      isStart: false,
      special: false,
    })),
    stats,
  ];
}

function commandName(line: string): string | null {
  return line.trim().match(/^\*([a-z_]+)/i)?.[1].toLowerCase() ?? null;
}

function commandValue(line: string, command: string): string {
  return line.trim().replace(command, "").trim();
}

function inferVariableType(value: string): VariableSummary["type"] {
  if (/^(true|false)$/i.test(value)) return "boolean";
  if (/^-?\d+(\.\d+)?$/.test(value)) return "number";
  return "string";
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
    startupSource: project.startupSource,
    statsSource: project.statsSource,
    scenes: project.scenes.map((scene) => ({ ...scene, current: scene.name === activeSceneName })),
  };
}

function commitProject(project: ChoiceForgeProject): ChoiceForgeProject {
  return persistActiveScene(updateSceneCounts(syncDerivedEdges(project)));
}

function persistActiveScene(project: ChoiceForgeProject): ChoiceForgeProject {
  const currentGraph = project.sceneData?.[project.sceneTitle];
  return {
    ...project,
    sceneData: {
      ...(project.sceneData ?? {}),
      [project.sceneTitle]: {
        nodes: project.nodes,
        edges: project.edges,
        sourceText: currentGraph?.sourceText,
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
      ...graph,
      nodes: graph.nodes.map((node) => (node.type === "goto_scene" && node.target === from ? { ...node, target: to, title: `*goto_scene ${to}` } : node)),
      edges: graph.edges,
    },
  ]));
}

function retargetGotoSceneReferences(sceneData: Record<string, SceneGraph>, from: string, to: string): Record<string, SceneGraph> {
  return Object.fromEntries(Object.entries(sceneData).map(([sceneName, graph]) => [
    sceneName,
    {
      ...graph,
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
  const sourceCanFlow = source && !["choice", "if", "ending", "finish", "goto", "goto_scene", "return", "restore_checkpoint"].includes(source.type);
  if (!sourceCanFlow || !target || from === to || project.edges.some((edge) => edge.from === from && edge.to === to && edge.kind === "flow")) return project;
  return commitProject(clearActiveSceneSource({ ...project, edges: [...project.edges, { from, to, kind: "flow" }] }));
}

function clearActiveSceneSource(project: ChoiceForgeProject): ChoiceForgeProject {
  const currentGraph = project.sceneData?.[project.sceneTitle];
  if (!currentGraph?.sourceText) return project;
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

function clearStartupSource(project: ChoiceForgeProject): ChoiceForgeProject {
  if (project.startupSource === undefined) return project;
  const { startupSource: _startupSource, ...nextProject } = project;
  return nextProject;
}

function clearStatsSource(project: ChoiceForgeProject): ChoiceForgeProject {
  if (project.statsSource === undefined) return project;
  const { statsSource: _statsSource, ...nextProject } = project;
  return nextProject;
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

function replaceInputTitle(node: StoryNode, variableName: string): string {
  if (node.type === "input_text") return `*input_text ${variableName}`;
  if (node.type === "input_number") return `*input_number ${variableName}`;
  if (node.type === "rand") return `*rand ${variableName}`;
  return node.title;
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
  if (type === "return") return { ...base, title: "*return" };
  if (type === "finish") return { ...base, title: "*finish" };
  if (type === "checkpoint") return { ...base, title: `*save_checkpoint ${title}` };
  if (type === "restore_checkpoint") return { ...base, title: "*restore_checkpoint" };
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
  if (type === "gosub_scene") return { ...base, title: `*gosub_scene ${firstScene(project)}`, target: firstScene(project) };
  if (type === "image") return { ...base, title: "*image", target: "", inputMin: "none", prompt: "" };
  if (type === "temp") return { ...base, title: "*temp temp_var", inputVar: "temp_var", body: "0" };
  if (type === "params") return { ...base, title: "*params", body: "" };
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
    return: "*return",
    ending: "*ending",
    finish: "*finish",
    checkpoint: "new_checkpoint",
    restore_checkpoint: "*restore_checkpoint",
    page_break: "*page_break",
    comment: "new_comment",
    input_text: "*input_text",
    input_number: "*input_number",
    rand: "*rand",
    gosub_scene: "*gosub_scene",
    image: "*image",
    temp: "*temp",
    params: "*params",
  };
  return titles[type];
}

function defaultNodeWidth(type: NodeType): number {
  if (type === "choice" || type === "fake_choice") return 340;
  if (type === "passage") return 300;
  if (["checkpoint", "restore_checkpoint", "goto_scene", "gosub_scene", "page_break", "comment", "input_text", "input_number", "rand", "image", "temp", "params"].includes(type)) return 280;
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
