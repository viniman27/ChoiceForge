import { useState } from "react";
import { translateLintMsg } from "../data/lintMessages";
import type { ChoiceForgeProject, I18nLabels, Language, LintIssue } from "../domain/types";

export function BottomBar({
  data,
  labels,
  lang,
  open,
  onOpenChange,
  onSelectIssue,
}: {
  data: ChoiceForgeProject;
  labels: I18nLabels;
  lang: Language;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectIssue: (lint: LintIssue) => void;
}) {
  const [filterScene, setFilterScene] = useState("");
  const [filterLevel, setFilterLevel] = useState<"" | "error" | "warning">("");

  const errors = data.lints.filter((lint) => lint.level === "error").length;
  const warnings = data.lints.filter((lint) => lint.level === "warning").length;

  const sceneNames = [...new Set(data.lints.map((l) => l.scene).filter(Boolean))] as string[];

  const sorted = [...data.lints].sort((a, b) => lintSeverityRank(a.level) - lintSeverityRank(b.level));
  const visibleLints = sorted.filter((lint) => {
    if (filterLevel && lint.level !== filterLevel) return false;
    if (filterScene && lint.scene !== filterScene) return false;
    return true;
  });

  const isFiltered = Boolean(filterScene || filterLevel);

  return (
    <footer className="bot-bar">
      <div className="bot-left">
        <details className="console" open={open} onToggle={(event) => onOpenChange(event.currentTarget.open)}>
          <summary>
            <span className="con-title">{labels.consoleTitle}</span>
            {errors > 0 && <span className="bot-pill err">{errors} {labels.errors}</span>}
            {warnings > 0 && <span className="bot-pill warn">{warnings} {labels.warnings}</span>}
            {errors === 0 && warnings === 0 && <span className="bot-pill ok">{labels.linterPasses}</span>}
          </summary>
          {(data.lints.length > 0) && (
            <div className="con-filters">
              <select
                className="con-filter-select"
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value as "" | "error" | "warning")}
              >
                <option value="">{labels.lintAllLevels}</option>
                <option value="error">{labels.lintErrorsOnly}</option>
                <option value="warning">{labels.lintWarningsOnly}</option>
              </select>
              {sceneNames.length > 1 && (
                <select
                  className="con-filter-select"
                  value={filterScene}
                  onChange={(e) => setFilterScene(e.target.value)}
                >
                  <option value="">{labels.lintAllScenes}</option>
                  {sceneNames.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {isFiltered && (
                <button
                  className="con-filter-clear"
                  onClick={() => { setFilterScene(""); setFilterLevel(""); }}
                  title={labels.bottomClearFilters}
                  aria-label={labels.bottomClearFilters}
                >×</button>
              )}
              {isFiltered && (
                <span className="con-filter-count">{visibleLints.length} shown</span>
              )}
            </div>
          )}
          <ul className="con-list">
            {visibleLints.map((lint, index) => (
              <li
                key={index}
                className={`con-row con-${lint.level} ${isNavigableIssue(lint) ? "is-clickable" : ""}`}
                onClick={() => isNavigableIssue(lint) && onSelectIssue(lint)}
              >
                <span className={`con-dot dot-${lint.level}`} />
                <span className="con-level">{lint.level}</span>
                <span className="con-msg">{translateLintMsg(lint.key, lint.params, lint.msg, lang)}</span>
                <span className="con-loc dim">{lint.scene && <code>{lint.scene}</code>}{lint.node && <code>{lint.node}</code>}{lint.line && <span> :{lint.line}</span>}</span>
              </li>
            ))}
            {visibleLints.length === 0 && isFiltered && (
              <li className="con-row con-empty">{labels.lintNoMatch}</li>
            )}
          </ul>
        </details>
      </div>
      <div className="bot-right">
        <span className="dim">{labels.encoding}</span><span className="dim">-</span><span className="dim">{labels.indentRule}</span><span className="dim">-</span><span className="dim">{labels.autosave}</span>
      </div>
    </footer>
  );
}

function isNavigableIssue(lint: LintIssue): boolean {
  return Boolean(lint.node || lint.scene || lint.line || /scene|variable|achievement|asset/i.test(lint.msg));
}

function lintSeverityRank(level: LintIssue["level"]): number {
  if (level === "error") return 0;
  if (level === "warning") return 1;
  return 2;
}
