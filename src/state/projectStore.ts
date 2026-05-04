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
  addVariable: () => void;
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
    addVariable: () => {
      setProjectState((current) => {
        const name = nextAvailableName("new_var", new Set(current.variables.map((variable) => variable.name)));
        const variable: VariableSummary = { name, type: "number", initial: "0", desc: "", uses: 0 };
        return { ...current, variables: [...current.variables, variable] };
      });
    },
  }), []);

  return { project, lintedProject, actions };
}

function nextAvailableName(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}
