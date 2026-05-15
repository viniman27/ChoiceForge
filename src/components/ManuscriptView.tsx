import { COLOR_TAG_VALUES } from "./NodeCard";
import type { ChoiceForgeProject, StoryEdge, StoryNode } from "../domain/types";

interface ManuscriptViewProps {
  data: ChoiceForgeProject;
  onClose: () => void;
}

export function ManuscriptView({ data, onClose }: ManuscriptViewProps) {
  const ordered = narrativeOrder(data.nodes, data.edges);
  const wordCount = countWords(ordered);
  const passageCount = ordered.filter((n) => hasNarrativeContent(n)).length;

  return (
    <div className="ms-wrap">
      <div className="ms-toolbar">
        <div className="ms-meta">
          <span className="ms-scene">{data.sceneTitle}.txt</span>
          <span className="ms-stats">{wordCount.toLocaleString()} words · {passageCount} passages</span>
        </div>
        <button className="ms-close" onClick={onClose}>← back to editor</button>
      </div>

      <div className="ms-body">
        <div className="ms-content">
          {ordered.map((node) => <NodeBlock key={node.id} node={node} />)}
        </div>
      </div>
    </div>
  );
}

function NodeBlock({ node }: { node: StoryNode }) {
  if (node.type === "passage") {
    return (
      <section className="ms-passage">
        <h2 className="ms-node-title">
          {node.colorTag && <span className="ms-color-dot" style={{ background: COLOR_TAG_VALUES[node.colorTag] }} />}
          {node.title}
        </h2>
        {node.body && <div className="ms-prose">{renderBody(node.body)}</div>}
        {node.note && <aside className="ms-note">✎ {node.note}</aside>}
      </section>
    );
  }

  if (node.type === "choice" || node.type === "fake_choice") {
    return (
      <section className="ms-choice">
        {node.prompt && <p className="ms-prompt">{node.prompt}</p>}
        <ul className="ms-options">
          {(node.options ?? node.fakeOptions ?? []).map((opt, i) => (
            <li key={i} className="ms-option">
              <span className="ms-option-num">{i + 1}.</span>
              <span className="ms-option-text">{"text" in opt ? opt.text : ""}</span>
            </li>
          ))}
        </ul>
        {node.note && <aside className="ms-note">✎ {node.note}</aside>}
      </section>
    );
  }

  if (node.type === "page_break") {
    return <hr className="ms-break" />;
  }

  if (node.type === "if") {
    return (
      <div className="ms-structural">
        <span className="ms-cmd">*if</span>
        {node.branches?.map((b, i) => (
          <span key={i} className="ms-branch-label">{b.kind}{b.expr ? ` (${b.expr})` : ""}</span>
        ))}
        {node.note && <aside className="ms-note">✎ {node.note}</aside>}
      </div>
    );
  }

  if (node.type === "goto_scene" || node.type === "gosub_scene") {
    return (
      <div className="ms-structural">
        <span className="ms-cmd">*{node.type === "goto_scene" ? "goto_scene" : "gosub_scene"}</span>
        <span className="ms-target">{node.target}</span>
      </div>
    );
  }

  if (["goto", "label", "gosub", "return", "finish", "ending", "checkpoint", "restore_checkpoint"].includes(node.type)) {
    return (
      <div className="ms-structural">
        <span className="ms-cmd">*{node.type}</span>
        {node.target && <span className="ms-target">{node.target}</span>}
        {node.title && node.title !== `*${node.type}` && <span className="ms-target">{node.title}</span>}
      </div>
    );
  }

  return null;
}

function renderBody(text: string) {
  return text.split("\n\n").map((para, i) => (
    <p key={i} className="ms-para">
      {para.split("\n").map((line, j) => (
        <span key={j}>{j > 0 && <br />}{line}</span>
      ))}
    </p>
  ));
}

function hasNarrativeContent(node: StoryNode): boolean {
  return Boolean(node.body || node.prompt || (node.options?.length ?? 0) > 0 || (node.fakeOptions?.length ?? 0) > 0);
}

function countWords(nodes: StoryNode[]): number {
  const text = nodes.flatMap((n) => [n.body ?? "", n.prompt ?? "", ...(n.options?.map((o) => o.text) ?? [])]).join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}

function narrativeOrder(nodes: StoryNode[], edges: StoryEdge[]): StoryNode[] {
  if (!nodes.length) return [];
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) adj.get(e.from)?.push(e.to);

  const visited = new Set<string>();
  const order: StoryNode[] = [];

  const dfs = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const node = nodes.find((n) => n.id === id);
    if (node) order.push(node);
    for (const next of adj.get(id) ?? []) dfs(next);
  };

  dfs(nodes[0].id);
  for (const n of nodes) if (!visited.has(n.id)) { visited.add(n.id); order.push(n); }
  return order;
}
