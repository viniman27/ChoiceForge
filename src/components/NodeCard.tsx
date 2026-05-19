import { useEffect, useRef, useState } from "react";
import type { Density, I18nLabels, NodeColorTag, NodeType, StoryNode, VariableSet } from "../domain/types";

export const COLOR_TAG_VALUES: Record<NodeColorTag, string> = {
  red:    "oklch(55% 0.20 25)",
  orange: "oklch(62% 0.17 55)",
  yellow: "oklch(72% 0.16 90)",
  green:  "oklch(52% 0.15 155)",
  blue:   "oklch(52% 0.16 240)",
  purple: "oklch(52% 0.16 300)",
};

export const typeColors: Record<NodeType, { dot: string; tint: string; label: string }> = {
  passage: { dot: "var(--c-passage)", tint: "var(--c-passage-tint)", label: "passage" },
  choice: { dot: "var(--c-choice)", tint: "var(--c-choice-tint)", label: "choice" },
  fake_choice: { dot: "var(--c-choice)", tint: "var(--c-choice-tint)", label: "*fake_choice" },
  if: { dot: "var(--c-if)", tint: "var(--c-if-tint)", label: "*if" },
  set: { dot: "var(--c-set)", tint: "var(--c-set-tint)", label: "*set" },
  label: { dot: "var(--c-label)", tint: "var(--c-label-tint)", label: "*label" },
  goto: { dot: "var(--c-goto)", tint: "var(--c-goto-tint)", label: "*goto" },
  goto_scene: { dot: "var(--c-goto)", tint: "var(--c-goto-tint)", label: "*goto_scene" },
  gosub: { dot: "var(--c-gosub)", tint: "var(--c-gosub-tint)", label: "*gosub" },
  return: { dot: "var(--c-gosub)", tint: "var(--c-gosub-tint)", label: "*return" },
  ending: { dot: "var(--c-ending)", tint: "var(--c-ending-tint)", label: "*ending" },
  finish: { dot: "var(--c-ending)", tint: "var(--c-ending-tint)", label: "*finish" },
  checkpoint: { dot: "var(--c-check)", tint: "var(--c-check-tint)", label: "*checkpoint" },
  restore_checkpoint: { dot: "var(--c-check)", tint: "var(--c-check-tint)", label: "*restore_checkpoint" },
  page_break: { dot: "var(--c-check)", tint: "var(--c-check-tint)", label: "*page_break" },
  comment: { dot: "var(--ink-mute)", tint: "var(--paper-3)", label: "*comment" },
  input_text: { dot: "var(--c-set)", tint: "var(--c-set-tint)", label: "*input_text" },
  input_number: { dot: "var(--c-set)", tint: "var(--c-set-tint)", label: "*input_number" },
  rand: { dot: "var(--c-set)", tint: "var(--c-set-tint)", label: "*rand" },
  gosub_scene: { dot: "var(--c-gosub)", tint: "var(--c-gosub-tint)", label: "*gosub_scene" },
  image: { dot: "var(--c-passage)", tint: "var(--c-passage-tint)", label: "*image" },
  sound: { dot: "var(--c-passage)", tint: "var(--c-passage-tint)", label: "*sound" },
  temp: { dot: "var(--c-set)", tint: "var(--c-set-tint)", label: "*temp" },
  params: { dot: "var(--c-set)", tint: "var(--c-set-tint)", label: "*params" },
  achieve: { dot: "var(--c-achieve)", tint: "var(--c-achieve-tint)", label: "*achieve" },
};

