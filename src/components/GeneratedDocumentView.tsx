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
  isConverting?: boolean;
  conversionError?: string | null;
  onSave?: (content: string) => string | void;
  onPreviewSource?: () => Promise<void> | void;
  onConvertSource?: () => void;
  onClose?: () => void;
}

export function GeneratedDocumentView({ title, path, description, content, editable = false, targetLine = null, sourcePreserved = false, isConverting = false, conversionError, onSave, onPreviewSource, onConvertSource, onClose }: GeneratedDocumentViewProps) {
  const [draft, setDraft] = useState(content);
  const [saveStatus, setSaveStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [previewStatus, setPreviewStatus] = useState("");
  const visibleContent = editable ? draft : content;
  const lines = visibleContent.replace(/\n$/, "").split("\n");
  const dirty = draft !== content;

  useEffect(() => {
    setDraft(content);
    setSaveStatus("");
    setPreviewStatus("");
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
  const previewSource = async () => {
    if (dirty || isConverting) return;
    try {
      setPreviewStatus("Preparing graph preview…");
      await onPreviewSource?.();
      setPreviewStatus("Graph preview updated. Source text is still preserved for export.");
    } catch (error) {
      setPreviewStatus(error instanceof Error ? error.message : "Could not preview source.");
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

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  return (
    <section className="generated-doc">
      <div className="generated-doc-header">
        <div>
          <div className="generated-doc-kicker">{editable ? "editable file" : "generated file"}</div>
          <h1>{title}</h1>
          <p>{description}</p>
          {conversionError && <p role="alert">{conversionError}</p>}
          {editable && <span className={`generated-doc-dirty ${dirty ? "is-dirty" : ""}`}>{dirty ? "unsaved changes" : "no local changes"}</span>}
        </div>
        <div className="generated-doc-actions">
          <code>{path}</code>
          <button
            className="ghost-btn"
            onClick={() => {
              navigator.clipboard.writeText(visibleContent).then(() => {
                setCopyStatus("Copied!");
                setTimeout(() => setCopyStatus(""), 1800);
              });
            }}
          >
            {copyStatus || "Copy"}
          </button>
          {onClose && (
            <button className="ghost-btn" onClick={closeDocument}>
              Close
            </button>
          )}
          {sourcePreserved && onPreviewSource && (
            <button className="ghost-btn" disabled={dirty || isConverting} title={dirty ? "Save changes before previewing the graph." : "Build a graph preview while keeping this source text for export."} onClick={previewSource}>
              {isConverting ? "Preparing preview…" : dirty ? "Save before preview" : "Show graph preview"}
            </button>
          )}
          {sourcePreserved && onConvertSource && (
            <button className="ghost-btn" disabled={dirty || isConverting} title={dirty ? "Save changes before converting." : "Convert this imported source into visual graph editing."} onClick={onConvertSource}>
              {isConverting ? "Converting…" : dirty ? "Save before convert" : "Convert to visual editing"}
            </button>
          )}
          {editable && (
            <button className="ghost-btn" disabled={!dirty} onClick={saveDraft}>
              {dirty ? "Save to project" : "Saved"}
            </button>
          )}
        </div>
        {editable && saveStatus && <div className="generated-doc-status">{saveStatus}</div>}
        {previewStatus && <div className="generated-doc-status">{previewStatus}</div>}
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
