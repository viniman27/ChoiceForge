import { useEffect, useRef, useState } from "react";
import type { ChoiceForgeProject, Density, I18nLabels, NodeType, StoryEdge, StoryNode } from "../domain/types";
import { NodeCard, NodeIcon, typeColors } from "./NodeCard";

interface GraphCanvasProps {
  data: ChoiceForgeProject;
  density: Density;
  labels: I18nLabels;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onMoveNodes: (moves: { id: string; x: number; y: number }[]) => void;
  onLayoutNodes: () => void;
  onConnectNodes: (from: string, to: string) => void;
  onAddNode: (type: NodeType, position: { x: number; y: number }) => void;
  onAddAndConnectNode: (fromId: string, type: NodeType, position: { x: number; y: number }) => void;
  onDuplicateNode: (id: string) => void;
  onDeleteNodes: (ids: string[]) => void;
  onPasteNodes: (nodes: StoryNode[], internalEdges: StoryEdge[], center: { x: number; y: number }) => string[];
  sourcePreserved?: boolean;
  onConvertSource?: () => void;
  pan: { x: number; y: number };
  onPan: (pan: { x: number; y: number }) => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
}

const creatableNodeTypes: NodeType[] = [
  "passage", "choice", "fake_choice", "if", "set", "label", "goto", "goto_scene",
  "gosub", "gosub_scene", "return", "input_text", "input_number", "rand",
  "image", "temp", "params", "page_break", "checkpoint", "restore_checkpoint",
  "comment", "finish", "ending",
];
const TOOLBAR_WIDTH_KEY = "choiceforge.canvasToolbarWidth.v1";
const TOOLBAR_MIN_WIDTH = 260;
const TOOLBAR_DEFAULT_WIDTH = 760;

