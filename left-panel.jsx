// Left panel — scenes / variables / achievements / assets

function LeftPanel({ data, activeTab, setActiveTab, lang }) {
  const t = window.I18N[lang];
  const tabs = [
    { id: "scenes",       label: t.leftTabs[0] },
    { id: "variables",    label: t.leftTabs[1] },
    { id: "achievements", label: t.leftTabs[2] },
    { id: "assets",       label: t.leftTabs[3] },
  ];

  return (
    <aside className="left-panel">
      <div className="search-bar">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="6" cy="6" r="4"/><path d="M9 9l3 3"/>
        </svg>
        <input type="text" placeholder={t.search} />
        <kbd>⌘F</kbd>
      </div>

      <div className="left-tabs">
        {tabs.map((tab) => (
          <button key={tab.id}
            className={`left-tab ${activeTab === tab.id ? "is-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="left-content">
        {activeTab === "scenes" && <ScenesList data={data} t={t} />}
        {activeTab === "variables" && <VariablesList data={data} t={t} />}
        {activeTab === "achievements" && <AchievementsList data={data} t={t} />}
        {activeTab === "assets" && <AssetsList t={t} />}
      </div>
    </aside>
  );
}

function ScenesList({ data, t }) {
  return (
    <div className="scene-list">
      <div className="section-title">
        <span>scene_list</span>
        <button className="ghost-btn">+ {t.addScene}</button>
      </div>
      <ul>
        {data.scenes.map((s) => (
          <li key={s.id} className={`scene-item ${s.current ? "is-current" : ""} ${s.special ? "is-special" : ""}`}>
            <span className="scene-handle">⋮⋮</span>
            <div className="scene-meta">
              <div className="scene-name">
                <code>{s.name}.txt</code>
                {s.isStart && <span className="scene-tag">start</span>}
                {s.special && <span className="scene-tag">stats</span>}
                {s.warning && <span className="scene-tag warn">!</span>}
              </div>
              <div className="scene-stats">
                {s.words.toLocaleString()} {t.words} · {s.nodes} {t.nodes}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VariablesList({ data, t }) {
  return (
    <div className="vars-list">
      <div className="section-title">
        <span>*create</span>
        <button className="ghost-btn">+ {t.addVar}</button>
      </div>
      <table className="vars-table">
        <thead>
          <tr><th>{t.type}</th><th>name</th><th>{t.initial}</th><th>{t.used}</th></tr>
        </thead>
        <tbody>
          {data.variables.map((v) => (
            <tr key={v.name}>
              <td><span className={`type-pill type-${v.type}`}>{v.type[0]}</span></td>
              <td><code className="var-cell">{v.name}</code>
                  {v.fairmath && <span className="fm-tag">%</span>}</td>
              <td><code className="dim">{v.initial}</code></td>
              <td className="dim">{v.uses}×</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="var-detail">
        <div className="var-detail-name">
          <code>nervos</code> <span className="dim">number · fairmath</span>
        </div>
        <p className="var-detail-desc">Sangue-frio sob pressão (0–100). Usada como gate em saltos, diálogos tensos e Quick Test rotina K-3.</p>
        <div className="var-detail-uses">
          <span className="dim">{t.appliesTo}:</span>
          <span className="chip">intro_grid · 8</span>
          <span className="chip">midnight_market · 12</span>
          <span className="chip">the_burn · 3</span>
        </div>
      </div>
    </div>
  );
}

function AchievementsList({ data, t }) {
  return (
    <div className="ach-list">
      <div className="section-title">
        <span>*achievement</span>
        <button className="ghost-btn">+ {t.addAch}</button>
      </div>
      <ul>
        {data.achievements.map((a) => (
          <li key={a.id} className={`ach-item ${a.hidden ? "is-hidden" : ""}`}>
            <div className="ach-medal">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="11" fill="var(--c-set-tint)" stroke="var(--c-set)" strokeWidth="1.5"/>
                <text x="14" y="18" textAnchor="middle" fontSize="11" fontFamily="var(--ff-mono)" fill="var(--c-set)" fontWeight="600">{a.points}</text>
              </svg>
            </div>
            <div className="ach-meta">
              <div className="ach-title">{a.title} {a.hidden && <span className="ach-hidden">●</span>}</div>
              <div className="ach-desc">{a.desc}</div>
              <code className="ach-id">*achieve {a.id}</code>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssetsList({ t }) {
  const items = [
    { name: "logo_signal.png", w: "640×120" },
    { name: "rooftop_rain.jpg", w: "1280×720" },
    { name: "kana_portrait.png", w: "320×480" },
    { name: "deck_diagram.svg", w: "vector" },
  ];
  return (
    <div className="assets-list">
      <div className="section-title">
        <span>*image</span>
        <button className="ghost-btn">+ import</button>
      </div>
      <div className="assets-grid">
        {items.map((it) => (
          <div className="asset-card" key={it.name}>
            <div className="asset-thumb" style={{
              backgroundImage: "repeating-linear-gradient(45deg, var(--paper-2) 0 6px, var(--paper-3) 6px 12px)",
            }}>
              <span className="asset-thumb-label">img</span>
            </div>
            <div className="asset-name">{it.name}</div>
            <div className="asset-dim">{it.w}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.LeftPanel = LeftPanel;
