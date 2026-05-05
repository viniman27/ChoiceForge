import { useEffect, useRef, useState } from "react";
import type { ChoiceForgeProject, Density, I18nLabels, NodeType } from "../domain/types";
import { NodeCard, NodeIcon, typeColors } from "./NodeCard";

interface GraphCanvasProps {
  data: ChoiceForgeProject;
  density: Density;
  labels: I18nLabels;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onAddNode: (type: NodeType, position: { x: number; y: number }) => void;
  onDeleteNode: (id: string) => void;
  pan: { x: number; y: number };
  onPan: (pan: { x: number; y: number }) => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
}

const creatableNodeTypes: NodeType[] = ["passage", "choice", "if", "set", "label", "goto", "goto_scene", "gosub", "checkpoint", "ending"];

export function GraphCanvas({ data, density, labels, selectedId, setSelectedId, onMoveNode, onAddNode, onDeleteNode, pan, onPan, zoom, setZoom }: GraphCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{ nodeId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [viewport, setViewport] = useState({ width: 1000, height: 700 });
  const [space, setSpace] = useState(false);
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
      if (event.key === "Escape") setSelectedId(null);
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        onDeleteNode(selectedId);
        setSelectedId(null);
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
  }, [onDeleteNode, selectedId, setSelectedId]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (drag) {
        onMoveNode(drag.nodeId, drag.origX + (event.clientX - drag.startX) / zoom, drag.origY + (event.clientY - drag.startY) / zoom);
      }
      if (panning) {
        onPan({ x: panning.origX + event.clientX - panning.startX, y: panning.origY + event.clientY - panning.startY });
      }
    };
    const up = () => {
      setDrag(null);
      setPanning(null);
    };
    if (drag || panning) {
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, onMoveNode, onPan, panning, zoom]);

  return (
    <div
      ref={canvasRef}
      className="canvas-wrap"
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
        setSelectedId(null);
        if (event.button === 0 || event.button === 1 || space) {
          setPanning({ startX: event.clientX, startY: event.clientY, origX: pan.x, origY: pan.y });
        }
      }}
      style={{ cursor: panning ? "grabbing" : "grab" }}
    >
      <div className="canvas-grid" />
      <div className="canvas-toolbar">
        <span className="canvas-toolbar-label">novo no</span>
        {creatableNodeTypes.map((type) => (
          <button
            key={type}
            className="canvas-tool"
            onClick={() => onAddNode(type, { x: Math.round((180 - pan.x) / zoom), y: Math.round((140 - pan.y) / zoom) })}
            title={labels.nodeTypes[type]}
          >
            <NodeIcon type={type} />
            <span>{typeColors[type].label}</span>
          </button>
        ))}
        <button
          className="canvas-tool danger"
          disabled={!selectedId}
          onClick={() => selectedId && onDeleteNode(selectedId)}
          title="excluir no selecionado"
        >
          excluir
        </button>
      </div>
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
        </svg>

        {data.nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            density={density}
            selected={selectedId === node.id}
            hasError={errorNodeIds.has(node.id)}
            onSelect={setSelectedId}
            onDragStart={(event, id) => {
              const current = data.nodes.find((node) => node.id === id);
              if (current) setDrag({ nodeId: id, startX: event.clientX, startY: event.clientY, origX: current.x, origY: current.y });
            }}
          />
        ))}

        <div className="sticky-note" style={{ left: 460, top: 220 }}>
          <div className="sticky-pin" />
          <p>checar tom aqui - Kana precisa ter mais peso emocional</p>
          <div className="sticky-author">- Kira, 14:32</div>
        </div>
        <div className="region" style={{ left: 740, top: 30, width: 580, height: 420 }}>
          <div className="region-label">ramificacao tecnica</div>
        </div>
      </div>

      <div className="zoom-controls">
        <button onClick={() => setZoom((current) => Math.max(0.25, current - 0.1))}>-</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((current) => Math.min(2.5, current + 0.1))}>+</button>
        <button onClick={() => setZoom(1)} className="zoom-reset">home</button>
      </div>
      <Minimap data={data} pan={pan} zoom={zoom} viewport={viewport} onPan={onPan} />
    </div>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function isCanvasPanTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !target.closest(".node, .canvas-toolbar, .zoom-controls, .minimap, .sticky-note, .region, button, input, textarea, select");
}

function estimateNodeHeight(project: ChoiceForgeProject, nodeId: string, density: Density) {
  const node = project.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || density === "minimal") return 44;
  let height = 50;
  if (node.body) height += density === "rich" ? 90 : 50;
  if (node.prompt) height += 28;
  if (node.options) height += node.options.length * (density === "rich" ? 38 : 26) + 8;
  if (node.branches) height += node.branches.length * 24 + 8;
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
  pan,
  zoom,
  viewport,
  onPan,
}: {
  data: ChoiceForgeProject;
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
      <div className="minimap-label">minimapa</div>
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
