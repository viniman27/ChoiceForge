import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { generateNodeChoiceScript } from "../domain/choicescript";
import type { ChoiceForgeProject, ChoiceCondition, ChoiceOption, ConditionalBranch, FakeChoiceOption, I18nLabels, NodeColorTag, NodeStatus, NodeType, StoryEdge, StoryNode, VariableSet, VariableSummary } from "../domain/types";
import { COLOR_TAG_VALUES, NodeIcon, typeColors } from "./NodeCard";
import { NodeBodyEditor } from "./NodeBodyEditor";

interface RightPanelProps {
  node: StoryNode | null;
  project: ChoiceForgeProject;
  labels: I18nLabels;
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void;
  onAddFlowEdge: (from: string, to: string) => void;
  onDeleteFlowEdge: (from: string, to: string) => void;
  onSelectNode: (id: string) => void;
  onSelectScene?: (id: string) => void;
  sourcePreserved?: boolean;
  onConvertSource?: () => void;
}

export function RightPanel({ node, project, labels, onUpdateNode, onAddFlowEdge, onDeleteFlowEdge, onSelectNode, onSelectScene, sourcePreserved = false, onConvertSource }: RightPanelProps) {
  const [tab, setTab] = useState<"content" | "logic" | "raw">("content");

  if (!node) {
    return (
      <aside className="right-panel">
        <div className="empty-inspector">
          <h3>{labels.inspector}</h3>
          <p>Select a node on the canvas to inspect and edit it.</p>
        </div>
      </aside>
    );
  }

  const colors = typeColors[node.type];
  const nodeIssues = project.lints.filter((lint) => lint.node === node.id && lint.scene === project.sceneTitle);
  const nodeErrors = nodeIssues.filter((lint) => lint.level === "error").length;
  const nodeWarnings = nodeIssues.filter((lint) => lint.level === "warning").length;
  const lintClass = nodeErrors ? "err" : nodeWarnings ? "warn" : "ok";
  const lintText = nodeErrors ? `${nodeErrors} ${labels.errors}` : nodeWarnings ? `${nodeWarnings} ${labels.warnings}` : labels.linterPasses;
  return (
    <aside className="right-panel">
      <div className="ip-head" style={{ "--accent": colors.dot, "--accent-tint": colors.tint } as React.CSSProperties}>
        <div className="ip-type"><span className="ip-dot" /><NodeIcon type={node.type} /><span>{labels.nodeTypes[node.type]}</span></div>
        <input className="ip-title" value={node.title} disabled={sourcePreserved} onChange={(event) => onUpdateNode(node.id, { title: event.target.value })} />
        <div className="ip-status-row">
          {(["todo", "done"] as NodeStatus[]).map((s) => (
            <button
              key={s}
              className={`ip-status-btn ip-status-${s}${node.status === s ? " is-active" : ""}`}
              disabled={sourcePreserved}
              onClick={() => onUpdateNode(node.id, { status: node.status === s ? undefined : s })}
            >{s}</button>
          ))}
        </div>
        <div className="ip-color-row">
          {(Object.keys(COLOR_TAG_VALUES) as NodeColorTag[]).map((tag) => (
            <button
              key={tag}
              className={`ip-color-dot${node.colorTag === tag ? " is-active" : ""}`}
              style={{ "--ct": COLOR_TAG_VALUES[tag] } as React.CSSProperties}
              title={tag}
              disabled={sourcePreserved}
              onClick={() => onUpdateNode(node.id, { colorTag: node.colorTag === tag ? undefined : tag })}
            />
          ))}
          {node.colorTag && (
            <button className="ip-color-clear" disabled={sourcePreserved} onClick={() => onUpdateNode(node.id, { colorTag: undefined })} title="clear color">×</button>
          )}
        </div>
        {!sourcePreserved && getConvertibleTypes(node.type).length > 0 && (
          <div className="ip-convert-row">
            <span className="ip-convert-label">convert →</span>
            <select
              className="ip-convert-select"
              value=""
              onChange={(event) => {
                const fallbackId = project.nodes.find((candidate) => candidate.id !== node.id)?.id ?? node.id;
                const patch = buildTypeConversionPatch(node, event.target.value as NodeType, fallbackId);
                if (patch) onUpdateNode(node.id, patch);
              }}
            >
              <option value="" disabled>type…</option>
              {getConvertibleTypes(node.type).map((t) => (
                <option key={t} value={t}>{labels.nodeTypes[t]}</option>
              ))}
            </select>
          </div>
        )}
        <div className="ip-meta"><span><code>scene:</code> {project.sceneTitle}</span><span>-</span><span><code>id:</code> {node.id}</span>{countNodeWords(node) > 0 && <><span>-</span><span>{countNodeWords(node)}w</span></>}</div>
      </div>
      {sourcePreserved && (
        <div className="ip-source-lock">
          <span>Imported source is preserved. Inspector edits are disabled until this scene is converted to visual editing.</span>
          <button className="ghost-btn" onClick={onConvertSource}>Convert</button>
        </div>
      )}

      <div className="ip-tabs">
        {(["content", "logic", "raw"] as const).map((id, index) => (
          <button key={id} className={`ip-tab ${tab === id ? "is-active" : ""}`} onClick={() => setTab(id)}>
            {labels.inspectorTabs[index]}
          </button>
        ))}
      </div>

      <div className={`ip-body ${sourcePreserved ? "is-source-locked" : ""}`}>
        {tab === "content" && <ContentTab node={node} project={project} labels={labels} onUpdateNode={onUpdateNode} onSelectScene={onSelectScene} onSelectNode={onSelectNode} />}
        {tab === "logic" && (
          <LogicTab
            node={node}
            project={project}
            onUpdateNode={onUpdateNode}
            onAddFlowEdge={onAddFlowEdge}
            onDeleteFlowEdge={onDeleteFlowEdge}
            onSelectNode={onSelectNode}
          />
        )}
        {tab === "raw" && <RawTab node={node} project={project} />}
      </div>

      <div className="ip-notes">
        <label className="ip-notes-label">✎ private notes</label>
        <textarea
          className="ip-notes-area"
          placeholder="Author notes (never exported)…"
          disabled={sourcePreserved}
          value={node.note ?? ""}
          onChange={(e) => onUpdateNode(node.id, { note: e.target.value || undefined })}
        />
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
  onSelectScene,
  onSelectNode,
}: {
  node: StoryNode;
  project: ChoiceForgeProject;
  labels: I18nLabels;
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void;
  onSelectScene?: (id: string) => void;
  onSelectNode?: (id: string) => void;
}) {
  const variableNames = project.variables.map((v) => v.name);
  const achievementIds = project.achievements.map((a) => a.id);
  const [dragOptIdx, setDragOptIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [writingFocus, setWritingFocus] = useState(false);
  useEffect(() => {
    setWritingFocus(false);
    setDragOptIdx(null);
    setDragOverIdx(null);
  }, [node.id]);

  const moveOption = (from: number, to: number) => {
    const opts = [...(node.options ?? [])];
    const [moved] = opts.splice(from, 1);
    opts.splice(to, 0, moved);
    onUpdateNode(node.id, { options: opts });
  };

  const moveFakeOption = (from: number, to: number) => {
    const opts = [...(node.fakeOptions ?? [])];
    const [moved] = opts.splice(from, 1);
    opts.splice(to, 0, moved);
    onUpdateNode(node.id, { fakeOptions: opts });
  };

  const optDragHandlers = (index: number) => ({
    draggable: true as const,
    onDragStart: () => setDragOptIdx(index),
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOverIdx(index); },
    onDragLeave: () => setDragOverIdx((cur) => cur === index ? null : cur),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragOptIdx !== null && dragOptIdx !== index) moveOption(dragOptIdx, index);
      setDragOptIdx(null); setDragOverIdx(null);
    },
    onDragEnd: () => { setDragOptIdx(null); setDragOverIdx(null); },
  });

  const fakeOptDragHandlers = (index: number) => ({
    draggable: true as const,
    onDragStart: () => setDragOptIdx(index),
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOverIdx(index); },
    onDragLeave: () => setDragOverIdx((cur) => cur === index ? null : cur),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragOptIdx !== null && dragOptIdx !== index) moveFakeOption(dragOptIdx, index);
      setDragOptIdx(null); setDragOverIdx(null);
    },
    onDragEnd: () => { setDragOptIdx(null); setDragOverIdx(null); },
  });

  if (node.type === "passage") {
    const wc = nodeBodyWordCount(node.body ?? "");
    return (
      <>
        <div className="ip-content">
          <div className="ip-label-row">
            <label className="ip-label">{labels.bodyLabel}</label>
            <span className="ip-word-count">{wc} {wc === 1 ? "word" : "words"}</span>
            <button className="wf-expand-btn" onClick={() => setWritingFocus(true)} title="Focus writing mode">⛶</button>
          </div>
          <NodeBodyEditor key={node.id} value={node.body ?? ""} onChange={(text) => onUpdateNode(node.id, { body: text })} variables={variableNames} achievements={achievementIds} />
          <AchievementInsert node={node} project={project} onUpdateNode={onUpdateNode} />
          <SetsList node={node} project={project} onUpdateNode={onUpdateNode} />
        </div>
        {writingFocus && createPortal(
          <WritingFocusOverlay
            title={node.title}
            body={node.body ?? ""}
            wordCount={wc}
            variables={variableNames}
            achievements={achievementIds}
            onChange={(text) => onUpdateNode(node.id, { body: text })}
            onClose={() => setWritingFocus(false)}
          />,
          document.body
        )}
      </>
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
    const promptWc = nodeBodyWordCount(node.prompt ?? "");
    return (
      <div className="ip-content">
        <div className="ip-label-row">
          <label className="ip-label">{labels.choiceLabel}</label>
          {promptWc > 0 && <span className="ip-word-count">{promptWc} {promptWc === 1 ? "word" : "words"}</span>}
        </div>
        <div className="ip-prompt-editor">
          <NodeBodyEditor key={`prompt-${node.id}`} value={node.prompt ?? ""} onChange={(text) => onUpdateNode(node.id, { prompt: text })} variables={variableNames} achievements={achievementIds} />
        </div>
        <label className="ip-label">#options</label>
        <ul className="ip-opts">
          {node.options?.map((option, index) => (
            <li key={`opt-${index}`} className={`ip-opt-row${dragOptIdx === index ? " is-dragging" : ""}${dragOverIdx === index && dragOptIdx !== index ? " is-drag-over" : ""}`} {...optDragHandlers(index)}>
              <div className="ip-opt-head">
                <span className="opt-drag-handle" title="drag to reorder">::</span>
                <span className="opt-num">#{index + 1}</span>
                <input className="ip-opt-text" value={option.text} onChange={(event) => updateOption(node, index, { text: event.target.value }, onUpdateNode)} />
                <button className="x-btn" onClick={() => removeOption(node, index, onUpdateNode)}>x</button>
              </div>
              <div className="ip-opt-cond">
                <select
                  value={option.cond?.type ?? "none"}
                  onChange={(event) => updateOptionCondition(node, index, event.target.value, onUpdateNode)}
                >
                  <option value="none">no condition</option><option value="if">*if</option><option value="selectable_if">*selectable_if</option>
                </select>
                <select value={option.to} onChange={(event) => updateOption(node, index, { to: event.target.value }, onUpdateNode)}>
                  {project.nodes.map((target) => <option key={target.id} value={target.id}>{target.id} - {target.title}</option>)}
                </select>
                <button className="mini-action" title="Navigate to target node" onClick={() => onSelectNode?.(option.to)}>→</button>
              </div>
              {option.cond && <ChoiceConditionBuilder node={node} option={option} optionIndex={index} project={project} onUpdateNode={onUpdateNode} />}
              <ChoiceReuseSelect value={choiceReuseValue(option)} onChange={(reuse) => updateOptionReuse(node, index, reuse, onUpdateNode)} />
              <div className="ip-opt-body-editor"><NodeBodyEditor key={`opt-body-${node.id}-${index}`} value={option.body ?? ""} onChange={(text) => updateOption(node, index, { body: text || undefined }, onUpdateNode)} variables={variableNames} achievements={achievementIds} /></div>
              <OptionSets node={node} option={option} optionIndex={index} project={project} onUpdateNode={onUpdateNode} />
            </li>
          ))}
        </ul>
        <button className="ghost-btn" onClick={() => addOption(node, project, onUpdateNode)}>{labels.addOption}</button>
      </div>
    );
  }

  if (node.type === "fake_choice") {
    const fakePromptWc = nodeBodyWordCount(node.prompt ?? "");
    return (
      <div className="ip-content">
        <div className="ip-label-row">
          <label className="ip-label">fake choice prompt</label>
          {fakePromptWc > 0 && <span className="ip-word-count">{fakePromptWc} {fakePromptWc === 1 ? "word" : "words"}</span>}
        </div>
        <div className="ip-prompt-editor">
          <NodeBodyEditor key={`prompt-${node.id}`} value={node.prompt ?? ""} onChange={(text) => onUpdateNode(node.id, { prompt: text })} variables={variableNames} achievements={achievementIds} />
        </div>
        <label className="ip-label">#options</label>
        <ul className="ip-opts">
          {node.fakeOptions?.map((option, index) => (
            <li key={`fopt-${index}`} className={`ip-opt-row${dragOptIdx === index ? " is-dragging" : ""}${dragOverIdx === index && dragOptIdx !== index ? " is-drag-over" : ""}`} {...fakeOptDragHandlers(index)}>
              <div className="ip-opt-head">
                <span className="opt-drag-handle" title="drag to reorder">::</span>
                <span className="opt-num">#{index + 1}</span>
                <input className="ip-opt-text" value={option.text} onChange={(event) => updateFakeOption(node, index, { text: event.target.value }, onUpdateNode)} />
                <button className="x-btn" onClick={() => removeFakeOption(node, index, onUpdateNode)}>x</button>
              </div>
              <div className="ip-opt-cond">
                <select
                  value={option.cond?.type ?? "none"}
                  onChange={(event) => updateFakeOptionCondition(node, index, event.target.value, onUpdateNode)}
                >
                  <option value="none">no condition</option><option value="if">*if</option><option value="selectable_if">*selectable_if</option>
                </select>
              </div>
              {option.cond && <FakeChoiceConditionBuilder node={node} option={option} optionIndex={index} project={project} onUpdateNode={onUpdateNode} />}
              <ChoiceReuseSelect value={choiceReuseValue(option)} onChange={(reuse) => updateFakeOptionReuse(node, index, reuse, onUpdateNode)} />
              <div className="ip-opt-body-editor"><NodeBodyEditor key={`fopt-body-${node.id}-${index}`} value={option.body ?? ""} onChange={(text) => updateFakeOption(node, index, { body: text || undefined }, onUpdateNode)} variables={variableNames} achievements={achievementIds} /></div>
              <FakeOptionSets node={node} option={option} optionIndex={index} project={project} onUpdateNode={onUpdateNode} />
            </li>
          ))}
        </ul>
        <button className="ghost-btn" onClick={() => addFakeOption(node, onUpdateNode)}>{labels.addOption}</button>
      </div>
    );
  }

  if (node.type === "comment") {
    return (
      <div className="ip-content">
        <label className="ip-label">comment</label>
        <NodeBodyEditor key={node.id} value={node.body ?? ""} onChange={(text) => onUpdateNode(node.id, { body: text })} variables={variableNames} />
      </div>
    );
  }

  if (node.type === "input_text" || node.type === "input_number" || node.type === "rand") {
    return <InputNodeFields node={node} project={project} onUpdateNode={onUpdateNode} />;
  }

  if (node.type === "temp") {
    const varName = node.inputVar?.trim() ?? "";
    return (
      <div className="ip-content">
        <label className="ip-label">variable name</label>
        <input
          className="command-input"
          value={varName}
          placeholder="temp_var"
          onChange={(event) => {
            const name = normalizeIdentifier(event.target.value);
            onUpdateNode(node.id, { inputVar: name, title: `*temp ${name}`.trimEnd() });
          }}
        />
        <label className="ip-label">initial value</label>
        <input
          className="command-input"
          value={node.body ?? ""}
          placeholder="0"
          onChange={(event) => onUpdateNode(node.id, { body: event.target.value })}
        />
        <p className="ip-hint">Scene-local variable — not declared in startup.txt. Valid in this scene only.</p>
      </div>
    );
  }

  if (node.type === "params") {
    return (
      <div className="ip-content">
        <label className="ip-label">parameter names</label>
        <input
          className="command-input"
          value={node.body ?? ""}
          placeholder="param1 param2"
          onChange={(event) => {
            const raw = event.target.value;
            const names = raw.trim().split(/\s+/).filter(Boolean);
            onUpdateNode(node.id, { body: raw, title: `*params${names.length ? ` ${names.join(" ")}` : ""}` });
          }}
        />
        <p className="ip-hint">Space-separated names for gosub arguments. Must appear after *label at the top of a subroutine.</p>
      </div>
    );
  }

  if (node.type === "image") {
    const assets = project.assets ?? [];
    const imageAssets = assets.filter((a) => /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(a.fileName ?? ""));
    const imageAsset = assets.find((a) => a.fileName === node.target);
    return (
      <div className="ip-content">
        {imageAsset?.dataUrl ? (
          <div className="ip-image-preview">
            <img src={imageAsset.dataUrl} alt={node.prompt || node.target || ""} className="ip-image-thumb" />
            <span className="ip-image-name">{imageAsset.fileName}</span>
          </div>
        ) : node.target ? (
          <div className="ip-image-missing">image not found in assets: {node.target}</div>
        ) : null}
        <label className="ip-label">filename</label>
        {imageAssets.length > 0 ? (
          <select
            className="command-input"
            value={node.target ?? ""}
            onChange={(event) => onUpdateNode(node.id, { title: `*image ${event.target.value}`.trim(), target: event.target.value })}
          >
            <option value="">— choose asset —</option>
            {node.target && !imageAssets.find((a) => a.fileName === node.target) && (
              <option value={node.target}>{node.target} (missing)</option>
            )}
            {imageAssets.map((a) => <option key={a.id} value={a.fileName}>{a.fileName}</option>)}
          </select>
        ) : (
          <input className="command-input" value={node.target ?? ""} placeholder="image.jpg" onChange={(event) => onUpdateNode(node.id, { title: `*image ${event.target.value}`.trim(), target: event.target.value })} />
        )}
        <label className="ip-label">alignment</label>
        <select className="command-input" value={node.inputMin ?? "none"} onChange={(event) => onUpdateNode(node.id, { inputMin: event.target.value })}>
          <option value="none">none</option>
          <option value="left">left</option>
          <option value="right">right</option>
        </select>
        <label className="ip-label">alt text</label>
        <input className="command-input" value={node.prompt ?? ""} onChange={(event) => onUpdateNode(node.id, { prompt: event.target.value })} />
      </div>
    );
  }

  if (node.type === "sound") {
    const assets = project.assets ?? [];
    const audioAssets = assets.filter((a) => /\.(mp3|ogg|wav|aac|flac|m4a)$/i.test(a.fileName ?? ""));
    return (
      <div className="ip-content">
        <label className="ip-label">filename</label>
        {audioAssets.length > 0 ? (
          <select
            className="command-input"
            value={node.target ?? ""}
            onChange={(event) => onUpdateNode(node.id, { title: `*sound ${event.target.value}`.trim(), target: event.target.value })}
          >
            <option value="">— choose asset —</option>
            {node.target && !audioAssets.find((a) => a.fileName === node.target) && (
              <option value={node.target}>{node.target} (missing)</option>
            )}
            {audioAssets.map((a) => <option key={a.id} value={a.fileName}>{a.fileName}</option>)}
          </select>
        ) : (
          <input className="command-input" value={node.target ?? ""} placeholder="music.mp3" onChange={(event) => onUpdateNode(node.id, { title: `*sound ${event.target.value}`.trim(), target: event.target.value })} />
        )}
      </div>
    );
  }

  if (["label", "goto", "goto_scene", "gosub", "gosub_scene", "return", "checkpoint", "restore_checkpoint", "page_break", "ending", "finish"].includes(node.type)) {
    return <CommandNodeFields node={node} project={project} onUpdateNode={onUpdateNode} onSelectScene={onSelectScene} onSelectNode={onSelectNode} />;
  }

  if (node.type === "achieve") {
    return <AchieveNodeFields node={node} project={project} onUpdateNode={onUpdateNode} />;
  }

  return <div className="ip-content"><p className="dim">Simple node - no content fields.</p></div>;
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
  const assigned = new Set(extractAchievementCommands(node.body ?? ""));

  return (
    <div className="achieve-insert">
      <label className="ip-label">assign achievement</label>
      <div className="achieve-actions">
        {project.achievements.map((achievement) => (
          <button
            key={achievement.id}
            className={`mini-action ${assigned.has(achievement.id) ? "is-active" : ""}`}
            onClick={() => (
              assigned.has(achievement.id)
                ? removeAchievementCommand(node, achievement.id, onUpdateNode)
                : appendAchievementCommand(node, achievement.id, onUpdateNode)
            )}
          >
            {assigned.has(achievement.id) ? "remove" : "*achieve"} {achievement.id}
          </button>
        ))}
      </div>
    </div>
  );
}

