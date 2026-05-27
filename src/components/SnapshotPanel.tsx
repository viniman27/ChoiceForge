import { useEffect, useState } from "react";
import type { I18nLabels } from "../domain/types";
import type { SnapshotMeta } from "../state/projectStore";

interface SnapshotPanelProps {
  snapshots: SnapshotMeta[];
  labels: I18nLabels;
  onSave: (name: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function SnapshotPanel({ snapshots, labels, onSave, onRestore, onDelete, onClose }: SnapshotPanelProps) {
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
          <span className="snap-title">{labels.snapTitle}</span>
          <button className="snap-close" onClick={onClose} aria-label={labels.snapCancel}>✕</button>
        </div>
        <p className="snap-desc">{labels.snapDesc}</p>
        <div className="snap-save-row">
          <input
            className="snap-name-input"
            placeholder={labels.snapNamePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
            autoFocus
          />
          <button className="ghost-btn" onClick={commit}>{labels.snapSaveNow}</button>
        </div>
        <div className="snap-list">
          {snapshots.length === 0 ? (
            <div className="snap-empty">{labels.snapEmpty}</div>
          ) : (
            snapshots.map((snap) => (
              <div key={snap.id} className="snap-entry">
                <div className="snap-meta">
                  <span className="snap-name">{snap.name}</span>
                  <span className="snap-detail">
                    {formatDate(snap.createdAt)} · {snap.wordCount.toLocaleString()} {labels.words} · {snap.sceneCount} {labels.scenes.toLowerCase()}
                  </span>
                </div>
                <div className="snap-actions">
                  {confirmId === snap.id ? (
                    <>
                      <button className="ghost-btn snap-confirm-restore" onClick={() => { onRestore(snap.id); onClose(); }}>{labels.snapConfirmRestore}</button>
                      <button className="ghost-btn" onClick={() => setConfirmId(null)}>{labels.snapCancel}</button>
                    </>
                  ) : (
                    <>
                      <button className="ghost-btn" title={labels.snapRestore} onClick={() => setConfirmId(snap.id)}>{labels.snapRestore}</button>
                      <button className="mini-action danger" aria-label={`${labels.miniDel} ${snap.name}`} title={labels.miniDel} onClick={() => onDelete(snap.id)}>{labels.miniDel}</button>
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
