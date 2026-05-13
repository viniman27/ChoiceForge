import { useEffect, useState } from "react";
import { CodeEditor } from "./CodeEditor";

interface GeneratedDocumentViewProps {
  title: string;
  path: string;
  description: string;
  content: string;
  editable?: boolean;
  onSave?: (content: string) => string | void;
}

export function GeneratedDocumentView({ title, path, description, content, editable = false, onSave }: GeneratedDocumentViewProps) {
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
          <CodeEditor value={draft} onChange={setDraft} onSave={saveDraft} />
        ) : (
          <pre><code>{lines.join("\n")}</code></pre>
        )}
      </div>
    </section>
  );
}
