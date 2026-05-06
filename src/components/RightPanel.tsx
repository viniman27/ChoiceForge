import { useState } from "react";
import { generateNodeChoiceScript } from "../domain/choicescript";
import type { ChoiceForgeProject, ChoiceCondition, ChoiceOption, ConditionalBranch, I18nLabels, StoryEdge, StoryNode, VariableSet, VariableSummary } from "../domain/types";
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
  const nodeIssues = project.lints.filter((lint) => lint.node === node.id);
  const nodeErrors = nodeIssues.filter((lint) => lint.level === "error").length;
  const nodeWarnings = nodeIssues.filter((lint) => lint.level === "warning").length;
  const lintClass = nodeErrors ? "err" : nodeWarnings ? "warn" : "ok";
  const lintText = nodeErrors ? `${nodeErrors} ${labels.errors}` : nodeWarnings ? `${nodeWarnings} ${labels.warnings}` : labels.linterPasses;
  return (
    <aside className="right-panel">
      <div className="ip-head" style={{ "--accent": colors.dot, "--accent-tint": colors.tint } as React.CSSProperties}>
        <div className="ip-type"><span className="ip-dot" /><NodeIcon type={node.type} /><span>{labels.nodeTypes[node.type]}</span></div>
        <input className="ip-title" value={node.title} onChange={(event) => onUpdateNode(node.id, { title: event.target.value })} />
        <div className="ip-meta"><span><code>scene:</code> {project.sceneTitle}</span><span>-</span><span><code>id:</code> {node.id}</span></div>
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

      <div className="ip-footer"><span className={`lint-pill ${lintClass}`}>{lintText}</span><span className="dim">{labels.indentRule}</span></div>
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
        <AchievementInsert node={node} project={project} onUpdateNode={onUpdateNode} />
        <SetsList node={node} project={project} onUpdateNode={onUpdateNode} />
      </div>
    );
  }

  if (node.type === "set") {
    return (
      <div className="ip-content">
        <div className="stat-node-note">
          <span className="node-icon"><NodeIcon type="set" /></span>
          <span>stat step</span>
        </div>
        <SetsList node={node} project={project} onUpdateNode={onUpdateNode} />
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

  if (["label", "goto", "goto_scene", "gosub", "checkpoint", "ending"].includes(node.type)) {
    return <CommandNodeFields node={node} project={project} onUpdateNode={onUpdateNode} />;
  }

  return <div className="ip-content"><p className="dim">No simples - sem campos de conteudo.</p></div>;
}

function AchievementInsert({
  node,
  project,
  onUpdateNode,
}: {
  node: StoryNode;
  project: ChoiceForgeProject;
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void;
}) {
  if (!project.achievements.length) return null;

  return (
    <div className="achieve-insert">
      <label className="ip-label">atribuir conquista</label>
      <div className="achieve-actions">
        {project.achievements.map((achievement) => (
          <button key={achievement.id} className="mini-action" onClick={() => appendAchievementCommand(node, achievement.id, onUpdateNode)}>
            *achieve {achievement.id}
          </button>
        ))}
      </div>
    </div>
  );
}

function CommandNodeFields({
  node,
  project,
  onUpdateNode,
}: {
  node: StoryNode;
  project: ChoiceForgeProject;
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void;
}) {
  const labels = project.nodes.filter((candidate) => candidate.type === "label");
  const currentLabel = stripCommandPrefix(node.title, node.type === "gosub" ? "*gosub" : node.type === "goto" ? "*goto" : "*label");

  if (node.type === "label") {
    return (
      <div className="ip-content">
        <label className="ip-label">label</label>
        <input className="command-input" value={currentLabel} onChange={(event) => onUpdateNode(node.id, { title: `*label ${normalizeIdentifier(event.target.value)}` })} />
      </div>
    );
  }

  if (node.type === "goto" || node.type === "gosub") {
    const command = node.type === "goto" ? "*goto" : "*gosub";
    const labelNames = labels.map((label) => stripCommandPrefix(label.title, "*label"));
    return (
      <div className="ip-content">
        <label className="ip-label">{command} destino</label>
        <select className="command-input" value={currentLabel} onChange={(event) => onUpdateNode(node.id, { title: `${command} ${event.target.value}` })}>
          {currentLabel && !labelNames.includes(currentLabel) && <option value={currentLabel}>{currentLabel}</option>}
          {!currentLabel && <option value="">label</option>}
          {labelNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
    );
  }

  if (node.type === "goto_scene") {
    const currentScene = node.target ?? stripCommandPrefix(node.title, "*goto_scene");
    return (
      <div className="ip-content">
        <label className="ip-label">cena destino</label>
        <select
          className="command-input"
          value={currentScene}
          onChange={(event) => onUpdateNode(node.id, { title: `*goto_scene ${event.target.value}`, target: event.target.value })}
        >
          {project.scenes.filter((scene) => !scene.isStart && !scene.special).map((scene) => <option key={scene.id} value={scene.name}>{scene.name}.txt</option>)}
        </select>
      </div>
    );
  }

  if (node.type === "checkpoint") {
    return (
      <div className="ip-content">
        <label className="ip-label">checkpoint</label>
        <input className="command-input" value={stripCommandPrefix(node.title, "*save_checkpoint")} onChange={(event) => onUpdateNode(node.id, { title: `*save_checkpoint ${normalizeIdentifier(event.target.value)}` })} />
      </div>
    );
  }

  return <div className="ip-content"><p className="dim">Este no encerra a historia com *ending.</p></div>;
}

function SetsList({ node, project, onUpdateNode }: { node: StoryNode; project: ChoiceForgeProject; onUpdateNode: (id: string, patch: Partial<StoryNode>) => void }) {
  return (
    <>
      <label className="ip-label">efeitos de stats</label>
      <ul className="ip-sets">
        {node.sets?.map((set, index) => (
          <li key={`${set.var}-${index}`} className="ip-set-row">
            <SetFields set={set} variables={project.variables} onChange={(patch) => updateSet(node, index, patch, project, onUpdateNode)} />
            <button className="x-btn" onClick={() => removeSet(node, index, onUpdateNode)}>x</button>
          </li>
        ))}
        <li><button className="ghost-btn" onClick={() => addSet(node, project, onUpdateNode)}>+ efeito</button></li>
      </ul>
    </>
  );
}

function SetFields({
  set,
  variables,
  onChange,
}: {
  set: VariableSet;
  variables: VariableSummary[];
  onChange: (patch: Partial<VariableSet>) => void;
}) {
  const variable = variables.find((candidate) => candidate.name === set.var) ?? variables[0];
  const ops = allowedOps(variable);

  return (
    <>
      <select value={set.var} onChange={(event) => onChange(normalizeSetForVariable(event.target.value, variables))}>
        {variables.map((candidate) => <option key={candidate.name} value={candidate.name}>{candidate.name}</option>)}
      </select>
      <select value={ops.includes(set.op) ? set.op : "="} onChange={(event) => onChange({ op: event.target.value as VariableSet["op"] })}>
        {ops.map((op) => <option key={op} value={op}>{op}</option>)}
      </select>
      {variable?.type === "boolean" ? (
        <select value={set.val === "true" ? "true" : "false"} onChange={(event) => onChange({ val: event.target.value })}>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input value={set.val} inputMode={variable?.type === "number" ? "decimal" : "text"} onChange={(event) => onChange({ val: event.target.value })} />
      )}
    </>
  );
}

function BranchSets({
  node,
  branch,
  branchIndex,
  project,
  onUpdateNode,
}: {
  node: StoryNode;
  branch: ConditionalBranch;
  branchIndex: number;
  project: ChoiceForgeProject;
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void;
}) {
  return (
    <div className="branch-effects">
      <span className="branch-effects-title">efeitos se esta branch vencer</span>
      <ul className="ip-sets">
        {branch.sets?.map((set, setIndex) => (
          <li key={`${set.var}-${setIndex}`} className="ip-set-row">
            <SetFields set={set} variables={project.variables} onChange={(patch) => updateBranchSet(node, branchIndex, setIndex, patch, project, onUpdateNode)} />
            <button className="x-btn" onClick={() => removeBranchSet(node, branchIndex, setIndex, onUpdateNode)}>x</button>
          </li>
        ))}
        <li><button className="ghost-btn" onClick={() => addBranchSet(node, branchIndex, project, onUpdateNode)}>+ efeito</button></li>
      </ul>
    </div>
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
              <div className="branch-main">
                <span className="branch-key">*{branch.kind}</span>
                {branch.kind !== "else" && <input className="cond-input wide" value={branch.expr ?? ""} onChange={(event) => updateBranch(node, index, { expr: event.target.value }, onUpdateNode)} />}
                <select value={branch.to} onChange={(event) => updateBranch(node, index, { to: event.target.value }, onUpdateNode)}>
                  {project.nodes.map((target) => <option key={target.id} value={target.id}>{target.id} - {target.title}</option>)}
                </select>
              </div>
              <BranchSets node={node} branch={branch} branchIndex={index} project={project} onUpdateNode={onUpdateNode} />
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

function updateSet(node: StoryNode, index: number, patch: Partial<VariableSet>, project: ChoiceForgeProject, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  const nextSets = node.sets?.map((set, setIndex) => (setIndex === index ? normalizeSetPatch({ ...set, ...patch }, project.variables) : set));
  const title = node.type === "set" && index === 0 && patch.var ? `*set ${patch.var}` : node.title;
  onUpdateNode(node.id, { sets: nextSets, title });
}

function addSet(node: StoryNode, project: ChoiceForgeProject, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, { sets: [...(node.sets ?? []), createDefaultSet(project.variables)] });
}

function removeSet(node: StoryNode, index: number, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, { sets: node.sets?.filter((_, setIndex) => setIndex !== index) });
}

function appendAchievementCommand(node: StoryNode, achievementId: string, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  const current = node.body?.trimEnd() ?? "";
  const command = `*achieve ${achievementId}`;
  if (current.split("\n").some((line) => line.trim() === command)) return;
  onUpdateNode(node.id, { body: current ? `${current}\n${command}` : command });
}

function updateBranch(node: StoryNode, index: number, patch: Partial<NonNullable<StoryNode["branches"]>[number]>, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, { branches: node.branches?.map((branch, branchIndex) => (branchIndex === index ? { ...branch, ...patch } : branch)) });
}

function updateBranchSet(node: StoryNode, branchIndex: number, setIndex: number, patch: Partial<VariableSet>, project: ChoiceForgeProject, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, {
    branches: node.branches?.map((branch, currentBranchIndex) => (
      currentBranchIndex === branchIndex
        ? { ...branch, sets: branch.sets?.map((set, currentSetIndex) => (currentSetIndex === setIndex ? normalizeSetPatch({ ...set, ...patch }, project.variables) : set)) }
        : branch
    )),
  });
}

