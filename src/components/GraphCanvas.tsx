import { useEffect, useState } from "react";
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
  const [drag, setDrag] = useState<{ nodeId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [space, setSpace] = useState(false);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !event.repeat) setSpace(true);
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
  }, []);

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
      className="canvas-wrap"
      onWheel={(event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        setZoom((current) => Math.max(0.4, Math.min(1.6, current - event.deltaY * 0.0015)));
      }}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget && !(event.target as HTMLElement).classList.contains("canvas-grid")) return;
        setSelectedId(null);
        if (space || event.button === 1) setPanning({ startX: event.clientX, startY: event.clientY, origX: pan.x, origY: pan.y });
      }}
      style={{ cursor: space ? (panning ? "grabbing" : "grab") : "default" }}
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
            hasError={node.id === "n8"}
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
        <button onClick={() => setZoom((current) => Math.max(0.4, current - 0.1))}>-</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((current) => Math.min(1.6, current + 0.1))}>+</button>
        <button onClick={() => setZoom(1)} className="zoom-reset">home</button>
      </div>
      <Minimap data={data} />
    </div>
  );
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

function Minimap({ data }: { data: ChoiceForgeProject }) {
  const minX = Math.min(...data.nodes.map((node) => node.x)) - 40;
  const minY = Math.min(...data.nodes.map((node) => node.y)) - 40;
  const maxX = Math.max(...data.nodes.map((node) => node.x + node.w)) + 40;
  const maxY = Math.max(...data.nodes.map((node) => node.y + 200)) + 40;
  return (
    <div className="minimap">
      <div className="minimap-label">minimapa</div>
      <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} preserveAspectRatio="xMidYMid meet" width="180" height="120">
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
      </svg>
    </div>
  );
}