export function NodeIcon({ type }: { type: NodeType }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (type === "choice") return <svg {...common}><path d="M3 2v3a2 2 0 0 0 2 2h4M9 5l2 2-2 2M3 9h2" /></svg>;
  if (type === "fake_choice") return <svg {...common}><path d="M2 3h8M2 6h8M2 9h5" /><path d="M9 8l1 1-1 1" /></svg>;
  if (type === "if") return <svg {...common}><path d="M6 2v3M6 5l-3 3M6 5l3 3M3 8v2M9 8v2" /></svg>;
  if (type === "set") return <svg {...common}><path d="M2 4h8M2 8h8M5 2v8" /></svg>;
  if (type === "label") return <svg {...common}><path d="M2 4l3-2h5v8H5l-3-2z" /></svg>;
  if (type === "goto" || type === "goto_scene") return <svg {...common}><path d="M2 6h7M7 3l3 3-3 3" /></svg>;
  if (type === "gosub") return <svg {...common}><path d="M3 3v6a1 1 0 0 0 1 1h5M9 8l2-2-2-2" /></svg>;
  if (type === "return") return <svg {...common}><path d="M9 3v6a1 1 0 0 1-1 1H3M3 8l-2-2 2-2" /></svg>;
  if (type === "ending") return <svg {...common}><circle cx="6" cy="6" r="4" /><path d="M4 4l4 4M8 4l-4 4" /></svg>;
  if (type === "finish") return <svg {...common}><path d="M3 2v8" /><path d="M3 3h6l-1 2 1 2H3" /><path d="M7 9h3" /></svg>;
  if (type === "checkpoint") return <svg {...common}><path d="M3 2v8M3 3h6l-1 2 1 2H3" /></svg>;
  if (type === "restore_checkpoint") return <svg {...common}><path d="M9 2v8M9 3H3l1 2-1 2h6" /></svg>;
  if (type === "page_break") return <svg {...common}><path d="M3 2h5l1 1v7H3z" /><path d="M7 2v2h2M4 7h4" /></svg>;
  if (type === "comment") return <svg {...common}><path d="M2 3h8v5H5l-3 2z" /></svg>;
  if (type === "input_text") return <svg {...common}><path d="M2 3h8M4 3v6M2 9h4" /></svg>;
  if (type === "input_number") return <svg {...common}><path d="M3 3h6M5 3v6M3 9h6M8 5v4" /></svg>;
  if (type === "rand") return <svg {...common}><path d="M3 3h6v6H3z" /><path d="M5 5h.01M7 7h.01M7 5h.01M5 7h.01" /></svg>;
  if (type === "gosub_scene") return <svg {...common}><path d="M2 6h6M7 3l3 3-3 3M2 3v6" /></svg>;
  if (type === "image") return <svg {...common}><path d="M2 2h8v8H2z" /><path d="M2 8l2-3 2 2 1-1 3 2" /></svg>;
  if (type === "sound") return <svg {...common}><path d="M2 4v4h2l3 3V1L4 4H2z" /><path d="M9 4a3 3 0 0 1 0 4" /></svg>;
  if (type === "temp") return <svg {...common}><path d="M2 4h8M2 8h6M6 2v4" /><circle cx="9" cy="9" r="1.5" /></svg>;
  if (type === "params") return <svg {...common}><path d="M2 6h2M10 6h-2M4 6a2 2 0 0 0 4 0 2 2 0 0 0-4 0" /><path d="M3 3h6M3 9h6" /></svg>;
  if (type === "achieve") return <svg {...common}><path d="M6 1l1.5 3 3.5.5-2.5 2.5.5 3.5L6 9l-3 1.5.5-3.5L1 4.5 4.5 4z" /></svg>;
  return <svg {...common}><path d="M2 3h8M2 6h8M2 9h5" /></svg>;
}

function highlightInline(text: string) {
  const tokens = text.split(/(\$\{[^}]+\}|@\{[^}]+\}|\*[a-z_]+)/g);
  return tokens.map((token, index) => {
    if (token.startsWith("${")) return <span key={index} className="tok-var">{token}</span>;
    if (token.startsWith("@{")) return <span key={index} className="tok-multi">{token}</span>;
    if (token.startsWith("*")) return <span key={index} className="tok-cmd">{token}</span>;
    return <span key={index}>{token}</span>;
  });
}

function choiceReuseLabel(option: { reuse?: "hide" | "disable" | "allow"; hideReuse?: boolean }): string {
  const reuse = option.reuse ?? (option.hideReuse ? "hide" : undefined);
  return reuse ? `*${reuse}_reuse` : "";
}

