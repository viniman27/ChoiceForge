import { useEffect, useMemo, useState } from "react";
import { sampleProjects } from "../data/sampleProject";
import { lintProject } from "../domain/choicescript";
import type { ChoiceForgeProject, Language, StoryNode } from "../domain/types";

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
  }), []);

  return { project, lintedProject, actions };
}
