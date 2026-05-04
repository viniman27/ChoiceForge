// Graph canvas with pan, zoom, and drag-to-move-nodes

function GraphCanvas({ data, density, selectedId, setSelectedId, onMoveNode, onPan, pan, zoom, setZoom }) {
  const wrapRef = React.useRef(null);
  const [drag, setDrag] = React.useState(null); // {nodeId, startX, startY, origX, origY}
  const [panning, setPanning] = React.useState(null);
  const [space, setSpace] = React.useState(false);

  React.useEffect(() => {
    const kd = (e) => { if (e.code === "Space" && !e.repeat) setSpace(true); };
    const ku = (e) => { if (e.code === "Space") setSpace(false); };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, []);

  const onWheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoom((z) => Math.max(0.4, Math.min(1.6, z + delta)));
  };

  const onPointerDownBg = (e) => {
    if (e.target !== e.currentTarget && !e.target.classList.contains("canvas-grid")) return;
    setSelectedId(null);
    if (space || e.button === 1) {
      setPanning({ startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y });
    }
  };

  const onDragStartNode = (e, id) => {
    const node = data.nodes.find((n) => n.id === id);
    setDrag({ nodeId: id, startX: e.clientX, startY: e.clientY, origX: node.x, origY: node.y });
  };

  React.useEffect(() => {
    const onMove = (e) => {
      if (drag) {
        const dx = (e.clientX - drag.startX) / zoom;
        const dy = (e.clientY - drag.startY) / zoom;
        onMoveNode(drag.nodeId, drag.origX + dx, drag.origY + dy);
      } else if (panning) {
        const dx = e.clientX - panning.startX;
        const dy = e.clientY - panning.startY;
        onPan({ x: panning.origX + dx, y: panning.origY + dy });
      }
    };
    const onUp = () => { setDrag(null); setPanning(null); };
    if (drag || panning) {
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    }
  }, [drag, panning, zoom, onMoveNode, onPan]);

  // edge rendering
  const edgePath = (from, to, kind) => {
    const fromNode = data.nodes.find((n) => n.id === from);
    const toNode = data.nodes.find((n) => n.id === to);
    if (!fromNode || !toNode) return null;
    // approximate node heights
    const fh = estimateNodeHeight(fromNode, density);
    const x1 = fromNode.x + fromNode.w;
    const y1 = fromNode.y + fh / 2;
    const x2 = toNode.x;
    const y2 = toNode.y + estimateNodeHeight(toNode, density) / 2;
    // route: if to is left of from, route around
    const isBack = x2 < x1;
    let d;
    if (isBack) {
      const midY = Math.max(y1, y2) + 80;
      d = `M ${x1} ${y1} C ${x1+60} ${y1}, ${x1+60} ${midY}, ${(x1+x2)/2} ${midY} S ${x2-60} ${y2}, ${x2} ${y2}`;
    } else {
      const cx = (x1 + x2) / 2;
      d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
    }
    return { d, x1, y1, x2, y2 };
  };

  return (
    <div className="canvas-wrap" ref={wrapRef} onWheel={onWheel} onPointerDown={onPointerDownBg}
         style={{ cursor: space ? (panning ? "grabbing" : "grab") : "default" }}>
      <div className="canvas-grid" />
      <div className="canvas-inner" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        <svg className="edges" width="3000" height="2000">
          <defs>
            <marker id="arrow-flow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-mute)"/>
            </marker>
            <marker id="arrow-choice" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--c-choice)"/>
            </marker>
            <marker id="arrow-goto" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--c-goto)"/>
            </marker>
            <marker id="arrow-if" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--c-if)"/>
            </marker>
          </defs>
          {data.edges.map((e, i) => {
            const p = edgePath(e.from, e.to, e.kind);
            if (!p) return null;
            const dashed = e.kind === "goto";
            const colorVar =
              e.kind === "choice" ? "var(--c-choice)" :
              e.kind === "goto" ? "var(--c-goto)" :
              e.kind === "if" || e.kind === "elseif" || e.kind === "else" ? "var(--c-if)" :
              "var(--ink-mute)";
            const marker =
              e.kind === "choice" ? "url(#arrow-choice)" :
              e.kind === "goto" ? "url(#arrow-goto)" :
              e.kind === "if" || e.kind === "elseif" || e.kind === "else" ? "url(#arrow-if)" :
              "url(#arrow-flow)";
            return (
              <g key={i} className={`edge edge-${e.kind}`}>
                <path d={p.d} stroke={colorVar} strokeWidth="1.6"
                      strokeDasharray={dashed ? "5 4" : null}
                      fill="none" markerEnd={marker} opacity="0.85"/>
                {e.label && (
                  <foreignObject x={(p.x1 + p.x2) / 2 - 50} y={(p.y1 + p.y2) / 2 - 12} width="100" height="22">
                    <div className="edge-label" style={{ borderColor: colorVar, color: colorVar }}>{e.label}</div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </svg>

        {data.nodes.map((n) => (
          <NodeCard
            key={n.id} node={n} density={density}
            selected={selectedId === n.id}
            hasError={n.id === "n8"}  /* demo: n8 has the missing-label error */
            onSelect={setSelectedId}
            onDragStart={onDragStartNode}
          />
        ))}

        {/* sticky note demo */}
        <div className="sticky-note" style={{ left: 460, top: 220 }}>
          <div className="sticky-pin" />
          <p>{window.__lang === "pt"
            ? "checar tom aqui — Kana precisa ter mais peso emocional"
            : "check tone here — Kana needs more emotional weight"}</p>
          <div className="sticky-author">— Kira, 14:32</div>
        </div>

        {/* region group demo */}
        <div className="region" style={{ left: 740, top: 30, width: 580, height: 420 }}>
          <div className="region-label">{window.__lang === "pt" ? "ramificação técnica" : "tech branching"}</div>
        </div>
      </div>

      <ZoomControls zoom={zoom} setZoom={setZoom} />
      <Minimap data={data} pan={pan} zoom={zoom} />
    </div>
  );
}

function estimateNodeHeight(node, density) {
  if (density === "minimal") return 44;
  let h = 50; // head
  if (node.body) h += density === "rich" ? 90 : 50;
  if (node.prompt) h += 28;
  if (node.options) h += node.options.length * (density === "rich" ? 38 : 26) + 8;
  if (node.branches) h += node.branches.length * 24 + 8;
  if (density === "rich" && node.sets && node.sets.length) h += 30;
  if (density === "rich" && node.target) h += 22;
  return h;
}

function ZoomControls({ zoom, setZoom }) {
  return (
    <div className="zoom-controls">
      <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}>−</button>
      <span>{Math.round(zoom * 100)}%</span>
      <button onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}>+</button>
      <button onClick={() => setZoom(1)} className="zoom-reset">⌂</button>
    </div>
  );
}

function Minimap({ data, pan, zoom }) {
  const t = window.I18N[window.__lang || "en"];
  // compute extent
  const minX = Math.min(...data.nodes.map(n => n.x)) - 40;
  const minY = Math.min(...data.nodes.map(n => n.y)) - 40;
  const maxX = Math.max(...data.nodes.map(n => n.x + n.w)) + 40;
  const maxY = Math.max(...data.nodes.map(n => n.y + 200)) + 40;
  const W = maxX - minX, H = maxY - minY;
  const scale = Math.min(180 / W, 120 / H);
  return (
    <div className="minimap">
      <div className="minimap-label">{t.minimap}</div>
      <svg viewBox={`${minX} ${minY} ${W} ${H}`} preserveAspectRatio="xMidYMid meet" width="180" height="120">
        {data.edges.map((e, i) => {
          const f = data.nodes.find(n => n.id === e.from);
          const tn = data.nodes.find(n => n.id === e.to);
          if (!f || !tn) return null;
          return <line key={i} x1={f.x + f.w/2} y1={f.y + 30} x2={tn.x + tn.w/2} y2={tn.y + 30}
                       stroke="var(--ink-mute)" strokeWidth="2" opacity="0.4"/>;
        })}
        {data.nodes.map((n) => {
          const c = window.TYPE_COLORS[n.type] || window.TYPE_COLORS.passage;
          return <rect key={n.id} x={n.x} y={n.y} width={n.w} height="60"
                       rx="8" fill={c.tint} stroke={c.dot} strokeWidth="2"/>;
        })}
      </svg>
    </div>
  );
}

window.GraphCanvas = GraphCanvas;
