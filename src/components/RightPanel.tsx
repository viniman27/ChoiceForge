import { useState } from "react";
import { generateNodeChoiceScript } from "../domain/choicescript";
import type { ChoiceForgeProject, ChoiceCondition, ChoiceOption, I18nLabels, StoryEdge, StoryNode, VariableSet } from "../domain/types";
import { NodeIcon, typeColors } from "./NodeCard";

interface RightPanelProps {
  node: StoryNode | null;
  project: ChoiceForgeProject;
  labels: I18nLabels;
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void;
  onAddFlowEdge: (from: string, to: string) => void;
  onDeleteFlowEdge: (from: string, to: string) => void;
}

export function RightPanel({ node, project, labels, onUpdateNode, onAddFlowEdge, onDeleteFlowEdge }: RightPanelProps) {
  const [tab, setTab] = useState<"content" | "logic" | "raw">("content");

  if (!node) {
    return (
      <aside className="right-panel">
        <div className="empty-inspector">
          <h3>{labels.inspector}</h3>
          <p>Selecione um no no canvas para inspecionar e editar.</p>
        </div>
      </aside>
    );
  }

  const colors = typeColors[node.type];
  return (
    <aside className="right-panel">
      <div className="ip-head" style={{ "--accent": colors.dot, "--accent-tint": colors.tint } as React.CSSProperties}>
        <div className="ip-type"><span className="ip-dot" /><NodeIcon type={node.type} /><span>{labels.nodeTypes[node.type]}</span></div>
        <input className="ip-title" value={node.title} onChange={(event) => onUpdateNode(node.id, { title: event.target.value })} />
        <div className="ip-meta"><span><code>scene:</code> intro_grid</span><span>-</span><span><code>id:</code> {node.id}</span></div>
      </div>

      <div className="ip-tabs">
        {(["content", "logic", "raw"] as const).map((id, index) => (
          <button key={id} className={`ip-tab ${tab === id ? "is-active" : ""}`} onClick={() => setTab(id)}>
            {labels.inspectorTabs[index]}
          </button>
        ))}
      </div>

      <div className="ip-body">
        {tab === "content" && <ContentTab node={node} project={project} labels={labels} onUpdateNode={onUpdateNode} />}
        {tab === "logic" && (
          <LogicTab
            node={node}
            project={project}
            onUpdateNode={onUpdateNode}
            onAddFlowEdge={onAddFlowEdge}
            onDeleteFlowEdge={onDeleteFlowEdge}
          />
        )}
        {tab === "raw" && <RawTab node={node} />}
      </div>

      <div className="ip-footer"><span className="ok-pill">{labels.linterPasses}</span><span className="dim">{labels.indentRule}</span></div>
    </aside>
  );
}

function ContentTab({
  node,
  project,
  labels,
  onUpdateNode,
}: {
  node: StoryNode;
  project: ChoiceForgeProject;
  labels: I18nLabels;
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void;
}) {
  if (node.type === "passage") {
    return (
      <div className="ip-content">
        <label className="ip-label">{labels.bodyLabel}</label>
        <textarea className="narr-editor" value={node.body ?? ""} onChange={(event) => onUpdateNode(node.id, { body: event.target.value })} spellCheck />
        {node.sets && <SetsList node={node} project={project} onUpdateNode={onUpdateNode} />}
      </div>
    );
  }

  if (node.type === "choice") {
    return (
      <div className="ip-content">
        <label className="ip-label">{labels.choiceLabel}</label>
        <input className="ip-prompt" value={node.prompt ?? ""} onChange={(event) => onUpdateNode(node.id, { prompt: event.target.value })} />
        <label className="ip-label">#options</label>
        <ul className="ip-opts">
          {node.options?.map((option, index) => (
            <li key={`${option.text}-${index}`} className="ip-opt-row">
              <div className="ip-opt-head">
                <span className="opt-num">#{index + 1}</span>
                <input className="ip-opt-text" value={option.text} onChange={(event) => updateOption(node, index, { text: event.target.value }, onUpdateNode)} />
                <button className="x-btn" onClick={() => removeOption(node, index, onUpdateNode)}>x</button>
              </div>
              <div className="ip-opt-cond">
                <select
                  value={option.cond?.type ?? "none"}
                  onChange={(event) => updateOptionCondition(node, index, event.target.value, onUpdateNode)}
                >
                  <option value="none">sem condicao</option><option value="if">*if</option><option value="selectable_if">*selectable_if</option>
                </select>
                {option.cond && <input className="cond-input" value={option.cond.expr} onChange={(event) => updateOption(node, index, { cond: { ...option.cond!, expr: event.target.value } }, onUpdateNode)} />}
                <select value={option.to} onChange={(event) => updateOption(node, index, { to: event.target.value }, onUpdateNode)}>
                  {project.nodes.map((target) => <option key={target.id} value={target.id}>{target.id} - {target.title}</option>)}
                </select>
              </div>
            </li>
          ))}
        </ul>
        <button className="ghost-btn" onClick={() => addOption(node, project, onUpdateNode)}>{labels.addOption}</button>
      </div>
    );
  }

  return <div className="ip-content"><p className="dim">No simples - sem campos de conteudo.</p></div>;
}

