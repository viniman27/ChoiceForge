import { useEffect, useMemo, useState } from "react";
import { sampleProjects } from "../data/sampleProject";
import { lintProject } from "../domain/choicescript";
import type { AchievementSummary, ChoiceForgeProject, Language, NodeType, SceneSummary, StoryEdge, StoryNode, VariableSummary } from "../domain/types";

const STORAGE_KEY = "choiceforge.project.v1";

function cloneProject(project: ChoiceForgeProject): ChoiceForgeProject {
  return structuredClone(project);
}

function loadInitialProject(): ChoiceForgeProject {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return syncDerivedEdges(cloneProject(sampleProjects.pt));

  try {
    return syncDerivedEdges(JSON.parse(saved) as ChoiceForgeProject);
  } catch {
    return syncDerivedEdges(cloneProject(sampleProjects.pt));
  }
}

export interface ProjectActions {
  setProject: (project: ChoiceForgeProject) => void;
  resetProject: (language: Language) => ChoiceForgeProject;
  updateNode: (id: string, patch: Partial<StoryNode>) => void;
  moveNode: (id: string, x: number, y: number) => void;
  addNode: (type: NodeType, id: string, position: { x: number; y: number }) => void;
  deleteNode: (id: string) => void;
  addScene: () => void;
  updateScene: (id: string, patch: Partial<SceneSummary>) => void;
  duplicateScene: (id: string) => void;
  deleteScene: (id: string) => void;
  addVariable: () => void;
  updateVariable: (name: string, patch: Partial<VariableSummary>) => void;
  addAchievement: () => void;
  updateAchievement: (id: string, patch: Partial<AchievementSummary>) => void;
  deleteAchievement: (id: string) => void;
}

