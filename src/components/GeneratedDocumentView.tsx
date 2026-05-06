interface GeneratedDocumentViewProps {
  title: string;
  path: string;
  description: string;
  content: string;
}

export function GeneratedDocumentView({ title, path, description, content }: GeneratedDocumentViewProps) {
  const lines = content.replace(/\n$/, "").split("\n");

  return (
    <section className="generated-doc">
      <div className="generated-doc-header">
        <div>
          <div className="generated-doc-kicker">generated file</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <code>{path}</code>
      </div>
      <div className="generated-doc-body">
        <div className="generated-doc-gutter">
          {lines.map((_, index) => <span key={index}>{index + 1}</span>)}
        </div>
        <pre><code>{lines.join("\n")}</code></pre>
      </div>
    </section>
  );
}