function SetsList({ node, project, onUpdateNode }: { node: StoryNode; project: ChoiceForgeProject; onUpdateNode: (id: string, patch: Partial<StoryNode>) => void }) {
  return (
    <>
      <label className="ip-label">*set</label>
      <ul className="ip-sets">
        {node.sets?.map((set, index) => (
          <li key={`${set.var}-${index}`} className="ip-set-row">
            <select value={set.var} onChange={(event) => updateSet(node, index, { var: event.target.value }, onUpdateNode)}>
              {project.variables.map((variable) => <option key={variable.name} value={variable.name}>{variable.name}</option>)}
            </select>
            <select value={set.op} onChange={(event) => updateSet(node, index, { op: event.target.value as VariableSet["op"] }, onUpdateNode)}><option>=</option><option>+</option><option>-</option><option>%+</option><option>%-</option></select>
            <input value={set.val} onChange={(event) => updateSet(node, index, { val: event.target.value }, onUpdateNode)} />
            <button className="x-btn" onClick={() => removeSet(node, index, onUpdateNode)}>x</button>
          </li>
        ))}
        <li><button className="ghost-btn" onClick={() => addSet(node, project, onUpdateNode)}>+ *set</button></li>
      </ul>
    </>
  );
}

function LogicTab({
  node,
  project,
  onUpdateNode,
  onAddFlowEdge,
  onDeleteFlowEdge,
}: {
  node: StoryNode;
  project: ChoiceForgeProject;
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void;
  onAddFlowEdge: (from: string, to: string) => void;
  onDeleteFlowEdge: (from: string, to: string) => void;
}) {
  const fallbackTarget = project.nodes.find((target) => target.id !== node.id)?.id ?? node.id;
  const [flowTarget, setFlowTarget] = useState(fallbackTarget);
  const selectedFlowTarget = project.nodes.some((target) => target.id === flowTarget && target.id !== node.id) ? flowTarget : fallbackTarget;

  if (node.type === "if") {
    return (
      <div className="ip-logic">
        <label className="ip-label">branches</label>
        <ul className="ip-branches">
          {node.branches?.map((branch, index) => (
            <li key={`${branch.kind}-${index}`} className={`ip-branch branch-${branch.kind}`}>
              <span className="branch-key">*{branch.kind}</span>
              {branch.kind !== "else" && <input className="cond-input wide" value={branch.expr ?? ""} onChange={(event) => updateBranch(node, index, { expr: event.target.value }, onUpdateNode)} />}
              <select value={branch.to} onChange={(event) => updateBranch(node, index, { to: event.target.value }, onUpdateNode)}>
                {project.nodes.map((target) => <option key={target.id} value={target.id}>{target.id} - {target.title}</option>)}
              </select>
            </li>
          ))}
        </ul>
        <OutgoingEdges node={node} project={project} onDeleteFlowEdge={onDeleteFlowEdge} />
      </div>
    );
  }

  return (
    <div className="ip-logic">
      <label className="ip-label">estrutura logica</label>
      <pre className="cond-final"><code>{node.branches?.map((branch) => `*${branch.kind}${branch.expr ? ` (${branch.expr})` : ""} -> ${branch.to}`).join("\n") || "sem branches"}</code></pre>
      <label className="ip-label">fluxo visual</label>
      <div className="flow-editor">
        <select value={selectedFlowTarget} onChange={(event) => setFlowTarget(event.target.value)}>
          {project.nodes.filter((target) => target.id !== node.id).map((target) => <option key={target.id} value={target.id}>{target.id} - {target.title}</option>)}
        </select>
        <button className="ghost-btn" onClick={() => onAddFlowEdge(node.id, selectedFlowTarget)}>+ conectar</button>
      </div>
      <OutgoingEdges node={node} project={project} onDeleteFlowEdge={onDeleteFlowEdge} />
    </div>
  );
}

