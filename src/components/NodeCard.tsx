import type { Density, NodeType, StoryNode, VariableSet } from "../domain/types";

export const typeColors: Record<NodeType, { dot: string; tint: string; label: string }> = {
  passage: { dot: "var(--c-passage)", tint: "var(--c-passage-tint)", label: "passage" },
  choice: { dot: "var(--c-choice)", tint: "var(--c-choice-tint)", label: "choice" },
  if: { dot: "var(--c-if)", tint: "var(--c-if-tint)", label: "*if" },
  set: { dot: "var(--c-set)", tint: "var(--c-set-tint)", label: "*set" },
  label: { dot: "var(--c-label)", tint: "var(--c-label-tint)", label: "*label" },
  goto: { dot: "var(--c-goto)", tint: "var(--c-goto-tint)", label: "*goto" },
  goto_scene: { dot: "var(--c-goto)", tint: "var(--c-goto-tint)", label: "*goto_scene" },
  gosub: { dot: "var(--c-gosub)", tint: "var(--c-gosub-tint)", label: "*gosub" },
  ending: { dot: "var(--c-ending)", tint: "var(--c-ending-tint)", label: "*ending" },
  checkpoint: { dot: "var(--c-check)", tint: "var(--c-check-tint)", label: "*checkpoint" },
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
  if (type === "if") return <svg {...common}><path d="M6 2v3M6 5l-3 3M6 5l3 3M3 8v2M9 8v2" /></svg>;
  if (type === "set") return <svg {...common}><path d="M2 4h8M2 8h8M5 2v8" /></svg>;
  if (type === "label") return <svg {...common}><path d="M2 4l3-2h5v8H5l-3-2z" /></svg>;
  if (type === "goto" || type === "goto_scene") return <svg {...common}><path d="M2 6h7M7 3l3 3-3 3" /></svg>;
  if (type === "gosub") return <svg {...common}><path d="M3 3v6a1 1 0 0 0 1 1h5M9 8l2-2-2-2" /></svg>;
  if (type === "ending") return <svg {...common}><circle cx="6" cy="6" r="4" /><path d="M4 4l4 4M8 4l-4 4" /></svg>;
  if (type === "checkpoint") return <svg {...common}><path d="M3 2v8M3 3h6l-1 2 1 2H3" /></svg>;
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
  selected: boolean;
  hasError: boolean;
  onSelect: (id: string) => void;
  onDragStart: (event: React.PointerEvent<HTMLDivElement>, id: string) => void;
  onConnectStart: (event: React.PointerEvent<HTMLDivElement>, id: string) => void;
  onConnectEnd: (id: string) => void;
}

export function NodeCard({ node, density, selected, hasError, onSelect, onDragStart, onConnectStart, onConnectEnd }: NodeCardProps) {
  const colors = typeColors[node.type];
  const isMinimal = density === "minimal";
  const isRich = density === "rich";

  return (
    <div
      className={`node node-${node.type} ${selected ? "is-selected" : ""} ${hasError ? "has-error" : ""} ${node.warning ? "has-warning" : ""}`}
      style={{ left: node.x, top: node.y, width: node.w, "--accent": colors.dot, "--accent-tint": colors.tint } as React.CSSProperties}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest(".no-drag")) return;
        event.stopPropagation();
        onSelect(node.id);
        onDragStart(event, node.id);
      }}
    >
      <div className="node-head">
        <span className="node-dot" />
        <span className="node-icon"><NodeIcon type={node.type} /></span>
        <span className="node-type">{colors.label}</span>
        <span className="node-title">{node.title}</span>
        {hasError && <span className="node-flag" title="error">!</span>}
      </div>

      {!isMinimal && node.body && <div className="node-body"><p className="narrative">{highlightInline(node.body)}</p></div>}
      {!isMinimal && node.prompt && <div className="node-prompt">{highlightInline(node.prompt)}</div>}

      {!isMinimal && node.options && (
        <ul className="opts">
          {node.options.map((option, index) => (
            <li key={`${option.text}-${index}`} className={`opt ${option.cond?.type === "selectable_if" ? "opt-disabled" : ""}`}>
              <span className="opt-num">#{index + 1}</span>
              <span className="opt-text">{highlightInline(option.text)}</span>
              {isRich && option.cond && <span className="cond-badge"><span className="cond-key">*{option.cond.type}</span><code>{option.cond.expr}</code></span>}
              {isRich && option.hideReuse && <span className="opt-tag">*hide_reuse</span>}
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
            </li>
          ))}
        </ul>
      )}

      {isRich && node.sets && <div className="node-sets">{node.sets.map((set, index) => <VarDelta key={`${set.var}-${index}`} set={set} />)}</div>}
      {isRich && node.target && <div className="node-target">-&gt; <code>{node.target}.txt</code></div>}
      <div className="anchor anchor-in no-drag" title="soltar conexao aqui" onPointerUp={(event) => { event.stopPropagation(); onConnectEnd(node.id); }} />
      <div className="anchor anchor-out no-drag" title="arrastar para conectar" onPointerDown={(event) => onConnectStart(event, node.id)} />
    </div>
  );
}
