import type { ChoiceForgeProject, SceneGraph, StoryNode } from "./types";

export function layoutSceneGraph(graph: SceneGraph): SceneGraph {
  const nodes = layoutStoryNodes(graph.nodes, graph.edges);
  return { nodes, edges: graph.edges };
}

export function layoutProjectGraphs(project: ChoiceForgeProject): ChoiceForgeProject {
  const sceneData = { ...(project.sceneData ?? {}) };
  project.scenes
    .filter((scene) => !scene.isStart && !scene.special)
    .forEach((scene) => {
      const graph = sceneData[scene.name] ?? (scene.name === project.sceneTitle ? { nodes: project.nodes, edges: project.edges } : undefined);
      if (graph) sceneData[scene.name] = layoutSceneGraph(graph);
    });

  const activeGraph = sceneData[project.sceneTitle] ?? layoutSceneGraph({ nodes: project.nodes, edges: project.edges });
  return {
    ...project,
    nodes: activeGraph.nodes,
    edges: activeGraph.edges,
    sceneData: {
      ...sceneData,
      [project.sceneTitle]: activeGraph,
    },
  };
}

function layoutStoryNodes(nodes: StoryNode[], edges: SceneGraph["edges"]): StoryNode[] {
  const horizontalGap = 150;
  const verticalGap = 90;
  const startX = 70;
  const startY = 70;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));

  edges.forEach((edge) => {
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
  let columnX = startX;
  orderedColumns.forEach(([, columnNodes]) => {
    const sortedNodes = [...columnNodes].sort((a, b) => {
      if (a.id === "n1") return -1;
      if (b.id === "n1") return 1;
      return a.y - b.y || a.x - b.x;
    });
    let nodeY = startY;
    sortedNodes.forEach((node) => {
      positions.set(node.id, { x: columnX, y: nodeY });
      nodeY += estimateLayoutNodeHeight(node) + verticalGap;
    });
    const maxWidth = Math.max(...sortedNodes.map((node) => node.w), 260);
    columnX += maxWidth + horizontalGap;
  });

  return nodes.map((node) => ({ ...node, ...(positions.get(node.id) ?? {}) }));
}

function estimateLayoutNodeHeight(node: StoryNode): number {
  let height = 58 + Math.max(0, Math.ceil(node.title.length / Math.max(12, node.w / 13)) - 1) * 14;
  if (node.body) height += 90;
  if (node.prompt) height += 28;
  if (node.options) height += node.options.length * 38 + 8;
  if (node.fakeOptions) height += node.fakeOptions.length * 38 + 8;
  if (node.branches) height += node.branches.reduce((total, branch) => total + 24 + (branch.sets?.length ?? 0) * 22, 8);
  if (node.sets?.length) height += 30;
  if (node.target) height += 22;
  if (node.inputVar) height += 22;
  return Math.max(80, height);
}
