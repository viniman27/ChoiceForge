import type { ChoiceForgeProject, I18nLabels } from "../domain/types";

export function BottomBar({ data, labels }: { data: ChoiceForgeProject; labels: I18nLabels }) {
  const errors = data.lints.filter((lint) => lint.level === "error").length;
  const warnings = data.lints.filter((lint) => lint.level === "warning").length;
  return (
    <footer className="bot-bar">
      <div className="bot-left">
        <details className="console" open>
          <summary>
            <span className="con-title">{labels.consoleTitle}</span>
            {errors > 0 && <span className="bot-pill err">{errors} {labels.errors}</span>}
            {warnings > 0 && <span className="bot-pill warn">{warnings} {labels.warnings}</span>}
            <span className="bot-pill ok">{labels.linterPasses}</span>
          </summary>
          <ul className="con-list">
            {data.lints.map((lint, index) => (
              <li key={index} className={`con-row con-${lint.level}`}>
                <span className={`con-dot dot-${lint.level}`} />
                <span className="con-msg">{lint.msg}</span>
                <span className="con-loc dim">{lint.scene && <code>{lint.scene}</code>}{lint.line && <span> :{lint.line}</span>}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
      <div className="bot-right">
        <span className="dim">{labels.encoding}</span><span className="dim">-</span><span className="dim">{labels.indentRule}</span><span className="dim">-</span><span className="dim">{labels.autosave}</span>
      </div>
    </footer>
  );
}
