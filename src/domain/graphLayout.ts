import type { ChoiceForgeProject, SceneGraph, StoryEdge, StoryNode } from "./types";

export function layoutSceneGraph(graph: SceneGraph, nodeHeights?: Record<string, number>): SceneGraph {
  const nodes = layoutStoryNodes(graph.nodes, graph.edges, nodeHeights);
  return { ...graph, nodes, edges: graph.edges };
}

export function layoutProjectGraphs(project: ChoiceForgeProject): ChoiceForgeProject {
  const sceneData = { ...(project.sceneData ?? {}) };
  project.scenes
    .filter((scene) => !scene.isStart && !scene.special)
    .forEach((scene) => {
      const graph = sceneData[scene.name] ?? (scene.name === project.sceneTitle ? { nodes: project.nodes, edges: project.edges } : undefined);
      if (graph && (scene.name === project.sceneTitle || !graph.sourceText)) {
      sceneData[scene.name] = layoutSceneGraph(graph);
    }
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

function layoutStoryNodes(nodes: StoryNode[], edges: SceneGraph["edges"], nodeHeights?: Record<string, number>): StoryNode[] {
  const horizontalGap = 150;
  const verticalGap = 100;
  const startX = 70;
  const startY = 70;
  const heightOf = (node: StoryNode) => nodeHeights?.[node.id] ?? estimateLayoutNodeHeight(node);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const predecessors = new Map(nodes.map((node) => [node.id, [] as string[]]));

  layoutEdges(nodes, edges).forEach((edge) => {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) return;
    outgoing.get(edge.from)?.push(edge.to);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    predecessors.get(edge.to)?.push(edge.from);
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

  let maxDepth = 0;
  depth.forEach((v) => { if (v > maxDepth) maxDepth = v; });
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
    // Barycenter sort: order nodes by mean Y of already-placed predecessors.
    const withBc = columnNodes.map((node) => {
      if (node.id === "n1") return { node, bc: startY };
      const predYs = (predecessors.get(node.id) ?? [])
        .map((p) => positions.get(p)?.y)
        .filter((y): y is number => y !== undefined);
      const bc = predYs.length === 0
        ? startY
        : predYs.reduce((a, b) => a + b, 0) / predYs.length;
      return { node, bc };
    });
    withBc.sort((a, b) => a.bc - b.bc);

    // Vertically centre the column around the mean predecessor Y so that
    // edges flow roughly horizontally instead of sharply up/down.
    const totalColHeight = withBc.reduce(
      (sum, { node }) => sum + heightOf(node) + verticalGap, 0,
    ) - verticalGap;
    const meanBc = withBc.reduce((sum, { bc }) => sum + bc, 0) / withBc.length;
    let nodeY = Math.max(startY, Math.round(meanBc - totalColHeight / 2));

    withBc.forEach(({ node }) => {
      positions.set(node.id, { x: columnX, y: nodeY });
      nodeY += heightOf(node) + verticalGap;
    });
    const maxWidth = columnNodes.reduce((acc, node) => node.w > acc ? node.w : acc, 260);
    columnX += maxWidth + horizontalGap;
  });

  return nodes.map((node) => ({ ...node, ...(positions.get(node.id) ?? {}) }));
}

function layoutEdges(nodes: StoryNode[], edges: StoryEdge[]): StoryEdge[] {
  const seen = new Set<string>();
  return [...edges, ...deriveNodeEdges(nodes)].filter((edge) => {
    const key = `${edge.from}:${edge.to}:${edge.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
      const target = labels.get(gosubTarget(node.title));
      return target ? [{ from: node.id, to: target, kind: "goto", label: "*gosub" }] : [];
    }

    return [];
  });
}

function stripCommandPrefix(value: string, command: string): string {
  return value.replace(command, "").replace(/^[-\s]+/, "").trim();
}

function gosubTarget(value: string): string {
  return stripCommandPrefix(value, "*gosub").split(/\s+/)[0] ?? "";
}

function estimateLayoutNodeHeight(node: StoryNode): number {
  const titleCharsPerLine = Math.max(12, Math.floor(node.w / 13));
  // option text width: node width minus opt-num col (22px) + opts padding (16px) + opt padding (16px) + gap (6px)
  const optCharsPerLine = Math.max(12, Math.floor((node.w - 60) / 7));

  let height = 58 + Math.max(0, Math.ceil(node.title.length / titleCharsPerLine) - 1) * 14;
  if (node.body) height += 56; // always 2-line clamp: 2×(13px×1.5) + 14px padding
  if (node.prompt) height += 40;
  if (node.options) {
    height += 8;
    node.options.forEach((opt) => {
      height += 15 + Math.max(1, Math.ceil(opt.text.length / optCharsPerLine)) * 16;
      if (opt.cond) height += 26;
      if (opt.reuse || opt.hideReuse) height += 16;
      if (opt.body) height += 20;
    });
  }
  if (node.fakeOptions) {
    height += 8;
    node.fakeOptions.forEach((opt) => {
      height += 15 + Math.max(1, Math.ceil(opt.text.length / optCharsPerLine)) * 16;
      if (opt.cond) height += 26;
      if (opt.reuse || opt.hideReuse) height += 16;
      if (opt.body) height += 20;
    });
  }
  if (node.branches) height += node.branches.reduce((total, branch) => total + 26 + (branch.sets?.length ?? 0) * 22, 8);
  if (node.sets?.length) height += 30;
  if (node.target) height += 22;
  if (node.inputVar) height += 22;
  return Math.max(80, Math.ceil(height * 1.15));
}