function addBranchSet(node: StoryNode, branchIndex: number, project: ChoiceForgeProject, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, {
    branches: node.branches?.map((branch, currentBranchIndex) => (
      currentBranchIndex === branchIndex ? { ...branch, sets: [...(branch.sets ?? []), createDefaultSet(project.variables)] } : branch
    )),
  });
}

function removeBranchSet(node: StoryNode, branchIndex: number, setIndex: number, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, {
    branches: node.branches?.map((branch, currentBranchIndex) => (
      currentBranchIndex === branchIndex ? { ...branch, sets: branch.sets?.filter((_, currentSetIndex) => currentSetIndex !== setIndex) } : branch
    )),
  });
}

function createDefaultSet(variables: VariableSummary[]): VariableSet {
  return normalizeSetForVariable(variables[0]?.name ?? "variavel", variables) as VariableSet;
}

function normalizeSetForVariable(variableName: string, variables: VariableSummary[]): VariableSet {
  const variable = variables.find((candidate) => candidate.name === variableName);
  return { var: variableName, op: "=", val: defaultSetValue(variable) };
}

function normalizeSetPatch(set: VariableSet, variables: VariableSummary[]): VariableSet {
  const variable = variables.find((candidate) => candidate.name === set.var);
  const ops = allowedOps(variable);
  return {
    ...set,
    op: ops.includes(set.op) ? set.op : "=",
    val: normalizeSetValue(set.val, variable),
  };
}

function allowedOps(variable: VariableSummary | undefined): VariableSet["op"][] {
  if (variable?.type !== "number") return ["="];
  return variable.fairmath ? ["=", "+", "-", "%+", "%-"] : ["=", "+", "-"];
}

function defaultSetValue(variable: VariableSummary | undefined): string {
  if (variable?.type === "boolean") return "true";
  if (variable?.type === "string") return "\"\"";
  return "0";
}

function normalizeSetValue(value: string, variable: VariableSummary | undefined): string {
  if (variable?.type === "boolean") return value === "true" ? "true" : "false";
  return value;
}

function stripCommandPrefix(value: string, command: string): string {
  return value.replace(command, "").replace(/^[-\s]+/, "").trim();
}

function normalizeIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^[^a-z_]+/, "")
    .replace(/_+/g, "_");
}
