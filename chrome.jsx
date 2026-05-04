// Top toolbar + bottom console + tweaks integration

function TopBar({ data, lang, setLang, onPlay, view, setView }) {
  const t = window.I18N[lang];
  const L = (pt, en) => lang === "pt" ? pt : en;
  return (
    <header className="top-bar">
      <div className="brand">
        <div className="brand-mark">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 4 L11 2 L19 4 L19 14 L11 20 L3 14 Z" fill="var(--accent-1)" stroke="var(--ink)" strokeWidth="1.2"/>
            <path d="M8 9 L11 7 L14 9 L14 13 L11 15 L8 13 Z" fill="var(--paper-1)" stroke="var(--ink)" strokeWidth="1"/>
          </svg>
        </div>
        <div className="brand-text">
          <span className="brand-name">ChoiceForge</span>
          <span className="brand-project">{data.title} <span className="dim">/ {data.author}</span></span>
        </div>
      </div>

      <div className="bread">
        <div className="tab-toggle">
          <button className={view === "editor" ? "is-active" : ""} onClick={() => setView("editor")}>{L("editor", "editor")}</button>
          <button className={view === "dashboard" ? "is-active" : ""} onClick={() => setView("dashboard")}>{L("estatísticas", "stats")}</button>
        </div>
        <code style={{ marginLeft: 12 }}>{data.sceneTitle}</code>
        <span className="dim">›</span>
        <code>{lang === "pt" ? "primeira_decisão" : "first_decision"}</code>
      </div>

      <div className="top-actions">
        <button className="cmd-btn">⌘K <span className="dim">{lang === "pt" ? "comandos" : "palette"}</span></button>
        <button className="ghost-btn">{t.textMode}</button>
        <button className="ghost-btn">{t.export}</button>
        <button className="play-btn" onClick={onPlay}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor"><path d="M2 1l8 4.5-8 4.5z"/></svg>
          {t.play}
        </button>
      </div>
    </header>
  );
}

function BottomBar({ data, lang }) {
  const t = window.I18N[lang];
  const errors = data.lints.filter(l => l.level === "error").length;
  const warnings = data.lints.filter(l => l.level === "warning").length;
  return (
    <footer className="bot-bar">
      <div className="bot-left">
        <details className="console" open>
          <summary>
            <span className="con-title">{t.consoleTitle}</span>
            {errors > 0 && <span className="bot-pill err">● {errors} {t.errors}</span>}
            {warnings > 0 && <span className="bot-pill warn">● {warnings} {t.warnings}</span>}
            <span className="bot-pill ok">✓ {t.linterPasses}</span>
          </summary>
          <ul className="con-list">
            {data.lints.map((l, i) => (
              <li key={i} className={`con-row con-${l.level}`}>
                <span className={`con-dot dot-${l.level}`}/>
                <span className="con-msg">{l.msg}</span>
                <span className="con-loc dim">
                  {l.scene && <code>{l.scene}</code>}
                  {l.line && <span> :{l.line}</span>}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </div>
      <div className="bot-right">
        <span className="dim">{t.encoding}</span>
        <span className="dim">·</span>
        <span className="dim">{t.indentRule}</span>
        <span className="dim">·</span>
        <span className="dim">⏵ {t.autosave} 14:38</span>
      </div>
    </footer>
  );
}

window.TopBar = TopBar;
window.BottomBar = BottomBar;
