// Node card — rich density, soft style #2 (rounded, outlined, dot accent)

const TYPE_COLORS = {
  passage:    { dot: "var(--c-passage)",   tint: "var(--c-passage-tint)",   label: "passage"   },
  choice:     { dot: "var(--c-choice)",    tint: "var(--c-choice-tint)",    label: "choice"    },
  if:         { dot: "var(--c-if)",        tint: "var(--c-if-tint)",        label: "*if"       },
  set:        { dot: "var(--c-set)",       tint: "var(--c-set-tint)",       label: "*set"      },
  label:      { dot: "var(--c-label)",     tint: "var(--c-label-tint)",     label: "*label"    },
  goto:       { dot: "var(--c-goto)",      tint: "var(--c-goto-tint)",      label: "*goto"     },
  goto_scene: { dot: "var(--c-goto)",      tint: "var(--c-goto-tint)",      label: "*goto_scene" },
  gosub:      { dot: "var(--c-gosub)",     tint: "var(--c-gosub-tint)",     label: "*gosub"    },
  ending:     { dot: "var(--c-ending)",    tint: "var(--c-ending-tint)",    label: "*ending"   },
  checkpoint: { dot: "var(--c-check)",     tint: "var(--c-check-tint)",     label: "*checkpoint" },
};

function NodeIcon({ type }) {
  const stroke = "currentColor";
  const common = { width: 12, height: 12, viewBox: "0 0 12 12", fill: "none", stroke, strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (type) {
    case "passage":    return <svg {...common}><path d="M2 3h8M2 6h8M2 9h5"/></svg>;
    case "choice":     return <svg {...common}><path d="M3 2v3a2 2 0 0 0 2 2h4M9 5l2 2-2 2M3 9h2"/></svg>;
    case "if":         return <svg {...common}><path d="M6 2v3M6 5l-3 3M6 5l3 3M3 8v2M9 8v2"/></svg>;
    case "set":        return <svg {...common}><path d="M2 4h8M2 8h8M5 2v8"/></svg>;
    case "label":      return <svg {...common}><path d="M2 4l3-2h5v8H5l-3-2z"/></svg>;
    case "goto":
    case "goto_scene": return <svg {...common}><path d="M2 6h7M7 3l3 3-3 3"/></svg>;
    case "gosub":      return <svg {...common}><path d="M3 3v6a1 1 0 0 0 1 1h5M9 8l2-2-2-2"/></svg>;
    case "ending":     return <svg {...common}><circle cx="6" cy="6" r="4"/><path d="M4 4l4 4M8 4l-4 4"/></svg>;
    case "checkpoint": return <svg {...common}><path d="M3 2v8M3 3h6l-1 2 1 2H3"/></svg>;
    default:           return <svg {...common}><circle cx="6" cy="6" r="3"/></svg>;
  }
}

// Highlight ${var}, @{...}, *commands inside narrative text
function highlightInline(text) {
  if (!text) return null;
  const parts = [];
  const regex = /(\$\{[^}]+\}|@\{[^}]+\}|\*[a-z_]+)/g;
  let last = 0, m, key = 0;
  while ((m = regex.exec(text))) {
    if (m.index > last) parts.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    const tok = m[0];
    if (tok.startsWith("${"))      parts.push(<span key={key++} className="tok-var">{tok}</span>);
    else if (tok.startsWith("@{")) parts.push(<span key={key++} className="tok-multi">{tok}</span>);
    else                            parts.push(<span key={key++} className="tok-cmd">{tok}</span>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(<span key={key++}>{text.slice(last)}</span>);
  return parts;
}

function CondBadge({ cond }) {
  if (!cond) return null;
  const isHide = cond.type === "if";
  return (
    <span className={`cond-badge ${isHide ? "cond-hide" : "cond-disable"}`}>
      <span className="cond-key">*{cond.type}</span>
      <code>{cond.expr}</code>
    </span>
  );
}

function VarDelta({ s }) {
  const sign = s.op === "%+" ? "%+" : s.op === "%-" ? "%−" : s.op;
  const positive = s.op === "+" || s.op === "%+";
  const negative = s.op === "-" || s.op === "%-";
  return (
    <span className={`var-delta ${positive ? "pos" : negative ? "neg" : ""}`}>
      <code className="var-name">{s.var}</code>
      <span className="var-op">{sign}</span>
      <code className="var-val">{s.val}</code>
    </span>
  );
}

function NodeCard({ node, density, selected, onSelect, onDragStart, hasError }) {
  const colors = TYPE_COLORS[node.type] || TYPE_COLORS.passage;
  const t = window.I18N[window.__lang || "en"];
  const isMinimal = density === "minimal";
  const isMedium = density === "medium";
  const isRich = density === "rich";

  const handlePointerDown = (e) => {
    if (e.target.closest(".no-drag")) return;
    e.stopPropagation();
    onSelect(node.id);
    onDragStart(e, node.id);
  };

  return (
    <div
      className={`node node-${node.type} ${selected ? "is-selected" : ""} ${hasError ? "has-error" : ""} ${node.warning ? "has-warning" : ""}`}
      style={{
        left: node.x, top: node.y, width: node.w,
        "--accent": colors.dot, "--accent-tint": colors.tint,
      }}
      onPointerDown={handlePointerDown}
      data-screen-label={`node-${node.id}`}
    >
      <div className="node-head">
        <span className="node-dot" />
        <span className="node-icon"><NodeIcon type={node.type} /></span>
        <span className="node-type">{t.nodeTypes[node.type] || colors.label}</span>
        <span className="node-title">{node.title}</span>
        {hasError && <span className="node-flag" title="error">!</span>}
        {node.warning && !hasError && <span className="node-flag warn" title="warn">⚠</span>}
      </div>

      {!isMinimal && node.body && (
        <div className="node-body">
          {isRich ? (
            <p className="narrative">{highlightInline(node.body)}</p>
          ) : (
            <p className="narrative narrative-clip">{highlightInline(node.body.slice(0, 120))}{node.body.length > 120 ? "…" : ""}</p>
          )}
        </div>
      )}

      {!isMinimal && node.prompt && (
        <div className="node-prompt">{highlightInline(node.prompt)}</div>
      )}

      {!isMinimal && node.options && (
        <ul className="opts">
          {node.options.map((o, i) => (
            <li key={i} className={`opt ${o.cond?.type === "selectable_if" ? "opt-disabled" : ""}`}>
              <span className="opt-num">#{i + 1}</span>
              <span className="opt-text">{highlightInline(o.text)}</span>
              {isRich && o.cond && <CondBadge cond={o.cond} />}
              {isRich && o.hideReuse && <span className="opt-tag">*hide_reuse</span>}
            </li>
          ))}
        </ul>
      )}

      {!isMinimal && node.branches && (
        <ul className="branches">
          {node.branches.map((b, i) => (
            <li key={i} className={`branch branch-${b.kind}`}>
              <span className="branch-key">*{b.kind}</span>
              {b.expr && <code className="branch-expr">{b.expr}</code>}
            </li>
          ))}
        </ul>
      )}

      {isRich && node.sets && node.sets.length > 0 && (
        <div className="node-sets">
          {node.sets.map((s, i) => <VarDelta key={i} s={s} />)}
        </div>
      )}

      {isRich && node.target && (
        <div className="node-target">→ <code>{node.target}.txt</code></div>
      )}

      {/* anchors (visual only; lines are SVG) */}
      <div className="anchor anchor-in" />
      <div className="anchor anchor-out" />
    </div>
  );
}

window.NodeCard = NodeCard;
window.NodeIcon = NodeIcon;
window.TYPE_COLORS = TYPE_COLORS;
window.highlightInline = highlightInline;
