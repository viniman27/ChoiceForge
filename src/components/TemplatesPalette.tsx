import { useEffect, useMemo, useRef, useState } from "react";
import { NODE_TEMPLATES, type NodeTemplate } from "../data/templates";
import type { I18nLabels, Language } from "../domain/types";

interface TemplatesPaletteProps {
  lang: Language;
  labels: I18nLabels;
  onPick: (template: NodeTemplate) => void;
  onClose: () => void;
}

function score(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (t.startsWith(q)) return 100;
  if (t.includes(q)) return 60;
  // Loose substring scan — every char of query must appear in order
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length ? 30 : -1;
}

export function TemplatesPalette({ lang, labels, onPick, onClose }: TemplatesPaletteProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return NODE_TEMPLATES;
    return NODE_TEMPLATES
      .map((t) => {
        const text = `${t.label[lang]} ${t.searchTags} ${t.category} ${t.description[lang]}`;
        return { t, s: score(text, query) };
      })
      .filter(({ s }) => s >= 0)
      .sort((a, b) => b.s - a.s)
      .map(({ t }) => t);
  }, [query, lang]);

  useEffect(() => { setCursor(0); }, [filtered]);

  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const activate = (template: NodeTemplate) => {
    onPick(template);
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[cursor]) activate(filtered[cursor]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  return (
    <div className="cp-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cp-panel tp-panel">
        <div className="cp-input-row">
          <svg className="cp-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 2h4l4 4v6H3z M7 2v4h4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            ref={inputRef}
            className="cp-input"
            placeholder={labels.templatesPalettePlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
          />
          <span className="cp-hint">↑↓ · Enter · Esc</span>
        </div>
        {filtered.length === 0 ? (
          <div className="cp-empty">{labels.templatesPaletteEmpty}</div>
        ) : (
          <ul className="cp-list tp-list" ref={listRef}>
            {filtered.map((template, idx) => (
              <li
                key={template.id}
                className={`cp-item tp-item ${cursor === idx ? "is-cursor" : ""}`}
                onMouseEnter={() => setCursor(idx)}
                onMouseDown={(e) => { e.preventDefault(); activate(template); }}
              >
                <div className="tp-item-head">
                  <span className={`tp-item-cat tp-cat-${template.category}`}>{template.category}</span>
                  <span className="tp-item-label">{template.label[lang]}</span>
                  <span className="tp-item-count">{template.nodes.length} {labels.templatesPaletteNodes}</span>
                </div>
                <div className="tp-item-desc">{template.description[lang]}</div>
              </li>
            ))}
          </ul>
        )}
        <div className="tp-footer">{labels.templatesPaletteFooter}</div>
      </div>
    </div>
  );
}
