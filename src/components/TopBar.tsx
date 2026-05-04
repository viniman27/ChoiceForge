import type { ChoiceForgeProject, Density, EditorView, Language, Theme } from "../domain/types";

interface TopBarProps {
  data: ChoiceForgeProject;
  lang: Language;
  theme: Theme;
  density: Density;
  view: EditorView;
  onLangChange: (lang: Language) => void;
  onThemeChange: (theme: Theme) => void;
  onDensityChange: (density: Density) => void;
  onViewChange: (view: EditorView) => void;
  onExport: () => void;
  onResetProject: () => void;
}

export function TopBar({ data, lang, theme, density, view, onLangChange, onThemeChange, onDensityChange, onViewChange, onExport, onResetProject }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="brand">
        <div className="brand-mark">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 4 L11 2 L19 4 L19 14 L11 20 L3 14 Z" fill="var(--accent-1)" stroke="var(--ink)" strokeWidth="1.2" />
            <path d="M8 9 L11 7 L14 9 L14 13 L11 15 L8 13 Z" fill="var(--paper-1)" stroke="var(--ink)" strokeWidth="1" />
          </svg>
        </div>
        <div className="brand-text">
          <span className="brand-name">ChoiceForge</span>
          <span className="brand-project">{data.title} <span className="dim">/ {data.author}</span></span>
        </div>
      </div>

      <div className="bread">
        <div className="tab-toggle">
          <button className={view === "editor" ? "is-active" : ""} onClick={() => onViewChange("editor")}>editor</button>
          <button className={view === "dashboard" ? "is-active" : ""} onClick={() => onViewChange("dashboard")}>stats</button>
        </div>
        <code style={{ marginLeft: 12 }}>{data.sceneTitle}</code>
        <span className="dim">/</span>
        <code>{lang === "pt" ? "primeira_decisao" : "first_decision"}</code>
      </div>

      <div className="top-actions">
        <select className="ghost-btn" value={lang} onChange={(event) => onLangChange(event.target.value as Language)}>
          <option value="pt">PT-BR</option>
          <option value="en">EN</option>
        </select>
        <select className="ghost-btn" value={theme} onChange={(event) => onThemeChange(event.target.value as Theme)}>
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
        <select className="ghost-btn" value={density} onChange={(event) => onDensityChange(event.target.value as Density)}>
          <option value="minimal">minimal</option>
          <option value="medium">medium</option>
          <option value="rich">rich</option>
        </select>
        <button className="ghost-btn">Modo texto</button>
        <button className="ghost-btn" onClick={onResetProject}>Reset</button>
        <button className="ghost-btn" onClick={onExport}>Exportar</button>
        <button className="play-btn" onClick={() => window.alert("Play-test ainda sera integrado ao runtime oficial.")}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor"><path d="M2 1l8 4.5-8 4.5z" /></svg>
          Jogar
        </button>
      </div>
    </header>
  );
}
