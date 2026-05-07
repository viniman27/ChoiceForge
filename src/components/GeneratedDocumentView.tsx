import { useEffect, useState } from "react";

interface GeneratedDocumentViewProps {
  title: string;
  path: string;
  description: string;
  content: string;
  editable?: boolean;
  onSave?: (content: string) => void;
}

export function GeneratedDocumentView({ title, path, description, content, editable = false, onSave }: GeneratedDocumentViewProps) {
  const [draft, setDraft] = useState(content);
  const visibleContent = editable ? draft : content;
  const lines = visibleContent.replace(/\n$/, "").split("\n");

  useEffect(() => {
    setDraft(content);
  }, [content]);

  return (
    <section className="generated-doc">
      <div className="generated-doc-header">
        <div>
          <div className="generated-doc-kicker">generated file</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="generated-doc-actions">
          <code>{path}</code>
          {editable && (
            <button className="ghost-btn" disabled={draft === content} onClick={() => onSave?.(draft)}>
              Save to board
            </button>
          )}
        </div>
      </div>
      <div className="generated-doc-body">
        <div className="generated-doc-gutter">
          {lines.map((_, index) => <span key={index}>{index + 1}</span>)}
        </div>
        {editable ? (
          <textarea
            className="generated-doc-editor"
            value={draft}
            spellCheck={false}
            onChange={(event) => setDraft(event.target.value)}
          />
        ) : (
          <pre><code>{lines.join("\n")}</code></pre>
        )}
      </div>
    </section>
  );
}
