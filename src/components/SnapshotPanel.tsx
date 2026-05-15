import { useEffect, useState } from "react";
import type { SnapshotMeta } from "../state/projectStore";

interface SnapshotPanelProps {
  snapshots: SnapshotMeta[];
  onSave: (name: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function SnapshotPanel({ snapshots, onSave, onRestore, onDelete, onClose }: SnapshotPanelProps) {
  const [name, setName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const commit = () => {
    onSave(name);
    setName("");
  };

  return (
    <div className="snap-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="snap-panel">
        <div className="snap-head">
          <span className="snap-title">Project snapshots</span>
          <button className="snap-close" onClick={onClose}>✕</button>
        </div>
        <p className="snap-desc">Save named restore points. Up to 5 are kept; oldest is removed automatically. Restore re-opens as a new undo step.</p>
        <div className="snap-save-row">
          <input
            className="snap-name-input"
            placeholder="Snapshot name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
            autoFocus
          />
          <button className="ghost-btn" onClick={commit}>Save now</button>
        </div>
        <div className="snap-list">
          {snapshots.length === 0 ? (
            <div className="snap-empty">No snapshots saved yet.</div>
          ) : (
            snapshots.map((snap) => (
              <div key={snap.id} className="snap-entry">
                <div className="snap-meta">
                  <span className="snap-name">{snap.name}</span>
                  <span className="snap-detail">
                    {formatDate(snap.createdAt)} · {snap.wordCount.toLocaleString()} words · {snap.sceneCount} scene{snap.sceneCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="snap-actions">
                  {confirmId === snap.id ? (
                    <>
                      <button className="ghost-btn snap-confirm-restore" onClick={() => { onRestore(snap.id); onClose(); }}>Confirm restore</button>
                      <button className="ghost-btn" onClick={() => setConfirmId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="ghost-btn" title="Restore this snapshot" onClick={() => setConfirmId(snap.id)}>Restore</button>
                      <button className="mini-action danger" title="Delete this snapshot" onClick={() => onDelete(snap.id)}>del</button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
