import { useState } from "react";
import { availableSamples } from "../data/sampleProject";
import type { I18nLabels, Language } from "../domain/types";

interface NewProjectModalProps {
  lang: Language;
  labels: I18nLabels;
  onBlank: (title: string, author: string) => void;
  onSample: (sampleId: string) => void;
  onClose: () => void;
}

export function NewProjectModal({ lang, labels, onBlank, onSample, onClose }: NewProjectModalProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");

  const handleBackdrop = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="np-backdrop" onClick={handleBackdrop}>
      <div className="np-panel np-panel-wide" role="dialog" aria-modal="true">
        <div className="np-head">
          <span className="np-title">{labels.newProject}</span>
          <button className="np-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="np-body">
          <div className="np-fields-row">
            <label className="np-field">
              <span className="np-label">{labels.projectTitleLabel}</span>
              <input
                className="np-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Story"
                autoFocus
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
              />
            </label>
          </div>
          <div className="np-section-label">{labels.newProjectStartFrom}</div>
          <div className="np-card-grid">
            <button
              className="np-card np-card-blank"
              onClick={() => onBlank(title, author)}
            >
              <span className="np-card-icon" aria-hidden="true">📄</span>
              <span className="np-card-title">{labels.startBlank}</span>
              <span className="np-card-desc">{labels.startBlankDesc}</span>
            </button>
            {availableSamples.map((sample) => (
              <button
                key={sample.id}
                className="np-card np-card-sample"
                onClick={() => onSample(sample.id)}
              >
                <span className="np-card-icon" aria-hidden="true">{sample.icon}</span>
                <span className="np-card-title">{sample.label[lang]}</span>
                <span className="np-card-desc">{sample.description[lang]}</span>
                <span className="np-card-meta">
                  {sample.projects[lang].scenes.filter((s) => !s.special && !s.isStart).length} {labels.newProjectScenesShort}
                  {" · "}
                  {sample.projects[lang].scenes.reduce((sum, s) => sum + s.words, 0).toLocaleString()} {labels.newProjectWordsShort}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