function VarDelta({ set }: { set: VariableSet }) {
  const positive = set.op === "+" || set.op === "%+";
  const negative = set.op === "-" || set.op === "%-";
  return (
    <span className={`var-delta ${positive ? "pos" : negative ? "neg" : ""}`}>
      <code className="var-name">{set.var}</code>
      <span className="var-op">{set.op}</span>
      <code className="var-val">{set.val}</code>
    </span>
  );
}

interface NodeCardProps {
  node: StoryNode;
  density: Density;
  labels: I18nLabels;
  selected: boolean;
  hasError: boolean;
  hasWarning?: boolean;
  isDimmed?: boolean;
  overrideWidth?: number;
  onSelect: (id: string, addToSelection: boolean) => void;
  onDragStart: (event: React.PointerEvent<HTMLDivElement>, id: string) => void;
  onConnectStart: (event: React.PointerEvent<HTMLDivElement>, id: string) => void;
  onConnectEnd: (id: string) => void;
  onUpdateTitle?: (id: string, title: string) => void;
  onNavigateToScene?: (sceneName: string) => void;
  onResizeStart?: (event: React.PointerEvent<HTMLDivElement>, id: string) => void;
}

export function NodeCard({ node, density, labels, selected, hasError, hasWarning, isDimmed, overrideWidth, onSelect, onDragStart, onConnectStart, onConnectEnd, onUpdateTitle, onNavigateToScene, onResizeStart }: NodeCardProps) {
  const colors = typeColors[node.type];
  const isMinimal = density === "minimal";
  const isRich = density === "rich";
  const [editingTitle, setEditingTitle] = useState(false);
  const [editValue, setEditValue] = useState(node.title);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingTitle) { titleInputRef.current?.focus(); titleInputRef.current?.select(); }
  }, [editingTitle]);

  const commitTitle = () => {
    const trimmed = editValue.trim() || node.title;
    setEditValue(trimmed);
    onUpdateTitle?.(node.id, trimmed);
    setEditingTitle(false);
  };

  return (
    <div
      data-node-id={node.id}
      className={`node node-${node.type} ${selected ? "is-selected" : ""} ${hasError ? "has-error" : ""} ${hasWarning ? "has-warning" : ""} ${node.colorTag ? "has-color-tag" : ""} ${isDimmed ? "is-dimmed" : ""} ${(node.type === "goto_scene" || node.type === "gosub_scene") && node.target && onNavigateToScene ? "is-navigable" : ""}`}
      style={{ left: node.x, top: node.y, width: overrideWidth ?? node.w, "--accent": colors.dot, "--accent-tint": colors.tint, "--ct": node.colorTag ? COLOR_TAG_VALUES[node.colorTag] : "transparent" } as React.CSSProperties}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest(".no-drag")) return;
        event.stopPropagation();
        onSelect(node.id, event.shiftKey);
        onDragStart(event, node.id);
      }}
      onDoubleClick={(event) => {
        if ((node.type === "goto_scene" || node.type === "gosub_scene") && node.target && onNavigateToScene) {
          event.stopPropagation();
          onNavigateToScene(node.target);
        }
      }}
    >
      <div className="node-head">
        <span className="node-dot" />
        <span className="node-icon"><NodeIcon type={node.type} /></span>
        <span className="node-type">{colors.label}</span>
        {editingTitle ? (
          <input
            ref={titleInputRef}
            className="node-title-input no-drag"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              else if (e.key === "Escape") { setEditValue(node.title); setEditingTitle(false); }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="node-title"
            onDoubleClick={(e) => {
              if (!onUpdateTitle) return;
              e.stopPropagation();
              setEditValue(node.title);
              setEditingTitle(true);
            }}
          >{node.title}</span>
        )}
        {node.status && <span className={`node-status node-status-${node.status}`}>{node.status}</span>}
        {node.note && <span className="node-note-dot" title={node.note}>✎</span>}
        {hasError && <span className="node-flag" title="error">!</span>}
        {!hasError && hasWarning && <span className="node-flag node-flag-warn" title="warning">⚠</span>}
      </div>

      {!isMinimal && node.body && <div className="node-body"><p className="narrative narrative-clip">{highlightInline(node.body)}</p></div>}
      {!isMinimal && node.prompt && <div className="node-prompt">{highlightInline(node.prompt)}</div>}

      {!isMinimal && node.options && (
        <ul className="opts">
          {node.options.map((option, index) => (
            <li key={`${option.text}-${index}`} className={`opt ${option.cond?.type === "selectable_if" ? "opt-disabled" : ""}`}>
              <span className="opt-num">#{index + 1}</span>
              <span className="opt-text">{highlightInline(option.text)}</span>
              {isRich && option.cond && <span className="cond-badge"><span className="cond-key">*{option.cond.type}</span><code>{option.cond.expr}</code></span>}
              {isRich && choiceReuseLabel(option) && <span className="opt-tag">{choiceReuseLabel(option)}</span>}
              {isRich && option.body && <p className="opt-body">{option.body.length > 72 ? `${option.body.slice(0, 70)}…` : option.body}</p>}
            </li>
          ))}
        </ul>
      )}

      {!isMinimal && node.fakeOptions && (
        <ul className="opts">
          {node.fakeOptions.map((option, index) => (
            <li key={`${option.text}-${index}`} className={`opt ${option.cond?.type === "selectable_if" ? "opt-disabled" : ""}`}>
              <span className="opt-num">#{index + 1}</span>
              <span className="opt-text">{highlightInline(option.text)}</span>
              {isRich && option.cond && <span className="cond-badge"><span className="cond-key">*{option.cond.type}</span><code>{option.cond.expr}</code></span>}
              {isRich && choiceReuseLabel(option) && <span className="opt-tag">{choiceReuseLabel(option)}</span>}
              {isRich && option.body && <p className="opt-body">{option.body.length > 72 ? `${option.body.slice(0, 70)}…` : option.body}</p>}
            </li>
          ))}
        </ul>
      )}

      {!isMinimal && node.branches && (
        <ul className="branches">
          {node.branches.map((branch, index) => (
            <li key={`${branch.kind}-${index}`} className={`branch branch-${branch.kind}`}>
              <span className="branch-key">*{branch.kind}</span>
              {branch.expr && <code className="branch-expr">{branch.expr}</code>}
              {isRich && branch.sets?.map((set, setIndex) => <VarDelta key={`${set.var}-${setIndex}`} set={set} />)}
            </li>
          ))}
        </ul>
      )}

      {isRich && node.sets && <div className="node-sets">{node.sets.map((set, index) => <VarDelta key={`${set.var}-${index}`} set={set} />)}</div>}
      {isRich && node.target && node.type !== "image" && node.type !== "sound" && node.type !== "achieve" && <div className="node-target">-&gt; <code>{node.target}.txt</code></div>}
      {isRich && (node.type === "image" || node.type === "sound" || node.type === "achieve") && node.target && <div className="node-target"><code>{node.target}</code></div>}
      {isRich && node.inputVar && <div className="node-target">-&gt; <code>{node.inputVar}</code></div>}
      {isRich && node.type === "passage" && node.body && (() => { const wc = countCardWords(node.body); return wc > 0 ? <div className={`node-wc${wc > 600 ? " node-wc-long" : ""}`}>{wc} words</div> : null; })()}
      <div className="anchor anchor-in no-drag" title={labels.connectHere} data-node-id={node.id} onPointerUp={(event) => { event.stopPropagation(); onConnectEnd(node.id); }} />
      <div className="anchor anchor-out no-drag" title={labels.dragToConnect} onPointerDown={(event) => onConnectStart(event, node.id)} />
      {onResizeStart && <div className="node-resize no-drag" onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e, node.id); }} />}
    </div>
  );
}

function countCardWords(text: string): number {
  return text.replace(/\$\{[^}]+\}/g, " ").replace(/@\{[^}]+\}/g, " ").split(/\s+/).filter(Boolean).length;
}
