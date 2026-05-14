import { useEffect, useState } from "react";
import { CodeEditor } from "./CodeEditor";

interface GeneratedDocumentViewProps {
  title: string;
  path: string;
  description: string;
  content: string;
  editable?: boolean;
  targetLine?: number | null;
  sourcePreserved?: boolean;
  onSave?: (content: string) => string | void;
  onConvertSource?: () => void;
  onClose?: () => void;
}

export function GeneratedDocumentView({ title, path, description, content, editable = false, targetLine = null, sourcePreserved = false, onSave, onConvertSource, onClose }: GeneratedDocumentViewProps) {
  const [draft, setDraft] = useState(content);
  const [saveStatus, setSaveStatus] = useState("");
  const visibleContent = editable ? draft : content;
  const lines = visibleContent.replace(/\n$/, "").split("\n");
  const dirty = draft !== content;

  useEffect(() => {
    setDraft(content);
    setSaveStatus("");
  }, [content]);

  const saveDraft = () => {
    if (!dirty) return;
    try {
      const message = onSave?.(draft);
      setSaveStatus(message || "Saved to project.");
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Could not save changes.");
    }
  };
  const closeDocument = () => {
    if (dirty && !window.confirm("Discard unsaved text changes?")) return;
    onClose?.();
  };

  useEffect(() => {
    if (!onClose) return;
    const keyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeDocument();
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [dirty, onClose]);

  return (
    <section className="generated-doc">
      <div className="generated-doc-header">
        <div>
          <div className="generated-doc-kicker">{editable ? "editable file" : "generated file"}</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="generated-doc-actions">
          <code>{path}</code>
          {onClose && (
            <button className="ghost-btn" onClick={closeDocument}>
              Close
            </button>
          )}
          {sourcePreserved && onConvertSource && (
            <button className="ghost-btn" disabled={dirty} title={dirty ? "Save changes before converting." : "Convert this imported source into visual graph editing."} onClick={onConvertSource}>
              Convert to visual editing
            </button>
          )}
          {editable && (
            <button className="ghost-btn" disabled={!dirty} onClick={saveDraft}>
              {dirty ? "Save to project" : "Saved"}
            </button>
          )}
        </div>
        {editable && saveStatus && <div className="generated-doc-status">{saveStatus}</div>}
      </div>
      <div className="generated-doc-body">
        <div className="generated-doc-gutter">
          {lines.map((_, index) => <span key={index}>{index + 1}</span>)}
        </div>
        {editable ? (
          <CodeEditor value={draft} targetLine={targetLine} onChange={setDraft} onSave={saveDraft} />
        ) : (
          <pre><code>{lines.join("\n")}</code></pre>
        )}
      </div>
    </section>
  );
}
