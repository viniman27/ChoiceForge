import { useEffect, useMemo, useState } from "react";
import { sampleProjects } from "../data/sampleProject";
import { lintProject } from "../domain/choicescript";
import type { ChoiceForgeProject, Language, SceneSummary, StoryNode, VariableSummary } from "../domain/types";

const STORAGE_KEY = "choiceforge.project.v1";

function cloneProject(project: ChoiceForgeProject): ChoiceForgeProject {
  return structuredClone(project);
}

function loadInitialProject(): ChoiceForgeProject {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return cloneProject(sampleProjects.pt);

  try {
    return JSON.parse(saved) as ChoiceForgeProject;
  } catch {
    return cloneProject(sampleProjects.pt);
  }
}

export interface ProjectActions {
  setProject: (project: ChoiceForgeProject) => void;
  resetProject: (language: Language) => ChoiceForgeProject;
  updateNode: (id: string, patch: Partial<StoryNode>) => void;
  moveNode: (id: string, x: number, y: number) => void;
  addScene: () => void;
  updateScene: (id: string, patch: Partial<SceneSummary>) => void;
  duplicateScene: (id: string) => void;
  deleteScene: (id: string) => void;
  addVariable: () => void;
  updateVariable: (name: string, patch: Partial<VariableSummary>) => void;
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
      setProjectState(nextProject);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProject));
    },
    resetProject: (language) => {
      const fresh = cloneProject(sampleProjects[language]);
      setProjectState(fresh);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    },
    updateNode: (id, patch) => {
      setProjectState((current) => ({
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

        return {
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
        };
      });
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

function normalizeIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^[^a-z_]+/, "")
    .replace(/_+/g, "_");
}
