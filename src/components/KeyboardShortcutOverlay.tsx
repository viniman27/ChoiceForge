import { useEffect } from "react";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; label: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: "Canvas",
    shortcuts: [
      { keys: ["drag"], label: "Pan canvas" },
      { keys: ["Space", "drag"], label: "Pan canvas (alt)" },
      { keys: ["Shift", "drag"], label: "Box select" },
      { keys: ["double-click"], label: "Create passage node" },
      { keys: ["Ctrl", "scroll"], label: "Zoom in/out" },
      { keys: ["F"], label: "Fit view" },
      { keys: ["Escape"], label: "Deselect / close" },
      { keys: ["drag", "→ empty"], label: "Create + connect node" },
    ],
  },
  {
    title: "Selection",
    shortcuts: [
      { keys: ["Click"], label: "Select node" },
      { keys: ["Ctrl", "A"], label: "Select all" },
      { keys: ["Delete"], label: "Delete selected" },
      { keys: ["Ctrl", "D"], label: "Duplicate selected" },
      { keys: ["Ctrl", "C"], label: "Copy selected" },
      { keys: ["Ctrl", "V"], label: "Paste" },
    ],
  },
  {
    title: "History",
    shortcuts: [
      { keys: ["Ctrl", "Z"], label: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], label: "Redo" },
    ],
  },
  {
    title: "File",
    shortcuts: [
      { keys: ["Ctrl", "S"], label: "Save / export" },
    ],
  },
  {
    title: "Search",
    shortcuts: [
      { keys: ["Ctrl", "Shift", "F"], label: "Focus search" },
      { keys: ["Ctrl", "H"], label: "Toggle find & replace" },
    ],
  },
  {
    title: "Help",
    shortcuts: [
      { keys: ["Ctrl", "K"], label: "Command palette" },
      { keys: ["?"], label: "Show this overlay" },
    ],
  },
];

interface KeyboardShortcutOverlayProps {
  onClose: () => void;
}

export function KeyboardShortcutOverlay({ onClose }: KeyboardShortcutOverlayProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="ks-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ks-panel">
        <div className="ks-head">
          <span className="ks-title">Keyboard shortcuts</span>
          <button className="ks-close" onClick={onClose}>✕</button>
        </div>
        <div className="ks-grid">
          {GROUPS.map((group) => (
            <div className="ks-group" key={group.title}>
              <div className="ks-group-title">{group.title}</div>
              {group.shortcuts.map((s) => (
                <div className="ks-row" key={s.label}>
                  <span className="ks-keys">
                    {s.keys.map((k, i) => (
                      <span key={i}>{i > 0 && <span className="ks-plus">+</span>}<kbd className="ks-key">{k}</kbd></span>
                    ))}
                  </span>
                  <span className="ks-label">{s.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