function OutgoingEdges({
  node,
  project,
  onDeleteFlowEdge,
}: {
  node: StoryNode;
  project: ChoiceForgeProject;
  onDeleteFlowEdge: (from: string, to: string) => void;
}) {
  const outgoing = project.edges.filter((edge) => edge.from === node.id);
  if (!outgoing.length) return <p className="dim">sem conexoes de saida</p>;

  return (
    <ul className="flow-list">
      {outgoing.map((edge, index) => (
        <li key={`${edge.from}-${edge.to}-${edge.kind}-${index}`} className="flow-row">
          <span className={`flow-kind flow-${edge.kind}`}>{edge.kind}</span>
          <code>{targetLabel(project, edge)}</code>
          {edge.label && <span className="dim">{edge.label}</span>}
          {edge.kind === "flow" && <button className="mini-action danger" onClick={() => onDeleteFlowEdge(edge.from, edge.to)}>del</button>}
        </li>
      ))}
    </ul>
  );
}

function targetLabel(project: ChoiceForgeProject, edge: StoryEdge): string {
  const target = project.nodes.find((node) => node.id === edge.to);
  return target ? `${target.id} - ${target.title}` : edge.to;
}

function RawTab({ node }: { node: StoryNode }) {
  return (
    <div className="ip-raw">
      <pre className="raw-code"><code>{generateNodeChoiceScript(node)}</code></pre>
    </div>
  );
}

function updateOption(node: StoryNode, index: number, patch: Partial<ChoiceOption>, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, { options: node.options?.map((option, optionIndex) => (optionIndex === index ? { ...option, ...patch } : option)) });
}

function updateOptionCondition(node: StoryNode, index: number, value: string, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  const cond = value === "none" ? null : { type: value as ChoiceCondition["type"], expr: node.options?.[index]?.cond?.expr ?? "" };
  updateOption(node, index, { cond }, onUpdateNode);
}

function addOption(node: StoryNode, project: ChoiceForgeProject, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  const fallbackTarget = project.nodes.find((target) => target.id !== node.id)?.id ?? node.id;
  onUpdateNode(node.id, { options: [...(node.options ?? []), { text: "Nova opcao", to: fallbackTarget, cond: null }] });
}

function removeOption(node: StoryNode, index: number, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, { options: node.options?.filter((_, optionIndex) => optionIndex !== index) });
}

function updateSet(node: StoryNode, index: number, patch: Partial<VariableSet>, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, { sets: node.sets?.map((set, setIndex) => (setIndex === index ? { ...set, ...patch } : set)) });
}

function addSet(node: StoryNode, project: ChoiceForgeProject, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  const firstVariable = project.variables[0]?.name ?? "variavel";
  onUpdateNode(node.id, { sets: [...(node.sets ?? []), { var: firstVariable, op: "=", val: "0" }] });
}

function removeSet(node: StoryNode, index: number, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, { sets: node.sets?.filter((_, setIndex) => setIndex !== index) });
}

function updateBranch(node: StoryNode, index: number, patch: Partial<NonNullable<StoryNode["branches"]>[number]>, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, { branches: node.branches?.map((branch, branchIndex) => (branchIndex === index ? { ...branch, ...patch } : branch)) });
}
