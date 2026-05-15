import { useEffect, useRef, useState } from "react";
import type { ChoiceForgeProject, I18nLabels, SceneSummary } from "../domain/types";

const CARD_W = 220;
const CARD_H = 96;
const GAP_X = 100;
const GAP_Y = 64;
const COLS = 4;

interface SceneMapViewProps {
  data: ChoiceForgeProject;
  labels: I18nLabels;
  activeSceneId: string;
  onSelectScene: (id: string) => void;
}

interface Connection {
  fromId: string;
  toId: string;
  kind: "goto" | "gosub";
}

export function SceneMapView({ data, labels, activeSceneId, onSelectScene }: SceneMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const ordered = [
    ...data.scenes.filter((s) => s.isStart),
    ...data.scenes.filter((s) => !s.isStart && !s.special),
    ...data.scenes.filter((s) => s.special),
  ];

  const positions = new Map<string, { x: number; y: number }>();
  ordered.forEach((scene, idx) => {
    positions.set(scene.id, {
      x: (idx % COLS) * (CARD_W + GAP_X),
      y: Math.floor(idx / COLS) * (CARD_H + GAP_Y),
    });
  });

  const totalW = Math.min(ordered.length, COLS) * (CARD_W + GAP_X) - GAP_X;
  const totalH = Math.ceil(ordered.length / COLS) * (CARD_H + GAP_Y) - GAP_Y;

  const seen = new Set<string>();
  const connections: Connection[] = [];
  ordered.forEach((scene) => {
    const nodes =
      scene.name === data.sceneTitle
        ? data.nodes
        : (data.sceneData?.[scene.name]?.nodes ?? []);
    nodes.forEach((node) => {
      if (node.type !== "goto_scene" && node.type !== "gosub_scene") return;
      if (!node.target) return;
      const target = data.scenes.find((s) => s.name === node.target);
      if (!target || target.id === scene.id) return;
      const key = `${scene.id}|${target.id}|${node.type}`;
      if (seen.has(key)) return;
      seen.add(key);
      connections.push({ fromId: scene.id, toId: target.id, kind: node.type === "gosub_scene" ? "gosub" : "goto" });
    });
  });

  const lintCounts = new Map<string, { errors: number; warnings: number }>();
  data.lints.forEach((lint) => {
    if (!lint.scene) return;
    const scene = data.scenes.find((s) => s.name === lint.scene);
    if (!scene) return;
    const prev = lintCounts.get(scene.id) ?? { errors: 0, warnings: 0 };
    if (lint.level === "error") lintCounts.set(scene.id, { ...prev, errors: prev.errors + 1 });
    else if (lint.level === "warning") lintCounts.set(scene.id, { ...prev, warnings: prev.warnings + 1 });
  });

  useEffect(() => {
    if (!panning) return;
    const move = (event: PointerEvent) => {
      setPan({ x: panning.origX + event.clientX - panning.startX, y: panning.origY + event.clientY - panning.startY });
    };
    const up = () => setPanning(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [panning]);

  return (
    <div
      ref={containerRef}
      className="scene-map-wrap"
      onWheel={(event) => {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          const rect = event.currentTarget.getBoundingClientRect();
          const px = event.clientX - rect.left;
          const py = event.clientY - rect.top;
          setZoom((current) => {
            const next = Math.max(0.25, Math.min(2, current - event.deltaY * 0.001));
            const wx = (px - pan.x) / current;
            const wy = (py - pan.y) / current;
            setPan({ x: px - wx * next, y: py - wy * next });
            return next;
          });
        } else {
          setPan((p) => ({ x: p.x - event.deltaX, y: p.y - event.deltaY }));
        }
      }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest(".map-card")) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setPanning({ startX: event.clientX, startY: event.clientY, origX: pan.x, origY: pan.y });
      }}
    >
      <div className="scene-map-legend">
        <svg width="24" height="10" viewBox="0 0 24 10">
          <path d="M 0 5 L 18 5" stroke="var(--c-goto)" strokeWidth="1.5" fill="none" markerEnd="url(#ml-goto)" />
          <marker id="ml-goto" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="var(--c-goto)" /></marker>
        </svg>
        <span>goto_scene</span>
        <svg width="24" height="10" viewBox="0 0 24 10">
          <path d="M 0 5 L 18 5" stroke="var(--c-gosub)" strokeWidth="1.5" strokeDasharray="4 3" fill="none" markerEnd="url(#ml-gosub)" />
          <marker id="ml-gosub" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="var(--c-gosub)" /></marker>
        </svg>
        <span>gosub_scene</span>
        <span className="map-legend-hint">{ordered.length} scenes · Ctrl+scroll to zoom · drag to pan</span>
      </div>
      <div
        className="scene-map-inner"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
      >
        <svg
          className="scene-map-svg"
          style={{ position: "absolute", top: 0, left: 0, width: totalW + 2, height: totalH + 2, overflow: "visible", pointerEvents: "none" }}
        >
          <defs>
            <marker id="sm-arrow-goto" markerWidth="7" markerHeight="6" refX="7" refY="3" orient="auto">
              <path d="M0 0L7 3L0 6z" fill="var(--c-goto)" />
            </marker>
            <marker id="sm-arrow-gosub" markerWidth="7" markerHeight="6" refX="7" refY="3" orient="auto">
              <path d="M0 0L7 3L0 6z" fill="var(--c-gosub)" />
            </marker>
          </defs>
          {connections.map((conn, idx) => {
            const from = positions.get(conn.fromId);
            const to = positions.get(conn.toId);
            if (!from || !to) return null;
            const x1 = from.x + CARD_W;
            const y1 = from.y + CARD_H / 2;
            const x2 = to.x;
            const y2 = to.y + CARD_H / 2;
            const bend = Math.max(50, Math.abs(x2 - x1) * 0.45);
            const color = conn.kind === "goto" ? "var(--c-goto)" : "var(--c-gosub)";
            const marker = conn.kind === "goto" ? "url(#sm-arrow-goto)" : "url(#sm-arrow-gosub)";
            const dash = conn.kind === "gosub" ? "5 4" : undefined;
            return (
              <path
                key={idx}
                d={`M ${x1} ${y1} C ${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`}
                stroke={color}
                strokeWidth="1.6"
                strokeDasharray={dash}
                fill="none"
                markerEnd={marker}
                opacity="0.75"
              />
            );
          })}
        </svg>
        {ordered.map((scene) => {
          const pos = positions.get(scene.id);
          if (!pos) return null;
          const counts = lintCounts.get(scene.id);
          const hasError = (counts?.errors ?? 0) > 0;
          const hasWarning = !hasError && (counts?.warnings ?? 0) > 0;
          const sourceStatus = sceneSourceStatus(data, scene);
          const isActive = activeSceneId === scene.id
            || (scene.isStart && activeSceneId === "startup")
            || (scene.special && activeSceneId === "stats");
          return (
            <button
              key={scene.id}
              className={`map-card${isActive ? " is-active" : ""}${hasError ? " has-error" : ""}${hasWarning ? " has-warning" : ""}${scene.isStart ? " is-start" : ""}${scene.special ? " is-special" : ""}`}
              style={{ left: pos.x, top: pos.y, width: CARD_W }}
              onClick={() => onSelectScene(scene.id)}
            >
              <div className="map-card-head">
                <span className="map-scene-name">{scene.name}.txt</span>
                {scene.isStart && <span className="scene-tag">start</span>}
                {scene.special && <span className="scene-tag">stats</span>}
              </div>
              <div className="map-card-meta">
                <span className={`scene-tag source-${sourceStatus}`}>{sourceStatus}</span>
                {hasError && <span className="scene-tag scene-err">{counts!.errors}e</span>}
                {hasWarning && <span className="scene-tag scene-warn">{counts!.warnings}w</span>}
              </div>
              {scene.notes && <div className="map-card-notes">{scene.notes}</div>}
              <div className="map-card-stats">
                <span>{scene.words.toLocaleString()} {labels.words}</span>
                <span className="map-dot">·</span>
                <span>{scene.nodes} {labels.nodes}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function sceneSourceStatus(data: ChoiceForgeProject, scene: SceneSummary): "source" | "graph" | "generated" {
  if (scene.isStart) return data.startupSource !== undefined ? "source" : "generated";
  if (scene.special) return data.statsSource !== undefined ? "source" : "generated";
  return data.sceneData?.[scene.name]?.sourceText !== undefined ? "source" : "graph";
}