function AchieveNodeFields({
  node,
  project,
  onUpdateNode,
}: {
  node: StoryNode;
  project: ChoiceForgeProject;
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void;
}) {
  const currentId = node.target?.trim() ?? "";
  const set = (id: string) => {
    const normalized = normalizeIdentifier(id);
    onUpdateNode(node.id, { target: normalized, title: `*achieve ${normalized}`.trimEnd() });
  };

  return (
    <div className="ip-content">
      <label className="ip-label">achievement</label>
      {project.achievements.length > 0 ? (
        <select className="command-input" value={currentId} onChange={(event) => set(event.target.value)}>
          {!currentId && <option value="">— select —</option>}
          {project.achievements.map((achievement) => (
            <option key={achievement.id} value={achievement.id}>{achievement.id} — {achievement.title}</option>
          ))}
        </select>
      ) : (
        <input className="command-input" value={currentId} placeholder="achievement_id" onChange={(event) => set(event.target.value)} />
      )}
    </div>
  );
}

function CommandNodeFields({
  node,
  project,
  onUpdateNode,
  onSelectScene,
  onSelectNode,
}: {
  node: StoryNode;
  project: ChoiceForgeProject;
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void;
  onSelectScene?: (id: string) => void;
  onSelectNode?: (id: string) => void;
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
    const targetLabelNode = labels.find((label) => stripCommandPrefix(label.title, "*label") === currentLabel);
    return (
      <div className="ip-content">
        <label className="ip-label">{command} destination</label>
        <div className="ip-scene-row">
          <select className="command-input" value={currentLabel} onChange={(event) => onUpdateNode(node.id, { title: `${command} ${event.target.value}` })}>
            {currentLabel && !labelNames.includes(currentLabel) && <option value={currentLabel}>{currentLabel}</option>}
            {!currentLabel && <option value="">label</option>}
            {labelNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          {onSelectNode && targetLabelNode && (
            <button className="scene-jump-btn" title={`jump to *label ${currentLabel}`} onClick={() => onSelectNode(targetLabelNode.id)}>→</button>
          )}
        </div>
      </div>
    );
  }

  if (node.type === "goto_scene") {
    const currentScene = node.target ?? stripCommandPrefix(node.title, "*goto_scene");
    const targetSceneObj = project.scenes.find((s) => s.name === currentScene);
    return (
      <div className="ip-content">
        <label className="ip-label">target scene</label>
        <div className="ip-scene-row">
          <select
            className="command-input"
            value={currentScene}
            onChange={(event) => onUpdateNode(node.id, { title: `*goto_scene ${event.target.value}`, target: event.target.value })}
          >
            {project.scenes.filter((scene) => !scene.isStart && !scene.special).map((scene) => <option key={scene.id} value={scene.name}>{scene.name}.txt</option>)}
          </select>
          {onSelectScene && targetSceneObj && (
            <button className="scene-jump-btn" title={`open ${currentScene}.txt`} onClick={() => onSelectScene(targetSceneObj.id)}>→</button>
          )}
        </div>
      </div>
    );
  }

  if (node.type === "gosub_scene") {
    const currentScene = node.target ?? "";
    const currentLabel = node.body?.trim() ?? "";
    const targetSceneObj = project.scenes.find((s) => s.name === currentScene);
    const targetGraph = currentScene
      ? (currentScene === project.sceneTitle
        ? { nodes: project.nodes, edges: project.edges }
        : project.sceneData?.[currentScene])
      : null;
    const targetLabels = (targetGraph?.nodes ?? [])
      .filter((n) => n.type === "label")
      .map((n) => stripCommandPrefix(n.title, "*label"))
      .filter(Boolean);
    return (
      <div className="ip-content">
        <label className="ip-label">target scene</label>
        <div className="ip-scene-row">
          <select
            className="command-input"
            value={currentScene}
            onChange={(event) => onUpdateNode(node.id, { title: `*gosub_scene ${event.target.value}`, target: event.target.value, body: "" })}
          >
            {project.scenes.filter((scene) => !scene.isStart && !scene.special).map((scene) => <option key={scene.id} value={scene.name}>{scene.name}.txt</option>)}
          </select>
          {onSelectScene && targetSceneObj && (
            <button className="scene-jump-btn" title={`open ${currentScene}.txt`} onClick={() => onSelectScene(targetSceneObj.id)}>→</button>
          )}
        </div>
        <label className="ip-label">entry label (optional)</label>
        {targetLabels.length > 0 ? (
          <select
            className="command-input"
            value={currentLabel}
            onChange={(event) => onUpdateNode(node.id, { body: event.target.value })}
          >
            <option value="">— none —</option>
            {currentLabel && !targetLabels.includes(currentLabel) && (
              <option value={currentLabel}>{currentLabel}</option>
            )}
            {targetLabels.map((lbl) => <option key={lbl} value={lbl}>{lbl}</option>)}
          </select>
        ) : (
          <input className="command-input" value={currentLabel} placeholder="subroutine_label" onChange={(event) => onUpdateNode(node.id, { body: event.target.value })} />
        )}
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

  if (node.type === "restore_checkpoint") {
    return (
      <div className="ip-content">
        <label className="ip-label">restore checkpoint</label>
        <input className="command-input" value={stripCommandPrefix(node.title, "*restore_checkpoint")} onChange={(event) => onUpdateNode(node.id, { title: `*restore_checkpoint ${normalizeIdentifier(event.target.value)}`.trimEnd() })} />
      </div>
    );
  }

  if (node.type === "page_break") {
    return (
      <div className="ip-content">
        <label className="ip-label">page break label</label>
        <input className="command-input" value={stripCommandPrefix(node.title, "*page_break")} onChange={(event) => onUpdateNode(node.id, { title: `*page_break ${event.target.value}` })} />
      </div>
    );
  }

  if (node.type === "finish") {
    const nextScene = nextPlayableScene(project);
    return (
      <div className="ip-content">
        <p className="dim">This node finishes the current scene with *finish.</p>
        <div className="command-summary">
          <span>next scene</span>
          <code>{nextScene ? `${nextScene}.txt` : "end of scene_list"}</code>
        </div>
      </div>
    );
  }
  if (node.type === "return") {
    return <div className="ip-content"><p className="dim">This node returns from the current *gosub with *return.</p></div>;
  }
  return <div className="ip-content"><p className="dim">This node ends the story with *ending.</p></div>;
}

function nextPlayableScene(project: ChoiceForgeProject): string | null {
  const scenes = project.scenes.filter((scene) => !scene.isStart && !scene.special);
  const currentIndex = scenes.findIndex((scene) => scene.name === project.sceneTitle);
  return currentIndex >= 0 ? scenes[currentIndex + 1]?.name ?? null : null;
}

function InputNodeFields({
  node,
  project,
  onUpdateNode,
}: {
  node: StoryNode;
  project: ChoiceForgeProject;
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void;
}) {
  const allowedType: VariableSummary["type"] = node.type === "input_text" ? "string" : "number";
  const variables = project.variables.filter((variable) => variable.type === allowedType);
  const fallback = variables[0]?.name ?? project.variables[0]?.name ?? "";
  const current = variables.some((variable) => variable.name === node.inputVar) ? node.inputVar! : fallback;
  const command = node.type === "input_text" ? "*input_text" : node.type === "input_number" ? "*input_number" : "*rand";

  return (
    <div className="ip-content">
      {node.type !== "rand" && (
        <>
          <label className="ip-label">prompt text</label>
          <NodeBodyEditor key={node.id} value={node.body ?? ""} onChange={(text) => onUpdateNode(node.id, { body: text })} variables={project.variables.map((v) => v.name)} />
        </>
      )}
      <label className="ip-label">target variable</label>
      <select className="command-input" value={current} onChange={(event) => onUpdateNode(node.id, { inputVar: event.target.value, title: `${command} ${event.target.value}` })}>
        {!variables.length && <option value={fallback}>{fallback || "no variable"}</option>}
        {variables.map((variable) => <option key={variable.name} value={variable.name}>{variable.name}</option>)}
      </select>
      {(node.type === "input_number" || node.type === "rand") && (
        <div className="ip-set-row">
          <input value={node.inputMin ?? (node.type === "rand" ? "1" : "0")} inputMode="decimal" aria-label="minimum value" onChange={(event) => onUpdateNode(node.id, { inputMin: event.target.value })} />
          <input value={node.inputMax ?? "100"} inputMode="decimal" aria-label="maximum value" onChange={(event) => onUpdateNode(node.id, { inputMax: event.target.value })} />
        </div>
      )}
    </div>
  );
}

function SetsList({ node, project, onUpdateNode }: { node: StoryNode; project: ChoiceForgeProject; onUpdateNode: (id: string, patch: Partial<StoryNode>) => void }) {
  return (
    <>
      <label className="ip-label">stat effects</label>
      <ul className="ip-sets">
        {node.sets?.map((set, index) => (
          <li key={`${set.var}-${index}`} className="ip-set-row">
            <SetFields set={set} variables={project.variables} onChange={(patch) => updateSet(node, index, patch, project, onUpdateNode)} />
            <button className="x-btn" onClick={() => removeSet(node, index, onUpdateNode)}>x</button>
          </li>
        ))}
        <li><button className="ghost-btn" onClick={() => addSet(node, project, onUpdateNode)}>+ effect</button></li>
      </ul>
    </>
  );
}

type ChoiceReuseValue = "default" | "hide" | "disable" | "allow";

function ChoiceReuseSelect({ value, onChange }: { value: ChoiceReuseValue; onChange: (value: ChoiceReuseValue) => void }) {
  return (
    <label className="reuse-row">
      <span>reuse</span>
      <select value={value} onChange={(event) => onChange(event.target.value as ChoiceReuseValue)}>
        <option value="default">default</option>
        <option value="hide">*hide_reuse</option>
        <option value="disable">*disable_reuse</option>
        <option value="allow">*allow_reuse</option>
      </select>
    </label>
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
        <ConditionInput
          value={set.val}
          onChange={(val) => onChange({ val })}
          variables={variables.map((v) => v.name)}
          className={`set-val-input${variable?.type === "number" ? " is-numeric" : ""}`}
        />
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
      <span className="branch-effects-title">effects when this branch wins</span>
      <ul className="ip-sets">
        {branch.sets?.map((set, setIndex) => (
          <li key={`${set.var}-${setIndex}`} className="ip-set-row">
            <SetFields set={set} variables={project.variables} onChange={(patch) => updateBranchSet(node, branchIndex, setIndex, patch, project, onUpdateNode)} />
            <button className="x-btn" onClick={() => removeBranchSet(node, branchIndex, setIndex, onUpdateNode)}>x</button>
          </li>
        ))}
        <li><button className="ghost-btn" onClick={() => addBranchSet(node, branchIndex, project, onUpdateNode)}>+ effect</button></li>
      </ul>
    </div>
  );
}

function OptionSets({
  node,
  option,
  optionIndex,
  project,
  onUpdateNode,
}: {
  node: StoryNode;
  option: ChoiceOption;
  optionIndex: number;
  project: ChoiceForgeProject;
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void;
}) {
  return (
    <div className="branch-effects">
      <span className="branch-effects-title">effects when this option is chosen</span>
      <ul className="ip-sets">
        {option.sets?.map((set, setIndex) => (
          <li key={`${set.var}-${setIndex}`} className="ip-set-row">
            <SetFields set={set} variables={project.variables} onChange={(patch) => updateOptionSet(node, optionIndex, setIndex, patch, project, onUpdateNode)} />
            <button className="x-btn" onClick={() => removeOptionSet(node, optionIndex, setIndex, onUpdateNode)}>x</button>
          </li>
        ))}
        <li><button className="ghost-btn" onClick={() => addOptionSet(node, optionIndex, project, onUpdateNode)}>+ effect</button></li>
      </ul>
    </div>
  );
}

function FakeOptionSets({
  node,
  option,
  optionIndex,
  project,
  onUpdateNode,
}: {
  node: StoryNode;
  option: FakeChoiceOption;
  optionIndex: number;
  project: ChoiceForgeProject;
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void;
}) {
  return (
    <div className="branch-effects">
      <span className="branch-effects-title">effects when this option is chosen</span>
      <ul className="ip-sets">
        {option.sets?.map((set, setIndex) => (
          <li key={`${set.var}-${setIndex}`} className="ip-set-row">
            <SetFields set={set} variables={project.variables} onChange={(patch) => updateFakeOptionSet(node, optionIndex, setIndex, patch, project, onUpdateNode)} />
            <button className="x-btn" onClick={() => removeFakeOptionSet(node, optionIndex, setIndex, onUpdateNode)}>x</button>
          </li>
        ))}
        <li><button className="ghost-btn" onClick={() => addFakeOptionSet(node, optionIndex, project, onUpdateNode)}>+ effect</button></li>
      </ul>
    </div>
  );
}

function ChoiceConditionBuilder({
  node,
  option,
  optionIndex,
  project,
  onUpdateNode,
}: {
  node: StoryNode;
  option: ChoiceOption;
  optionIndex: number;
  project: ChoiceForgeProject;
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void;
}) {
  const parsed = parseConditionExpression(option.cond?.expr ?? "", project.variables);
  const variable = project.variables.find((candidate) => candidate.name === parsed.variable) ?? project.variables[0];
  const operators = conditionOperators(variable);
  const operator = operators.includes(parsed.operator) ? parsed.operator : operators[0];
  const value = parsed.value || defaultConditionValue(variable);

  return (
    <div className="cond-builder">
      <span className="branch-effects-title">option condition</span>
      <div className="cb-row">
        <select value={variable?.name ?? ""} onChange={(event) => updateChoiceCondition(node, optionIndex, option, { variable: event.target.value }, project.variables, onUpdateNode)}>
          {project.variables.map((candidate) => <option key={candidate.name} value={candidate.name}>{candidate.name}</option>)}
        </select>
        <select value={operator} onChange={(event) => updateChoiceCondition(node, optionIndex, option, { operator: event.target.value }, project.variables, onUpdateNode)}>
          {operators.map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}
        </select>
        {variable?.type === "boolean" ? (
          <select value={value === "true" ? "true" : "false"} onChange={(event) => updateChoiceCondition(node, optionIndex, option, { value: event.target.value }, project.variables, onUpdateNode)}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input value={value} inputMode={variable?.type === "number" ? "decimal" : "text"} onChange={(event) => updateChoiceCondition(node, optionIndex, option, { value: event.target.value }, project.variables, onUpdateNode)} />
        )}
      </div>
      {parsed.raw && <ConditionInput className="cond-raw" value={option.cond?.expr ?? ""} onChange={(expr) => updateOption(node, optionIndex, { cond: { ...option.cond!, expr } }, onUpdateNode)} variables={project.variables.map((v) => v.name)} aria-label="advanced condition" />}
    </div>
  );
}

function FakeChoiceConditionBuilder({
  node,
  option,
  optionIndex,
  project,
  onUpdateNode,
}: {
  node: StoryNode;
  option: FakeChoiceOption;
  optionIndex: number;
  project: ChoiceForgeProject;
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void;
}) {
  const parsed = parseConditionExpression(option.cond?.expr ?? "", project.variables);
  const variable = project.variables.find((candidate) => candidate.name === parsed.variable) ?? project.variables[0];
  const operators = conditionOperators(variable);
  const operator = operators.includes(parsed.operator) ? parsed.operator : operators[0];
  const value = parsed.value || defaultConditionValue(variable);

  return (
    <div className="cond-builder">
      <span className="branch-effects-title">option condition</span>
      <div className="cb-row">
        <select value={variable?.name ?? ""} onChange={(event) => updateFakeChoiceCondition(node, optionIndex, option, { variable: event.target.value }, project.variables, onUpdateNode)}>
          {project.variables.map((candidate) => <option key={candidate.name} value={candidate.name}>{candidate.name}</option>)}
        </select>
        <select value={operator} onChange={(event) => updateFakeChoiceCondition(node, optionIndex, option, { operator: event.target.value }, project.variables, onUpdateNode)}>
          {operators.map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}
        </select>
        {variable?.type === "boolean" ? (
          <select value={value === "true" ? "true" : "false"} onChange={(event) => updateFakeChoiceCondition(node, optionIndex, option, { value: event.target.value }, project.variables, onUpdateNode)}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input value={value} inputMode={variable?.type === "number" ? "decimal" : "text"} onChange={(event) => updateFakeChoiceCondition(node, optionIndex, option, { value: event.target.value }, project.variables, onUpdateNode)} />
        )}
      </div>
      {parsed.raw && <ConditionInput className="cond-raw" value={option.cond?.expr ?? ""} onChange={(expr) => updateFakeOption(node, optionIndex, { cond: { ...option.cond!, expr } }, onUpdateNode)} variables={project.variables.map((v) => v.name)} aria-label="advanced condition" />}
    </div>
  );
}

function LogicTab({
  node,
  project,
  onUpdateNode,
  onAddFlowEdge,
  onDeleteFlowEdge,
  onSelectNode,
}: {
  node: StoryNode;
  project: ChoiceForgeProject;
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void;
  onAddFlowEdge: (from: string, to: string) => void;
  onDeleteFlowEdge: (from: string, to: string) => void;
  onSelectNode: (id: string) => void;
}) {
  const fallbackTarget = project.nodes.find((target) => target.id !== node.id)?.id ?? node.id;
  const [flowTarget, setFlowTarget] = useState(fallbackTarget);
  const selectedFlowTarget = project.nodes.some((target) => target.id === flowTarget && target.id !== node.id) ? flowTarget : fallbackTarget;

  if (node.type === "if") {
    const branches = normalizeBranches(node.branches ?? [], fallbackTarget);
    const hasElseBranch = branches.some((branch) => branch.kind === "else");
    return (
      <div className="ip-logic">
        <label className="ip-label">branches</label>
        <ul className="ip-branches">
          {branches.map((branch, index) => (
            <li key={`${branch.kind}-${index}`} className={`ip-branch branch-${branch.kind}`}>
              <div className="branch-main">
                <span className="branch-key">*{branch.kind}</span>
                {branch.kind !== "else" && <ConditionInput className="cond-input wide" value={branch.expr ?? ""} onChange={(expr) => updateBranch(node, index, { expr }, fallbackTarget, onUpdateNode)} variables={project.variables.map((v) => v.name)} />}
                <select value={branch.to} onChange={(event) => updateBranch(node, index, { to: event.target.value }, fallbackTarget, onUpdateNode)}>
                  {project.nodes.map((target) => <option key={target.id} value={target.id}>{target.id} - {target.title}</option>)}
                </select>
                <button className="mini-action" title="Navigate to target node" onClick={() => onSelectNode(branch.to)}>→</button>
                <button className="mini-action danger" disabled={branches.length <= 1} onClick={() => removeBranch(node, index, fallbackTarget, onUpdateNode)}>del</button>
              </div>
              <BranchSets node={node} branch={branch} branchIndex={index} project={project} onUpdateNode={onUpdateNode} />
            </li>
          ))}
        </ul>
        <div className="branch-actions">
          <button className="ghost-btn" onClick={() => addBranch(node, "elseif", fallbackTarget, onUpdateNode)}>+ *elseif</button>
          <button className="ghost-btn" disabled={hasElseBranch} onClick={() => addBranch(node, "else", fallbackTarget, onUpdateNode)}>+ *else</button>
        </div>
        <OutgoingEdges node={node} project={project} onDeleteFlowEdge={onDeleteFlowEdge} onSelectNode={onSelectNode} />
        <IncomingConnections node={node} project={project} onSelectNode={onSelectNode} />
      </div>
    );
  }

  return (
    <div className="ip-logic">
      <label className="ip-label">logic structure</label>
      <pre className="cond-final"><code>{node.branches?.map((branch) => `*${branch.kind}${branch.expr ? ` (${branch.expr})` : ""} -> ${branch.to}`).join("\n") || "no branches"}</code></pre>
      <label className="ip-label">visual flow</label>
      <div className="flow-editor">
        <select value={selectedFlowTarget} onChange={(event) => setFlowTarget(event.target.value)}>
          {project.nodes.filter((target) => target.id !== node.id).map((target) => <option key={target.id} value={target.id}>{target.id} - {target.title}</option>)}
        </select>
        <button className="ghost-btn" onClick={() => onAddFlowEdge(node.id, selectedFlowTarget)}>+ connect</button>
      </div>
      <OutgoingEdges node={node} project={project} onDeleteFlowEdge={onDeleteFlowEdge} onSelectNode={onSelectNode} />
      <IncomingConnections node={node} project={project} onSelectNode={onSelectNode} />
    </div>
  );
}

function OutgoingEdges({
  node,
  project,
  onDeleteFlowEdge,
  onSelectNode,
}: {
  node: StoryNode;
  project: ChoiceForgeProject;
  onDeleteFlowEdge: (from: string, to: string) => void;
  onSelectNode: (id: string) => void;
}) {
  const outgoing = project.edges.filter((edge) => edge.from === node.id);
  if (!outgoing.length) return <p className="dim">no outgoing connections</p>;

  return (
    <ul className="flow-list">
      {outgoing.map((edge, index) => (
        <li key={`${edge.from}-${edge.to}-${edge.kind}-${index}`} className="flow-row">
          <span className={`flow-kind flow-${edge.kind}`}>{edge.kind}</span>
          <button className="flow-target" type="button" onClick={() => onSelectNode(edge.to)}>
            <code>{targetLabel(project, edge)}</code>
          </button>
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

function IncomingConnections({
  node,
  project,
  onSelectNode,
}: {
  node: StoryNode;
  project: ChoiceForgeProject;
  onSelectNode: (id: string) => void;
}) {
  const incoming = project.edges.filter((edge) => edge.to === node.id);
  if (!incoming.length) return null;

  return (
    <>
      <label className="ip-label">incoming connections</label>
      <ul className="flow-list">
        {incoming.map((edge, index) => {
          const source = project.nodes.find((n) => n.id === edge.from);
          return (
            <li key={`${edge.from}-${edge.to}-${edge.kind}-${index}`} className="flow-row">
              <span className={`flow-kind flow-${edge.kind}`}>{edge.kind}</span>
              <button className="flow-target" type="button" onClick={() => onSelectNode(edge.from)}>
                <code>{source ? `${source.id} - ${source.title}` : edge.from}</code>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function RawTab({ node, project }: { node: StoryNode; project: ChoiceForgeProject }) {
  return (
    <div className="ip-raw">
      <pre className="raw-code"><code>{generateNodeChoiceScript(node, project.edges)}</code></pre>
    </div>
  );
}

function updateOption(node: StoryNode, index: number, patch: Partial<ChoiceOption>, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, { options: node.options?.map((option, optionIndex) => (optionIndex === index ? { ...option, ...patch } : option)) });
}

function choiceReuseValue(option: ChoiceOption | FakeChoiceOption): ChoiceReuseValue {
  return option.reuse ?? (option.hideReuse ? "hide" : "default");
}

function updateOptionReuse(node: StoryNode, index: number, reuse: ChoiceReuseValue, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  updateOption(node, index, { reuse: reuse === "default" ? undefined : reuse, hideReuse: reuse === "hide" }, onUpdateNode);
}

function updateOptionCondition(node: StoryNode, index: number, value: string, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  const cond = value === "none" ? null : { type: value as ChoiceCondition["type"], expr: node.options?.[index]?.cond?.expr || "true" };
  updateOption(node, index, { cond }, onUpdateNode);
}

function updateChoiceCondition(
  node: StoryNode,
  optionIndex: number,
  option: ChoiceOption,
  patch: Partial<ParsedCondition>,
  variables: VariableSummary[],
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void,
) {
  const current = parseConditionExpression(option.cond?.expr ?? "", variables);
  const next = { ...current, ...patch };
  const variable = variables.find((candidate) => candidate.name === next.variable) ?? variables[0];
  const operators = conditionOperators(variable);
  const operator = operators.includes(next.operator) ? next.operator : operators[0];
  const value = next.value || defaultConditionValue(variable);
  updateOption(node, optionIndex, { cond: { ...option.cond!, expr: buildConditionExpression(variable?.name ?? next.variable, operator, value, variable) } }, onUpdateNode);
}

function addOption(node: StoryNode, project: ChoiceForgeProject, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  const fallbackTarget = project.nodes.find((target) => target.id !== node.id)?.id ?? node.id;
  onUpdateNode(node.id, { options: [...(node.options ?? []), { text: "New option", to: fallbackTarget, cond: null }] });
}

function removeOption(node: StoryNode, index: number, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, { options: node.options?.filter((_, optionIndex) => optionIndex !== index) });
}

function updateFakeOption(node: StoryNode, index: number, patch: Partial<FakeChoiceOption>, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, { fakeOptions: node.fakeOptions?.map((option, optionIndex) => (optionIndex === index ? { ...option, ...patch } : option)) });
}

function updateFakeOptionReuse(node: StoryNode, index: number, reuse: ChoiceReuseValue, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  updateFakeOption(node, index, { reuse: reuse === "default" ? undefined : reuse, hideReuse: reuse === "hide" }, onUpdateNode);
}

function updateFakeOptionCondition(node: StoryNode, index: number, value: string, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  const cond = value === "none" ? null : { type: value as ChoiceCondition["type"], expr: node.fakeOptions?.[index]?.cond?.expr || "true" };
  updateFakeOption(node, index, { cond }, onUpdateNode);
}

function updateFakeChoiceCondition(
  node: StoryNode,
  optionIndex: number,
  option: FakeChoiceOption,
  patch: Partial<ParsedCondition>,
  variables: VariableSummary[],
  onUpdateNode: (id: string, patch: Partial<StoryNode>) => void,
) {
  const current = parseConditionExpression(option.cond?.expr ?? "", variables);
  const next = { ...current, ...patch };
  const variable = variables.find((candidate) => candidate.name === next.variable) ?? variables[0];
  const operators = conditionOperators(variable);
  const operator = operators.includes(next.operator) ? next.operator : operators[0];
  const value = next.value || defaultConditionValue(variable);
  updateFakeOption(node, optionIndex, { cond: { ...option.cond!, expr: buildConditionExpression(variable?.name ?? next.variable, operator, value, variable) } }, onUpdateNode);
}

function addFakeOption(node: StoryNode, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, { fakeOptions: [...(node.fakeOptions ?? []), { text: "New option", cond: null }] });
}

function removeFakeOption(node: StoryNode, index: number, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, { fakeOptions: node.fakeOptions?.filter((_, optionIndex) => optionIndex !== index) });
}

function updateOptionSet(node: StoryNode, optionIndex: number, setIndex: number, patch: Partial<VariableSet>, project: ChoiceForgeProject, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, {
    options: node.options?.map((option, currentOptionIndex) => (
      currentOptionIndex === optionIndex
        ? { ...option, sets: option.sets?.map((set, currentSetIndex) => (currentSetIndex === setIndex ? normalizeSetPatch({ ...set, ...patch }, project.variables) : set)) }
        : option
    )),
  });
}

function addOptionSet(node: StoryNode, optionIndex: number, project: ChoiceForgeProject, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, {
    options: node.options?.map((option, currentOptionIndex) => (
      currentOptionIndex === optionIndex ? { ...option, sets: [...(option.sets ?? []), createDefaultSet(project.variables)] } : option
    )),
  });
}

function removeOptionSet(node: StoryNode, optionIndex: number, setIndex: number, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, {
    options: node.options?.map((option, currentOptionIndex) => (
      currentOptionIndex === optionIndex ? { ...option, sets: option.sets?.filter((_, currentSetIndex) => currentSetIndex !== setIndex) } : option
    )),
  });
}

function updateFakeOptionSet(node: StoryNode, optionIndex: number, setIndex: number, patch: Partial<VariableSet>, project: ChoiceForgeProject, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, {
    fakeOptions: node.fakeOptions?.map((option, currentOptionIndex) => (
      currentOptionIndex === optionIndex
        ? { ...option, sets: option.sets?.map((set, currentSetIndex) => (currentSetIndex === setIndex ? normalizeSetPatch({ ...set, ...patch }, project.variables) : set)) }
        : option
    )),
  });
}

function addFakeOptionSet(node: StoryNode, optionIndex: number, project: ChoiceForgeProject, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, {
    fakeOptions: node.fakeOptions?.map((option, currentOptionIndex) => (
      currentOptionIndex === optionIndex ? { ...option, sets: [...(option.sets ?? []), createDefaultSet(project.variables)] } : option
    )),
  });
}

function removeFakeOptionSet(node: StoryNode, optionIndex: number, setIndex: number, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, {
    fakeOptions: node.fakeOptions?.map((option, currentOptionIndex) => (
      currentOptionIndex === optionIndex ? { ...option, sets: option.sets?.filter((_, currentSetIndex) => currentSetIndex !== setIndex) } : option
    )),
  });
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

function removeAchievementCommand(node: StoryNode, achievementId: string, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  const command = `*achieve ${achievementId}`;
  const body = (node.body ?? "").split("\n").filter((line) => line.trim() !== command).join("\n").trimEnd();
  onUpdateNode(node.id, { body });
}

function extractAchievementCommands(body: string): string[] {
  return [...body.matchAll(/^[ \t]*\*achieve[ \t]+([a-z_][\w]*)[ \t]*$/gim)].map((match) => match[1]);
}

function WritingFocusOverlay({
  title,
  body,
  wordCount,
  variables,
  achievements,
  onChange,
  onClose,
}: {
  title: string;
  body: string;
  wordCount: number;
  variables: string[];
  achievements: string[];
  onChange: (text: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="wf-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wf-modal">
        <div className="wf-head">
          <span className="wf-title">{title}</span>
          <span className="wf-wc">{wordCount} {wordCount === 1 ? "word" : "words"}</span>
          <button className="wf-close" onClick={onClose}>✕ done</button>
        </div>
        <div className="wf-body">
          <NodeBodyEditor value={body} onChange={onChange} variables={variables} achievements={achievements} />
        </div>
      </div>
    </div>
  );
}

type Branch = NonNullable<StoryNode["branches"]>[number];

function updateBranch(node: StoryNode, index: number, patch: Partial<Branch>, fallbackTarget: string, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  onUpdateNode(node.id, { branches: normalizeBranches(node.branches ?? [], fallbackTarget).map((branch, branchIndex) => (branchIndex === index ? normalizeBranch({ ...branch, ...patch }, branchIndex) : branch)) });
}

function addBranch(node: StoryNode, kind: Branch["kind"], fallbackTarget: string, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  const branches = normalizeBranches(node.branches ?? [], fallbackTarget);
  const nextBranch: Branch = kind === "else"
    ? { kind: "else", to: fallbackTarget }
    : { kind: "elseif", expr: "true", to: fallbackTarget };
  const elseIndex = branches.findIndex((branch) => branch.kind === "else");
  const nextBranches = kind === "else"
    ? [...branches.filter((branch) => branch.kind !== "else"), nextBranch]
    : elseIndex >= 0
      ? [...branches.slice(0, elseIndex), nextBranch, ...branches.slice(elseIndex)]
      : [...branches, nextBranch];
  onUpdateNode(node.id, { branches: normalizeBranches(nextBranches, fallbackTarget) });
}

function removeBranch(node: StoryNode, index: number, fallbackTarget: string, onUpdateNode: (id: string, patch: Partial<StoryNode>) => void) {
  const branches = normalizeBranches(node.branches ?? [], fallbackTarget);
  if (branches.length <= 1) return;
  onUpdateNode(node.id, { branches: normalizeBranches(branches.filter((_, branchIndex) => branchIndex !== index), fallbackTarget) });
}

function normalizeBranches(branches: Branch[], fallbackTarget: string): Branch[] {
  const baseBranches = branches.length ? branches : [{ kind: "if" as const, expr: "true", to: fallbackTarget }];
  const nonElseBranches = baseBranches.filter((branch) => branch.kind !== "else").map(normalizeBranch);
  const elseBranch = baseBranches.find((branch) => branch.kind === "else");
  return [
    ...nonElseBranches.map((branch, index) => normalizeBranch(branch, index)),
    ...(elseBranch ? [normalizeBranch(elseBranch, nonElseBranches.length)] : []),
  ];
}

function normalizeBranch(branch: Branch, index: number): Branch {
  if (branch.kind === "else") return { kind: "else", to: branch.to, sets: branch.sets };
  return {
    ...branch,
    kind: index === 0 ? "if" : "elseif",
    expr: branch.expr?.trim() || "true",
  };
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
  return normalizeSetForVariable(variables[0]?.name ?? "variable", variables) as VariableSet;
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

interface ParsedCondition {
  variable: string;
  operator: string;
  value: string;
  raw: boolean;
}

function parseConditionExpression(expression: string, variables: VariableSummary[]): ParsedCondition {
  const trimmed = expression.trim();
  const fallback = variables[0];
  if (!trimmed) return { variable: fallback?.name ?? "", operator: fallback?.type === "boolean" ? "is" : "=", value: defaultConditionValue(fallback), raw: false };

  const booleanMatch = /^([a-z_][\w]*)(?:\s*=\s*(true|false))?$/i.exec(trimmed);
  if (booleanMatch) {
    const variable = variables.find((candidate) => candidate.name === booleanMatch[1]);
    if (variable?.type === "boolean") return { variable: variable.name, operator: booleanMatch[2] === "false" ? "is not" : "is", value: booleanMatch[2] ?? "true", raw: false };
  }

  const comparisonMatch = /^([a-z_][\w]*)\s*(=|!=|>=|<=|>|<)\s*(.+)$/i.exec(trimmed);
  if (comparisonMatch) {
    const variable = variables.find((candidate) => candidate.name === comparisonMatch[1]);
    if (variable) return { variable: variable.name, operator: comparisonMatch[2], value: comparisonMatch[3], raw: false };
  }

  return { variable: fallback?.name ?? "", operator: fallback?.type === "boolean" ? "is" : "=", value: trimmed, raw: true };
}

function conditionOperators(variable: VariableSummary | undefined): string[] {
  if (variable?.type === "boolean") return ["is", "is not"];
  if (variable?.type === "string") return ["=", "!="];
  return ["=", "!=", ">", ">=", "<", "<="];
}

function defaultConditionValue(variable: VariableSummary | undefined): string {
  if (variable?.type === "boolean") return "true";
  if (variable?.type === "string") return "\"\"";
  return "0";
}

function buildConditionExpression(variableName: string, operator: string, value: string, variable: VariableSummary | undefined): string {
  if (variable?.type === "boolean") return operator === "is not" ? `${variableName} = false` : variableName;
  return `${variableName} ${operator} ${value || defaultConditionValue(variable)}`;
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

function ConditionInput({
  value,
  onChange,
  variables,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  variables: string[];
  className?: string;
  "aria-label"?: string;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [wordStart, setWordStart] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    const partial = val.slice(0, cursor).match(/[a-z_][\w]*$/i)?.[0] ?? "";
    if (partial.length >= 1) {
      const pl = partial.toLowerCase();
      const matches = variables.filter((v) => v.toLowerCase().startsWith(pl) && v !== partial);
      setSuggestions(matches.slice(0, 7));
      setWordStart(cursor - partial.length);
    } else {
      setSuggestions([]);
    }
    onChange(val);
  };

  const pick = (varName: string) => {
    const cursor = inputRef.current?.selectionStart ?? value.length;
    const next = value.slice(0, wordStart) + varName + value.slice(cursor);
    onChange(next);
    setSuggestions([]);
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      inputRef.current.focus();
      const pos = wordStart + varName.length;
      inputRef.current.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="cond-wrap">
      <input
        ref={inputRef}
        className={className}
        value={value}
        aria-label={ariaLabel}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setSuggestions([]), 150)}
      />
      {suggestions.length > 0 && (
        <ul className="cond-suggestions">
          {suggestions.map((v) => (
            <li key={v} className="cond-suggestion" onMouseDown={(e) => { e.preventDefault(); pick(v); }}>{v}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function nodeBodyWordCount(text: string): number {
  return text
    .replace(/\$\{[^}]+\}/g, " ")
    .replace(/@\{[^}]+\}/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

const CONVERTIBLE: Partial<Record<NodeType, NodeType[]>> = {
  passage:     ["choice", "fake_choice", "page_break", "comment"],
  choice:      ["passage", "fake_choice"],
  fake_choice: ["passage", "choice"],
  comment:     ["passage"],
  page_break:  ["passage"],
};

function getConvertibleTypes(from: NodeType): NodeType[] {
  return CONVERTIBLE[from] ?? [];
}

function buildTypeConversionPatch(node: StoryNode, to: NodeType, fallbackNodeId: string): Partial<StoryNode> | null {
  const from = node.type;
  if (from === to) return null;

  if (from === "passage" && to === "choice") {
    return { type: "choice", title: "*choice", prompt: node.body ?? "", body: undefined, options: [] };
  }
  if (from === "passage" && to === "fake_choice") {
    return { type: "fake_choice", title: "*fake_choice", prompt: node.body ?? "", body: undefined, fakeOptions: [] };
  }
  if (from === "passage" && to === "page_break") {
    return { type: "page_break", title: "*page_break", body: undefined };
  }
  if (from === "passage" && to === "comment") {
    return { type: "comment", title: `*comment ${node.body ?? ""}`.trimEnd() };
  }
  if (from === "choice" && to === "passage") {
    return { type: "passage", title: node.prompt ? node.prompt.split("\n")[0].slice(0, 40) : "passage", body: node.prompt ?? "", prompt: undefined, options: undefined };
  }
  if (from === "choice" && to === "fake_choice") {
    return { type: "fake_choice", title: "*fake_choice", fakeOptions: (node.options ?? []).map((o) => ({ text: o.text })), options: undefined };
  }
  if (from === "fake_choice" && to === "passage") {
    return { type: "passage", title: node.prompt ? node.prompt.split("\n")[0].slice(0, 40) : "passage", body: node.prompt ?? "", prompt: undefined, fakeOptions: undefined };
  }
  if (from === "fake_choice" && to === "choice") {
    return { type: "choice", title: "*choice", options: (node.fakeOptions ?? []).map((o) => ({ text: o.text, to: fallbackNodeId })), fakeOptions: undefined };
  }
  if (from === "comment" && to === "passage") {
    return { type: "passage", title: "passage", body: node.body ?? "" };
  }
  if (from === "page_break" && to === "passage") {
    return { type: "passage", title: "passage", body: "" };
  }
  return null;
}

function countNodeWords(node: StoryNode): number {
  const parts = [
    node.body ?? "",
    node.prompt ?? "",
    ...(node.options?.flatMap((o) => [o.text, o.body ?? ""]) ?? []),
    ...(node.fakeOptions?.flatMap((o) => [o.text, o.body ?? ""]) ?? []),
  ];
  return parts.join(" ")
    .replace(/\$\{[^}]+\}/g, " ")
    .replace(/@\{[^}]+\}/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}
