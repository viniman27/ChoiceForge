import { useState } from "react";
import { COLOR_TAG_VALUES } from "./NodeCard";
import type { ChoiceForgeProject, StoryEdge, StoryNode } from "../domain/types";

interface ManuscriptViewProps {
  data: ChoiceForgeProject;
  onClose: () => void;
  onNavigateToNode?: (sceneName: string, nodeId: string) => void;
}

type Scope = "scene" | "project";

interface SceneSection {
  name: string;
  nodes: StoryNode[];
}

export function ManuscriptView({ data, onClose, onNavigateToNode }: ManuscriptViewProps) {
  const [scope, setScope] = useState<Scope>("scene");
  const [copied, setCopied] = useState(false);

  const sceneSection: SceneSection = {
    name: data.sceneTitle,
    nodes: narrativeOrder(data.nodes, data.edges),
  };

  const projectSections: SceneSection[] = buildProjectSections(data);

  const sections = scope === "project" ? projectSections : [sceneSection];
  const allNodes = sections.flatMap((s) => s.nodes);
  const wordCount = countWords(allNodes);
  const passageCount = allNodes.filter(hasNarrativeContent).length;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  const handleDownload = () => {
    const text = scope === "project"
      ? generateProjectText(projectSections, data)
      : generateSceneText(sceneSection.nodes, data);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = scope === "project" ? `${data.title}_full_manuscript.txt` : `${data.sceneTitle}_manuscript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    const text = scope === "project"
      ? generateProjectText(projectSections, data)
      : generateSceneText(sceneSection.nodes, data);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scopeLabel = scope === "project"
    ? `${data.title} (${projectSections.length} scenes)`
    : `${data.sceneTitle}.txt`;

  return (
    <div className="ms-wrap">
      <div className="ms-toolbar">
        <div className="ms-meta">
          <span className="ms-scene">{scopeLabel}</span>
          <span className="ms-stats">{wordCount.toLocaleString()} words · {passageCount} passages · ~{readingMinutes} min</span>
        </div>
        <div className="ms-actions">
          <div className="ms-scope-toggle">
            <button
              className={`ms-scope-btn${scope === "scene" ? " is-active" : ""}`}
              onClick={() => setScope("scene")}
              title="Current scene only"
            >scene</button>
            <button
              className={`ms-scope-btn${scope === "project" ? " is-active" : ""}`}
              onClick={() => setScope("project")}
              title="All scenes in order"
            >project</button>
          </div>
          <button className="ms-action-btn" onClick={handleCopy} title="Copy to clipboard">
            {copied ? "✓ copied" : "copy"}
          </button>
          <button className="ms-action-btn" onClick={handleDownload} title="Download as .txt">
            ↓ download
          </button>
          <button className="ms-close" onClick={onClose}>← back to editor</button>
        </div>
      </div>

      <div className="ms-body">
        <div className="ms-content">
          {sections.map((section, si) => (
            <div key={section.name}>
              {scope === "project" && (
                <div className="ms-scene-divider">
                  <span className="ms-scene-divider-name">{section.name}.txt</span>
                </div>
              )}
              {section.nodes.map((node) => (
                <NodeBlock key={`${section.name}-${node.id}`} node={node} sceneName={section.name} onNavigate={onNavigateToNode} />
              ))}
              {scope === "project" && si < sections.length - 1 && (
                <div className="ms-scene-end" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NodeBlock({ node, sceneName, onNavigate }: { node: StoryNode; sceneName: string; onNavigate?: (sceneName: string, nodeId: string) => void }) {
  const titleEl = (
    <h2
      className={`ms-node-title${onNavigate ? " ms-node-title-link" : ""}`}
      onClick={onNavigate ? () => onNavigate(sceneName, node.id) : undefined}
      title={onNavigate ? "Jump to this node in the editor" : undefined}
    >
      {node.colorTag && <span className="ms-color-dot" style={{ background: COLOR_TAG_VALUES[node.colorTag] }} />}
      {node.title}
      {node.status === "todo" && <span className="ms-todo-badge">todo</span>}
    </h2>
  );

  if (node.type === "passage") {
    return (
      <section className="ms-passage">
        {titleEl}
        {node.body && <div className="ms-prose">{renderBody(node.body)}</div>}
        {node.note && <aside className="ms-note">✎ {node.note}</aside>}
      </section>
    );
  }

  if (node.type === "choice" || node.type === "fake_choice") {
    return (
      <section className="ms-choice">
        {titleEl}
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

function buildProjectSections(data: ChoiceForgeProject): SceneSection[] {
  return data.scenes
    .filter((s) => !s.special)
    .map((s) => {
      const isActive = s.name === data.sceneTitle;
      const graph = isActive ? { nodes: data.nodes, edges: data.edges } : (data.sceneData?.[s.name] ?? { nodes: [], edges: [] });
      return { name: s.name, nodes: narrativeOrder(graph.nodes, graph.edges) };
    })
    .filter((s) => s.nodes.length > 0);
}

function generateSceneText(ordered: StoryNode[], data: ChoiceForgeProject): string {
  const ruler = "=".repeat(72);
  return [
    data.title,
    `by ${data.author}`,
    `Scene: ${data.sceneTitle}`,
    ruler,
    "",
    ...nodeListToLines(ordered),
  ].join("\n").trimEnd() + "\n";
}

function generateProjectText(sections: SceneSection[], data: ChoiceForgeProject): string {
  const ruler = "=".repeat(72);
  const lines: string[] = [
    data.title,
    `by ${data.author}`,
    ruler,
    "",
  ];
  for (const section of sections) {
    lines.push(`~~~ ${section.name} ~~~`, "");
    lines.push(...nodeListToLines(section.nodes));
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

function nodeListToLines(nodes: StoryNode[]): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    if (node.type === "passage") {
      lines.push(`--- ${node.title} ---`, "");
      if (node.body) {
        lines.push(...node.body.split("\n\n").map((p) => p.replace(/\n/g, " ")));
        lines.push("");
      }
      if (node.note) lines.push(`[Note: ${node.note}]`, "");
    } else if (node.type === "choice" || node.type === "fake_choice") {
      if (node.prompt) lines.push(`> ${node.prompt}`, "");
      const opts = node.options ?? node.fakeOptions ?? [];
      opts.forEach((opt, i) => lines.push(`  ${i + 1}. ${"text" in opt ? opt.text : ""}`));
      if (opts.length) lines.push("");
      if (node.note) lines.push(`[Note: ${node.note}]`, "");
    } else if (node.type === "page_break") {
      lines.push("* * *", "");
    }
  }
  return lines;
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