export function useProjectStore() {
  const [project, setProjectState] = useState(loadInitialProject);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    }, 400);

    return () => window.clearTimeout(handle);
  }, [project]);

  const lintedProject = useMemo(() => ({ ...project, lints: lintProject(project) }), [project]);

  const actions = useMemo<ProjectActions>(() => ({
    setProject: (nextProject) => {
      const syncedProject = syncDerivedEdges(nextProject);
      setProjectState(syncedProject);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(syncedProject));
    },
    resetProject: (language) => {
      const fresh = syncDerivedEdges(cloneProject(sampleProjects[language]));
      setProjectState(fresh);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    },
    updateNode: (id, patch) => {
      setProjectState((current) => syncDerivedEdges({
        ...current,
        nodes: current.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
      }));
    },
    moveNode: (id, x, y) => {
      setProjectState((current) => ({
        ...current,
        nodes: current.nodes.map((node) => (node.id === id ? { ...node, x, y } : node)),
      }));
    },
    addNode: (type, id, position) => {
      setProjectState((current) => {
        if (current.nodes.some((node) => node.id === id)) return current;
        const node = createStoryNode(type, id, position, current);
        return syncDerivedEdges({
          ...current,
          nodes: [...current.nodes, node],
          scenes: current.scenes.map((scene) => (
            scene.name === current.sceneTitle ? { ...scene, nodes: scene.nodes + 1 } : scene
          )),
        });
      });
    },
    deleteNode: (id) => {
      setProjectState((current) => {
        if (current.nodes.length <= 1) return current;
        const nodes = current.nodes.filter((node) => node.id !== id);
        if (nodes.length === current.nodes.length) return current;

        return syncDerivedEdges({
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
    addScene: () => {
      setProjectState((current) => {
        const name = nextAvailableName("new_scene", new Set(current.scenes.map((scene) => scene.name)));
        const scene: SceneSummary = { id: name, name, words: 0, nodes: 0 };
        return { ...current, scenes: [...current.scenes, scene] };
      });
    },
    updateScene: (id, patch) => {
      setProjectState((current) => {
        const currentScene = current.scenes.find((scene) => scene.id === id);
        if (!currentScene || currentScene.isStart || currentScene.special) return current;

        const nextName = patch.name ? normalizeIdentifier(patch.name) : undefined;
        const shouldRename = Boolean(nextName && nextName !== currentScene.name);

        return {
          ...current,
          sceneTitle: current.sceneTitle === currentScene.name && nextName ? nextName : current.sceneTitle,
          scenes: current.scenes.map((scene) => (scene.id === id ? { ...scene, ...patch, id: nextName || scene.id, name: nextName || scene.name } : scene)),
          nodes: shouldRename ? current.nodes.map((node) => (node.type === "goto_scene" && node.target === currentScene.name ? { ...node, target: nextName } : node)) : current.nodes,
        };
      });
    },
    duplicateScene: (id) => {
      setProjectState((current) => {
        const scene = current.scenes.find((candidate) => candidate.id === id);
        if (!scene) return current;
        const name = nextAvailableName(`${scene.name}_copy`, new Set(current.scenes.map((candidate) => candidate.name)));
        return { ...current, scenes: [...current.scenes, { ...scene, id: name, name, current: false, isStart: false, special: false }] };
      });
    },
    deleteScene: (id) => {
      setProjectState((current) => {
        const scene = current.scenes.find((candidate) => candidate.id === id);
        if (!scene || scene.isStart || scene.special || current.scenes.filter((candidate) => !candidate.special).length <= 2) return current;
        return {
          ...current,
          scenes: current.scenes.filter((candidate) => candidate.id !== id),
          nodes: current.nodes.map((node) => (node.type === "goto_scene" && node.target === scene.name ? { ...node, target: undefined } : node)),
        };
      });
    },
    addVariable: () => {
      setProjectState((current) => {
        const name = nextAvailableName("new_var", new Set(current.variables.map((variable) => variable.name)));
        const variable: VariableSummary = { name, type: "number", initial: "0", desc: "", uses: 0 };
        return { ...current, variables: [...current.variables, variable] };
      });
    },
    updateVariable: (name, patch) => {
      setProjectState((current) => {
        const nextName = patch.name?.trim();
        const shouldRename = Boolean(nextName && nextName !== name);

        return syncDerivedEdges({
          ...current,
          variables: current.variables.map((variable) => (variable.name === name ? { ...variable, ...patch, name: nextName || variable.name } : variable)),
          nodes: shouldRename ? current.nodes.map((node) => ({
            ...node,
            body: node.body ? renameVariableReferences(node.body, name, nextName!) : node.body,
            sets: node.sets?.map((set) => (set.var === name ? { ...set, var: nextName! } : set)),
            options: node.options?.map((option) => ({
              ...option,
              cond: option.cond ? { ...option.cond, expr: renameExpressionName(option.cond.expr, name, nextName!) } : option.cond,
            })),
            branches: node.branches?.map((branch) => ({
              ...branch,
              expr: branch.expr ? renameExpressionName(branch.expr, name, nextName!) : branch.expr,
            })),
          })) : current.nodes,
        });
      });
    },
    addAchievement: () => {
      setProjectState((current) => {
        const id = nextAvailableName("new_achievement", new Set(current.achievements.map((achievement) => achievement.id)));
        const achievement: AchievementSummary = {
          id,
          title: "Nova conquista",
          points: 5,
          desc: "Descricao da conquista.",
          preDesc: "Conquista bloqueada.",
          postDesc: "Conquista desbloqueada.",
        };
        return { ...current, achievements: [...current.achievements, achievement] };
      });
    },
    updateAchievement: (id, patch) => {
      setProjectState((current) => {
        const nextId = patch.id ? normalizeIdentifier(patch.id) : undefined;
        return {
          ...current,
          achievements: current.achievements.map((achievement) => (
            achievement.id === id ? { ...achievement, ...patch, id: nextId || achievement.id } : achievement
          )),
        };
      });
    },
    deleteAchievement: (id) => {
      setProjectState((current) => ({
        ...current,
        achievements: current.achievements.filter((achievement) => achievement.id !== id),
      }));
    },
  }), []);

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

function syncDerivedEdges(project: ChoiceForgeProject): ChoiceForgeProject {
  const manualEdges = project.edges.filter((edge) => edge.kind === "flow");
  return { ...project, edges: [...manualEdges, ...deriveNodeEdges(project.nodes)] };
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

function createStoryNode(type: NodeType, id: string, position: { x: number; y: number }, project: ChoiceForgeProject): StoryNode {
  const title = nextAvailableName(defaultNodeTitle(type), new Set(project.nodes.map((node) => node.title)));
  const base = { id, type, x: position.x, y: position.y, w: defaultNodeWidth(type), title };

  if (type === "passage") return { ...base, body: "Novo trecho narrativo." };
  if (type === "choice") return { ...base, prompt: "O que acontece agora?", options: [] };
  if (type === "if") return { ...base, branches: [{ kind: "if", expr: "true", to: project.nodes[0]?.id ?? id }] };
  if (type === "set") return { ...base, sets: [{ var: project.variables[0]?.name ?? "variavel", op: "=", val: "0" }] };
  if (type === "label") return { ...base, title: `*label ${title}` };
  if (type === "goto") return { ...base, title: `*goto ${firstLabel(project) || "label"}` };
  if (type === "goto_scene") return { ...base, title: `*goto_scene ${firstScene(project)}`, target: firstScene(project) };
  if (type === "gosub") return { ...base, title: "*gosub subrotina" };
  if (type === "checkpoint") return { ...base, title: `*save_checkpoint ${title}` };
  return { ...base, title: "*ending" };
}

function defaultNodeTitle(type: NodeType): string {
  const titles: Record<NodeType, string> = {
    passage: "novo_trecho",
    choice: "nova_escolha",
    if: "nova_condicao",
    set: "*set",
    label: "novo_label",
    goto: "*goto",
    goto_scene: "*goto_scene",
    gosub: "*gosub",
    ending: "*ending",
    checkpoint: "novo_checkpoint",
  };
  return titles[type];
}

function defaultNodeWidth(type: NodeType): number {
  if (type === "choice") return 340;
  if (type === "passage") return 300;
  return 240;
}

function firstLabel(project: ChoiceForgeProject): string {
  return project.nodes.find((node) => node.type === "label")?.title.replace("*label", "").trim() ?? "";
}

function firstScene(project: ChoiceForgeProject): string {
  return project.scenes.find((scene) => !scene.isStart && !scene.special)?.name ?? project.sceneTitle;
}

function normalizeIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^[^a-z_]+/, "")
    .replace(/_+/g, "_");
}
