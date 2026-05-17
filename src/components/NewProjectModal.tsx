import { useState } from "react";
import type { I18nLabels } from "../domain/types";

interface NewProjectModalProps {
  labels: I18nLabels;
  onBlank: (title: string, author: string) => void;
  onExample: () => void;
  onClose: () => void;
}

export function NewProjectModal({ labels, onBlank, onExample, onClose }: NewProjectModalProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");

  const handleBlank = () => {
    onBlank(title, author);
  };

  const handleBackdrop = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="np-backdrop" onClick={handleBackdrop}>
      <div className="np-panel" role="dialog" aria-modal="true">
        <div className="np-head">
          <span className="np-title">{labels.newProject}</span>
          <button className="np-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="np-body">
          <label className="np-field">
            <span className="np-label">{labels.projectTitleLabel}</span>
            <input
              className="np-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Story"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleBlank(); }}
            />
          </label>
          <label className="np-field">
            <span className="np-label">{labels.projectAuthorLabel}</span>
            <input
              className="np-input"
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Anonymous"
              onKeyDown={(e) => { if (e.key === "Enter") handleBlank(); }}
            />
          </label>
        </div>
        <div className="np-actions">
          <button className="np-btn np-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="np-btn np-btn-secondary" onClick={onExample}>{labels.loadExample}</button>
          <button className="np-btn np-btn-primary" onClick={handleBlank}>{labels.startBlank}</button>
        </div>
      </div>
    </div>
  );
}
