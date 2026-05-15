import { useEffect, useMemo, useRef, useState } from "react";
import type { ChoiceForgeProject, NodeType } from "../domain/types";

type PaletteKind = "scene" | "node" | "variable" | "achievement" | "command";

interface SceneItem { kind: "scene"; id: string; name: string; words: number; nodeCount: number; special?: boolean }
interface NodeItem { kind: "node"; id: string; sceneId: string; sceneName: string; type: NodeType; title: string }
interface VarItem { kind: "variable"; name: string; varType: string }
interface AchItem { kind: "achievement"; id: string; title: string; points: number }
interface CmdItem { kind: "command"; id: string; label: string; shortcut?: string; group: string }
type PaletteItem = SceneItem | NodeItem | VarItem | AchItem | CmdItem;

function score(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  const idx = t.indexOf(q);
  if (idx !== -1) return 60 - idx;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 20 : -1;
}

const KIND_LABEL: Record<PaletteKind, string> = {
  scene: "scene",
  node: "node",
  variable: "var",
  achievement: "ach",
  command: "cmd",
};

const STATIC_COMMANDS: CmdItem[] = [
  { kind: "command", id: "layout", label: "Auto-layout nodes", shortcut: "L", group: "Canvas" },
  { kind: "command", id: "fit", label: "Fit view", shortcut: "F", group: "Canvas" },
  { kind: "command", id: "dashboard", label: "Open dashboard / stats", group: "Views" },
  { kind: "command", id: "map", label: "Open scene map", group: "Views" },
  { kind: "command", id: "manuscript", label: "Open prose / manuscript view", group: "Views" },
  { kind: "command", id: "play", label: "Open playtest", group: "Views" },
  { kind: "command", id: "export", label: "Export project (.zip)", group: "File" },
  { kind: "command", id: "save", label: "Save now", shortcut: "Ctrl+S", group: "File" },
  { kind: "command", id: "undo", label: "Undo", shortcut: "Ctrl+Z", group: "History" },
  { kind: "command", id: "redo", label: "Redo", shortcut: "Ctrl+Shift+Z", group: "History" },
  { kind: "command", id: "shortcuts", label: "Show keyboard shortcuts", shortcut: "?", group: "Help" },
];

interface CommandPaletteProps {
  project: ChoiceForgeProject;
  onClose: () => void;
  onSelectScene: (id: string) => void;
  onSelectNode: (sceneId: string, nodeId: string) => void;
  onCommand: (id: string) => void;
}

export function CommandPalette({ project, onClose, onSelectScene, onSelectNode, onCommand }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const allItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];

    for (const scene of project.scenes) {
      items.push({ kind: "scene", id: scene.id, name: scene.name, words: scene.words, nodeCount: scene.nodes, special: scene.special });
    }

    const addNodesFromScene = (sceneName: string, nodes: typeof project.nodes) => {
      const sceneObj = project.scenes.find((s) => s.name === sceneName);
      if (!sceneObj) return;
      for (const node of nodes) {
        if (node.title) items.push({ kind: "node", id: node.id, sceneId: sceneObj.id, sceneName: sceneName, type: node.type, title: node.title });
      }
    };

    addNodesFromScene(project.sceneTitle, project.nodes);
    for (const [name, graph] of Object.entries(project.sceneData ?? {})) {
      if (name !== project.sceneTitle) addNodesFromScene(name, graph.nodes);
    }

    for (const v of project.variables) {
      items.push({ kind: "variable", name: v.name, varType: v.type });
    }
    for (const a of project.achievements) {
      items.push({ kind: "achievement", id: a.id, title: a.title, points: a.points });
    }
    for (const cmd of STATIC_COMMANDS) {
      items.push(cmd);
    }

    return items;
  }, [project]);

  const filtered = useMemo<PaletteItem[]>(() => {
    if (!query.trim()) return STATIC_COMMANDS.slice();
    const q = query.trim();
    return allItems
      .map((item) => {
        const text = item.kind === "scene" ? item.name
          : item.kind === "node" ? item.title
          : item.kind === "variable" ? item.name
          : item.kind === "achievement" ? `${item.id} ${item.title}`
          : item.label;
        return { item, s: score(text, q) };
      })
      .filter(({ s }) => s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map(({ item }) => item);
  }, [allItems, query]);

  useEffect(() => { setCursor(0); }, [filtered]);

  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const activate = (item: PaletteItem) => {
    if (item.kind === "scene") { onSelectScene(item.id); onClose(); }
    else if (item.kind === "node") { onSelectNode(item.sceneId, item.id); onClose(); }
    else if (item.kind === "variable" || item.kind === "achievement") { onClose(); }
    else { onCommand(item.id); onClose(); }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[cursor]) activate(filtered[cursor]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  return (
    <div className="cp-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cp-panel">
        <div className="cp-input-row">
          <svg className="cp-icon" width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"/><line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <input
            ref={inputRef}
            className="cp-input"
            placeholder="Search scenes, nodes, variables, commands…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
          />
          {query && <button className="cp-clear" onClick={() => setQuery("")}>✕</button>}
        </div>
        {filtered.length > 0 ? (
          <div ref={listRef} className="cp-list">
            {filtered.map((item, i) => (
              <button
                key={itemKey(item)}
                className={`cp-row${i === cursor ? " is-active" : ""}`}
                onMouseEnter={() => setCursor(i)}
                onMouseDown={(e) => { e.preventDefault(); activate(item); }}
              >
                <span className={`cp-badge cp-badge-${item.kind}`}>{KIND_LABEL[item.kind]}</span>
                <span className="cp-row-main">{itemLabel(item)}</span>
                <span className="cp-row-meta">{itemMeta(item)}</span>
                {"shortcut" in item && item.shortcut && <span className="cp-shortcut">{item.shortcut}</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className="cp-empty">No results for "{query}"</div>
        )}
        <div className="cp-footer">
          <span>↑↓ navigate</span><span>↵ open</span><span>Esc close</span>
        </div>
      </div>
    </div>
  );
}

function itemKey(item: PaletteItem): string {
  if (item.kind === "scene") return `scene:${item.id}`;
  if (item.kind === "node") return `node:${item.id}`;
  if (item.kind === "variable") return `var:${item.name}`;
  if (item.kind === "achievement") return `ach:${item.id}`;
  return `cmd:${item.id}`;
}

function itemLabel(item: PaletteItem): string {
  if (item.kind === "scene") return item.name + ".txt";
  if (item.kind === "node") return item.title;
  if (item.kind === "variable") return item.name;
  if (item.kind === "achievement") return item.id;
  return item.label;
}

function itemMeta(item: PaletteItem): string {
  if (item.kind === "scene") return `${item.words.toLocaleString()} words · ${item.nodeCount} nodes`;
  if (item.kind === "node") return `${item.type} · ${item.sceneName}`;
  if (item.kind === "variable") return item.varType;
  if (item.kind === "achievement") return `${item.points}pts · ${item.title}`;
  if (item.kind === "command") return item.group;
  return "";
}