export function GraphCanvas({
  data, density, labels, selectedId, setSelectedId,
  onMoveNodes, onLayoutNodes, onConnectNodes, onAddNode, onAddAndConnectNode, onDuplicateNode, onDeleteNodes, onPasteNodes,
  sourcePreserved = false, onConvertSource, pan, onPan, zoom, setZoom,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{
    nodeId: string;
    startX: number;
    startY: number;
    origPositions: { id: string; x: number; y: number }[];
  } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [connecting, setConnecting] = useState<{ from: string; x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [viewport, setViewport] = useState({ width: 1000, height: 700 });
  const [space, setSpace] = useState(false);
  const [toolbarWidth, setToolbarWidth] = useState(loadToolbarWidth);
  const [toolbarResize, setToolbarResize] = useState<{ startX: number; startWidth: number } | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(selectedId ? [selectedId] : []));
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  const [selBoxing, setSelBoxing] = useState(false);
  const selBoxRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [selBoxDisplay, setSelBoxDisplay] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const lastSetIdRef = useRef<string | null>(selectedId);
  const clipboardRef = useRef<{ nodes: StoryNode[]; edges: StoryEdge[] } | null>(null);
  const [pendingConnect, setPendingConnect] = useState<{ from: string; screenX: number; screenY: number; worldX: number; worldY: number } | null>(null);

  useEffect(() => {
    if (selectedId !== lastSetIdRef.current) {
      lastSetIdRef.current = selectedId;
      setSelectedIds(selectedId ? new Set([selectedId]) : new Set());
    }
  }, [selectedId]);

  const selectNode = (id: string, addToSet: boolean) => {
    if (addToSet) {
      const current = selectedIdsRef.current;
      const isSelected = current.has(id);
      const next = new Set(current);
      if (isSelected) {
        next.delete(id);
        const newPrimary = ([...next][0] ?? null) as string | null;
        lastSetIdRef.current = newPrimary;
        setSelectedId(newPrimary);
      } else {
        next.add(id);
        lastSetIdRef.current = id;
        setSelectedId(id);
      }
      setSelectedIds(next);
    } else {
      lastSetIdRef.current = id;
      setSelectedId(id);
      setSelectedIds(new Set([id]));
    }
  };

  const clearSelection = () => {
    lastSetIdRef.current = null;
    setSelectedId(null);
    setSelectedIds(new Set());
  };

  const errorNodeIds = new Set(data.lints.filter((lint) => lint.level === "error" && lint.node).map((lint) => lint.node));

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const updateViewport = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !event.repeat) setSpace(true);
      if (isTypingTarget(event.target)) return;
      if (event.key === "Escape") clearSelection();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        const allIds = new Set(data.nodes.map((node) => node.id));
        const first = data.nodes[0]?.id ?? null;
        lastSetIdRef.current = first;
        setSelectedId(first);
        setSelectedIds(allIds);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selectedId) {
        event.preventDefault();
        if (sourcePreserved) return;
        onDuplicateNode(selectedId);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && selectedIdsRef.current.size > 0) {
        if (isTypingTarget(event.target)) return;
        event.preventDefault();
        const ids = selectedIdsRef.current;
        const copiedNodes = data.nodes.filter((node) => ids.has(node.id));
        const copiedEdges = data.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
        clipboardRef.current = { nodes: structuredClone(copiedNodes), edges: structuredClone(copiedEdges) };
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        if (isTypingTarget(event.target)) return;
        if (sourcePreserved || !clipboardRef.current?.nodes.length) return;
        event.preventDefault();
        const center = {
          x: Math.round((viewport.width / 2 - pan.x) / zoom),
          y: Math.round((viewport.height / 2 - pan.y) / zoom),
        };
        const newIds = onPasteNodes(clipboardRef.current.nodes, clipboardRef.current.edges, center);
        if (newIds.length > 0) {
          const first = newIds[0];
          lastSetIdRef.current = first;
          setSelectedId(first);
          setSelectedIds(new Set(newIds));
        }
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedIdsRef.current.size > 0) {
        event.preventDefault();
        if (sourcePreserved) return;
        const ids = [...selectedIdsRef.current];
        onDeleteNodes(ids);
        clearSelection();
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpace(false);
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.nodes, data.edges, onDeleteNodes, onDuplicateNode, onPasteNodes, pan, viewport, selectedId, sourcePreserved, zoom]);

  useEffect(() => {
    window.localStorage.setItem(TOOLBAR_WIDTH_KEY, String(toolbarWidth));
  }, [toolbarWidth]);

  useEffect(() => {
    if (!toolbarResize) return;
    const move = (event: PointerEvent) => {
      const maxWidth = Math.max(TOOLBAR_MIN_WIDTH, viewport.width - 64);
      setToolbarWidth(clamp(toolbarResize.startWidth + event.clientX - toolbarResize.startX, TOOLBAR_MIN_WIDTH, maxWidth));
    };
    const up = () => setToolbarResize(null);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [toolbarResize, viewport.width]);

  useEffect(() => {
    if (!connecting) return;
    document.body.style.cursor = "crosshair";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [connecting]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (drag) {
        const dx = (event.clientX - drag.startX) / zoom;
        const dy = (event.clientY - drag.startY) / zoom;
        onMoveNodes(drag.origPositions.map(({ id, x, y }) => ({ id, x: x + dx, y: y + dy })));
      }
      if (panning) {
        onPan({ x: panning.origX + event.clientX - panning.startX, y: panning.origY + event.clientY - panning.startY });
      }
      if (connecting) {
        setConnecting((current) => current ? { ...current, ...clientToWorld(event.clientX, event.clientY, canvasRef.current, pan, zoom) } : current);
      }
      if (selBoxRef.current) {
        const world = clientToWorldXY(event.clientX, event.clientY, canvasRef.current, pan, zoom);
        selBoxRef.current = { ...selBoxRef.current, x2: world.x, y2: world.y };
        setSelBoxDisplay({ ...selBoxRef.current });
      }
    };
    const up = (event: PointerEvent) => {
      if (connecting) {
        const target = document.elementFromPoint(event.clientX, event.clientY);
        const targetId = target instanceof HTMLElement ? target.closest<HTMLElement>(".anchor-in")?.dataset.nodeId : undefined;
        if (targetId) {
          onConnectNodes(connecting.from, targetId);
        } else if (!sourcePreserved) {
          const world = clientToWorldXY(event.clientX, event.clientY, canvasRef.current, pan, zoom);
          setPendingConnect({ from: connecting.from, screenX: event.clientX, screenY: event.clientY, worldX: world.x, worldY: world.y });
        }
      }
      if (selBoxRef.current) {
        const box = selBoxRef.current;
        const minX = Math.min(box.x1, box.x2);
        const maxX = Math.max(box.x1, box.x2);
        const minY = Math.min(box.y1, box.y2);
        const maxY = Math.max(box.y1, box.y2);
        const hitIds = data.nodes
          .filter((node) => node.x + node.w / 2 >= minX && node.x + node.w / 2 <= maxX && node.y + 18 >= minY && node.y + 18 <= maxY)
          .map((node) => node.id);
        if (hitIds.length > 0) {
          const next = new Set([...selectedIdsRef.current, ...hitIds]);
          setSelectedIds(next);
          lastSetIdRef.current = hitIds[0];
          setSelectedId(hitIds[0]);
        }
        selBoxRef.current = null;
        setSelBoxDisplay(null);
        setSelBoxing(false);
      }
      setDrag(null);
      setPanning(null);
      setConnecting(null);
    };
    if (drag || panning || connecting || selBoxing) {
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecting, drag, onConnectNodes, onMoveNodes, onPan, pan, panning, selBoxing, zoom]);

  const selCount = selectedIds.size;

  return (
    <div
      ref={canvasRef}
      className={`canvas-wrap ${connecting ? "is-connecting" : ""}`}
      onWheel={(event) => {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          const rect = event.currentTarget.getBoundingClientRect();
          const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
          setZoom((current) => {
            const next = Math.max(0.25, Math.min(2.5, current - event.deltaY * 0.0015));
            const worldX = (pointer.x - pan.x) / current;
            const worldY = (pointer.y - pan.y) / current;
            onPan({ x: pointer.x - worldX * next, y: pointer.y - worldY * next });
            return next;
          });
          return;
        }
        onPan({ x: pan.x - event.deltaX, y: pan.y - event.deltaY });
      }}
      onPointerDown={(event) => {
        if (!isCanvasPanTarget(event.target)) return;
        if (event.button === 1 || space) {
          clearSelection();
          setPanning({ startX: event.clientX, startY: event.clientY, origX: pan.x, origY: pan.y });
          return;
        }
        if (event.button === 0) {
          setPendingConnect(null);
          if (!event.shiftKey) clearSelection();
          const world = clientToWorldXY(event.clientX, event.clientY, canvasRef.current, pan, zoom);
          selBoxRef.current = { x1: world.x, y1: world.y, x2: world.x, y2: world.y };
          setSelBoxDisplay(selBoxRef.current);
          setSelBoxing(true);
        }
      }}
      style={{ cursor: connecting ? "crosshair" : panning ? "grabbing" : space ? "grab" : "default" }}
    >
      <div className="canvas-grid" />
      <div className={`canvas-toolbar ${toolbarResize ? "is-resizing" : ""}`} style={{ width: Math.min(toolbarWidth, Math.max(TOOLBAR_MIN_WIDTH, viewport.width - 64)) }}>
        <span className="canvas-toolbar-label">{labels.addNode}</span>
        {creatableNodeTypes.map((type) => (
          <button
            key={type}
            className="canvas-tool"
            disabled={sourcePreserved}
            onClick={() => onAddNode(type, { x: Math.round((180 - pan.x) / zoom), y: Math.round((140 - pan.y) / zoom) })}
            title={labels.nodeTypes[type]}
          >
            <NodeIcon type={type} />
            <span>{typeColors[type].label}</span>
          </button>
        ))}
        <button
          className="canvas-tool"
          disabled={!selectedId || sourcePreserved}
          onClick={() => selectedId && onDuplicateNode(selectedId)}
          title="Ctrl+D"
        >
          dup
        </button>
        <button
          className="canvas-tool danger"
          disabled={selCount === 0 || sourcePreserved}
          onClick={() => {
            const ids = [...selectedIdsRef.current];
            onDeleteNodes(ids);
            clearSelection();
          }}
          title={labels.deleteSelected}
        >
          {selCount > 1 ? `${labels.deleteSelected} (${selCount})` : labels.deleteSelected}
        </button>
        <button className="canvas-tool" onClick={onLayoutNodes} title={labels.autoLayout}>
          {labels.autoLayout}
        </button>
        <button
          className="canvas-toolbar-resize"
          type="button"
          aria-label="resize node toolbar"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            setToolbarResize({ startX: event.clientX, startWidth: toolbarWidth });
          }}
        />
      </div>
      {sourcePreserved && (
        <div className="source-preserved-banner">
          <div>
            <strong>Imported source preserved</strong>
            <span>The canvas is a preview. Export uses the original .txt until you convert this scene to visual editing.</span>
          </div>
          <button className="ghost-btn" onClick={onConvertSource}>Convert to visual editing</button>
        </div>
      )}
      <div className="canvas-inner" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        <svg className="edges" width="3000" height="2000">
          <defs>
            {["flow", "choice", "goto", "if"].map((kind) => (
              <marker key={kind} id={`arrow-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={kind === "choice" ? "var(--c-choice)" : kind === "goto" ? "var(--c-goto)" : kind === "if" ? "var(--c-if)" : "var(--ink-mute)"} />
              </marker>
            ))}
          </defs>
          {data.edges.map((edge, index) => {
            const path = edgePath(data, edge.from, edge.to, density);
            if (!path) return null;
            const color = edge.kind === "choice" ? "var(--c-choice)" : edge.kind === "goto" ? "var(--c-goto)" : ["if", "elseif", "else"].includes(edge.kind) ? "var(--c-if)" : "var(--ink-mute)";
            const marker = edge.kind === "choice" ? "url(#arrow-choice)" : edge.kind === "goto" ? "url(#arrow-goto)" : ["if", "elseif", "else"].includes(edge.kind) ? "url(#arrow-if)" : "url(#arrow-flow)";
            return (
              <g key={`${edge.from}-${edge.to}-${index}`} className={`edge edge-${edge.kind}`}>
                <path d={path.d} stroke={color} strokeWidth="1.6" strokeDasharray={edge.kind === "goto" ? "5 4" : undefined} fill="none" markerEnd={marker} opacity="0.85" />
                {edge.label && (
                  <foreignObject x={(path.x1 + path.x2) / 2 - 50} y={(path.y1 + path.y2) / 2 - 12} width="100" height="22">
                    <div className="edge-label" style={{ borderColor: color, color }}>{edge.label}</div>
                  </foreignObject>
                )}
              </g>
            );
          })}
          {connecting && <path d={`M ${connecting.x1} ${connecting.y1} C ${(connecting.x1 + connecting.x2) / 2} ${connecting.y1}, ${(connecting.x1 + connecting.x2) / 2} ${connecting.y2}, ${connecting.x2} ${connecting.y2}`} className="edge-preview" />}
        </svg>

        {data.nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            density={density}
            labels={labels}
            selected={selectedIds.has(node.id)}
            hasError={errorNodeIds.has(node.id)}
            onSelect={(id, addToSet) => selectNode(id, addToSet)}
            onDragStart={(event, id) => {
              const current = data.nodes.find((n) => n.id === id);
              if (!current) return;
              let idsToMove: string[];
              if (selectedIdsRef.current.has(id)) {
                idsToMove = [...selectedIdsRef.current];
              } else {
                lastSetIdRef.current = id;
                setSelectedId(id);
                setSelectedIds(new Set([id]));
                idsToMove = [id];
              }
              const origPositions = idsToMove
                .map((nid) => data.nodes.find((n) => n.id === nid))
                .filter((n): n is typeof data.nodes[0] => Boolean(n))
                .map((n) => ({ id: n.id, x: n.x, y: n.y }));
              setDrag({ nodeId: id, startX: event.clientX, startY: event.clientY, origPositions });
            }}
            onConnectStart={(event, id) => {
              if (sourcePreserved) return;
              const current = data.nodes.find((n) => n.id === id);
              if (!current || ["ending", "finish", "goto", "goto_scene", "return", "restore_checkpoint"].includes(current.type)) return;
              event.stopPropagation();
              const start = { x2: current.x + current.w, y2: current.y + estimateNodeHeight(data, current.id, density) / 2 };
              setConnecting({ from: id, x1: start.x2, y1: start.y2, ...start });
            }}
            onConnectEnd={(id) => {
              if (sourcePreserved) return;
              if (!connecting) return;
              onConnectNodes(connecting.from, id);
              setConnecting(null);
            }}
          />
        ))}

        {selBoxDisplay && (
          <div
            className="sel-box"
            style={{
              left: Math.min(selBoxDisplay.x1, selBoxDisplay.x2),
              top: Math.min(selBoxDisplay.y1, selBoxDisplay.y2),
              width: Math.abs(selBoxDisplay.x2 - selBoxDisplay.x1),
              height: Math.abs(selBoxDisplay.y2 - selBoxDisplay.y1),
            }}
          />
        )}
      </div>

      <div className="zoom-controls">
        <button onClick={() => setZoom((current) => Math.max(0.25, current - 0.1))}>-</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((current) => Math.min(2.5, current + 0.1))}>+</button>
        <button onClick={() => fitGraphToViewport(data, density, viewport, setZoom, onPan)} className="zoom-reset">{labels.fitView}</button>
      </div>
      {selCount > 1 && (
        <div className="sel-count-badge">{selCount} selected</div>
      )}
      <Minimap data={data} labels={labels} pan={pan} zoom={zoom} viewport={viewport} onPan={onPan} />
      {pendingConnect && (
        <EdgeDropPicker
          screenX={pendingConnect.screenX}
          screenY={pendingConnect.screenY}
          labels={labels}
          onPick={(type) => {
            onAddAndConnectNode(pendingConnect.from, type, { x: Math.round(pendingConnect.worldX), y: Math.round(pendingConnect.worldY - 30) });
            setPendingConnect(null);
          }}
          onDismiss={() => setPendingConnect(null)}
        />
      )}
    </div>
  );
}

const QUICK_TYPES: NodeType[] = ["passage", "choice", "fake_choice", "if", "set", "goto", "goto_scene", "ending"];

function EdgeDropPicker({
  screenX, screenY, labels, onPick, onDismiss,
}: { screenX: number; screenY: number; labels: I18nLabels; onPick: (type: NodeType) => void; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onDismiss(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onDown); };
  }, [onDismiss]);

  const style: React.CSSProperties = {
    position: "fixed",
    left: screenX + 8,
    top: screenY - 12,
    zIndex: 120,
  };

  return (
    <div ref={ref} className="edrop-picker" style={style}>
      <div className="edrop-hint">connect to new node</div>
      <div className="edrop-grid">
        {QUICK_TYPES.map((type) => (
          <button
            key={type}
            className="edrop-btn"
            title={labels.nodeTypes[type]}
            onPointerDown={(e) => { e.stopPropagation(); onPick(type); }}
            style={{ "--dot": typeColors[type].dot, "--tint": typeColors[type].tint } as React.CSSProperties}
          >
            <NodeIcon type={type} />
            <span>{typeColors[type].label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function loadToolbarWidth(): number {
  const saved = Number(window.localStorage.getItem(TOOLBAR_WIDTH_KEY));
  return Number.isFinite(saved) && saved > 0 ? saved : TOOLBAR_DEFAULT_WIDTH;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function isCanvasPanTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !target.closest(".node, .canvas-toolbar, .zoom-controls, .minimap, button, input, textarea, select");
}

function clientToWorld(clientX: number, clientY: number, canvas: HTMLDivElement | null, pan: { x: number; y: number }, zoom: number) {
  const rect = canvas?.getBoundingClientRect();
  const canvasX = clientX - (rect?.left ?? 0);
  const canvasY = clientY - (rect?.top ?? 0);
  return { x2: (canvasX - pan.x) / zoom, y2: (canvasY - pan.y) / zoom };
}

function clientToWorldXY(clientX: number, clientY: number, canvas: HTMLDivElement | null, pan: { x: number; y: number }, zoom: number) {
  const rect = canvas?.getBoundingClientRect();
  return {
    x: (clientX - (rect?.left ?? 0) - pan.x) / zoom,
    y: (clientY - (rect?.top ?? 0) - pan.y) / zoom,
  };
}

function fitGraphToViewport(
  project: ChoiceForgeProject,
  density: Density,
  viewport: { width: number; height: number },
  setZoom: React.Dispatch<React.SetStateAction<number>>,
  onPan: (pan: { x: number; y: number }) => void,
) {
  if (!project.nodes.length) return;
  const padding = 90;
  const minX = Math.min(...project.nodes.map((node) => node.x));
  const minY = Math.min(...project.nodes.map((node) => node.y));
  const maxX = Math.max(...project.nodes.map((node) => node.x + node.w));
  const maxY = Math.max(...project.nodes.map((node) => node.y + estimateNodeHeight(project, node.id, density)));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const nextZoom = Math.max(0.25, Math.min(2.5, Math.min((viewport.width - padding * 2) / width, (viewport.height - padding * 2) / height)));
  setZoom(nextZoom);
  onPan({
    x: (viewport.width - width * nextZoom) / 2 - minX * nextZoom,
    y: (viewport.height - height * nextZoom) / 2 - minY * nextZoom,
  });
}

function estimateNodeHeight(project: ChoiceForgeProject, nodeId: string, density: Density) {
  const node = project.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || density === "minimal") return 44;
  let height = 50 + Math.max(0, Math.ceil(node.title.length / Math.max(12, node.w / 13)) - 1) * 14;
  if (node.body) height += density === "rich" ? 90 : 50;
  if (node.prompt) height += 28;
  if (node.options) height += node.options.length * (density === "rich" ? 38 : 26) + 8;
  if (node.branches) height += node.branches.reduce((total, branch) => total + 24 + (density === "rich" ? (branch.sets?.length ?? 0) * 22 : 0), 8);
  if (density === "rich" && node.sets?.length) height += 30;
  if (density === "rich" && node.target) height += 22;
  return height;
}

function edgePath(project: ChoiceForgeProject, from: string, to: string, density: Density) {
  const fromNode = project.nodes.find((node) => node.id === from);
  const toNode = project.nodes.find((node) => node.id === to);
  if (!fromNode || !toNode) return null;
  const x1 = fromNode.x + fromNode.w;
  const y1 = fromNode.y + estimateNodeHeight(project, from, density) / 2;
  const x2 = toNode.x;
  const y2 = toNode.y + estimateNodeHeight(project, to, density) / 2;
  if (x2 < x1) {
    const midY = Math.max(y1, y2) + 80;
    return { d: `M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x1 + 60} ${midY}, ${(x1 + x2) / 2} ${midY} S ${x2 - 60} ${y2}, ${x2} ${y2}`, x1, y1, x2, y2 };
  }
  const cx = (x1 + x2) / 2;
  return { d: `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`, x1, y1, x2, y2 };
}

function Minimap({
  data,
  labels,
  pan,
  zoom,
  viewport,
  onPan,
}: {
  data: ChoiceForgeProject;
  labels: I18nLabels;
  pan: { x: number; y: number };
  zoom: number;
  viewport: { width: number; height: number };
  onPan: (pan: { x: number; y: number }) => void;
}) {
  const visibleRect = {
    x: -pan.x / zoom,
    y: -pan.y / zoom,
    width: viewport.width / zoom,
    height: viewport.height / zoom,
  };
  const minX = Math.min(...data.nodes.map((node) => node.x), visibleRect.x) - 40;
  const minY = Math.min(...data.nodes.map((node) => node.y), visibleRect.y) - 40;
  const maxX = Math.max(...data.nodes.map((node) => node.x + node.w), visibleRect.x + visibleRect.width) + 40;
  const maxY = Math.max(...data.nodes.map((node) => node.y + 200), visibleRect.y + visibleRect.height) + 40;
  const viewBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

  const centerOnPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = viewBox.x + ((event.clientX - rect.left) / rect.width) * viewBox.width;
    const y = viewBox.y + ((event.clientY - rect.top) / rect.height) * viewBox.height;
    onPan({ x: viewport.width / 2 - x * zoom, y: viewport.height / 2 - y * zoom });
  };

  return (
    <div className="minimap">
      <div className="minimap-label">{labels.minimap}</div>
      <svg
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        width="180"
        height="120"
        onPointerDown={centerOnPointer}
      >
        {data.edges.map((edge, index) => {
          const from = data.nodes.find((node) => node.id === edge.from);
          const to = data.nodes.find((node) => node.id === edge.to);
          if (!from || !to) return null;
          return <line key={index} x1={from.x + from.w / 2} y1={from.y + 30} x2={to.x + to.w / 2} y2={to.y + 30} stroke="var(--ink-mute)" strokeWidth="2" opacity="0.4" />;
        })}
        {data.nodes.map((node) => {
          const color = typeColors[node.type];
          return <rect key={node.id} x={node.x} y={node.y} width={node.w} height="60" rx="8" fill={color.tint} stroke={color.dot} strokeWidth="2" />;
        })}
        <rect
          className="minimap-viewport"
          x={visibleRect.x}
          y={visibleRect.y}
          width={visibleRect.width}
          height={visibleRect.height}
          rx="10"
        />
      </svg>
    </div>
  );
}
