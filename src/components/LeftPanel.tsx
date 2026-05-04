import type { ChoiceForgeProject, I18nLabels } from "../domain/types";

interface LeftPanelProps {
  data: ChoiceForgeProject;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  labels: I18nLabels;
}

export function LeftPanel({ data, activeTab, setActiveTab, labels }: LeftPanelProps) {
  const tabs = [
    { id: "scenes", label: labels.leftTabs[0] },
    { id: "variables", label: labels.leftTabs[1] },
    { id: "achievements", label: labels.leftTabs[2] },
    { id: "assets", label: labels.leftTabs[3] },
  ];

  return (
    <aside className="left-panel">
      <div className="search-bar">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="6" cy="6" r="4" /><path d="M9 9l3 3" />
        </svg>
        <input type="text" placeholder={labels.search} />
        <kbd>Cmd F</kbd>
      </div>
      <div className="left-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} className={`left-tab ${activeTab === tab.id ? "is-active" : ""}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="left-content">
        {activeTab === "scenes" && <ScenesList data={data} labels={labels} />}
        {activeTab === "variables" && <VariablesList data={data} labels={labels} />}
        {activeTab === "achievements" && <AchievementsList data={data} labels={labels} />}
        {activeTab === "assets" && <AssetsList />}
      </div>
    </aside>
  );
}

function ScenesList({ data, labels }: { data: ChoiceForgeProject; labels: I18nLabels }) {
  return (
    <div className="scene-list">
      <div className="section-title"><span>scene_list</span><button className="ghost-btn">+ {labels.addScene}</button></div>
      <ul>
        {data.scenes.map((scene) => (
          <li key={scene.id} className={`scene-item ${scene.current ? "is-current" : ""} ${scene.special ? "is-special" : ""}`}>
            <span className="scene-handle">::</span>
            <div className="scene-meta">
              <div className="scene-name">
                <code>{scene.name}.txt</code>
                {scene.isStart && <span className="scene-tag">start</span>}
                {scene.special && <span className="scene-tag">stats</span>}
                {scene.warning && <span className="scene-tag warn">!</span>}
              </div>
              <div className="scene-stats">{scene.words.toLocaleString()} {labels.words} - {scene.nodes} {labels.nodes}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VariablesList({ data, labels }: { data: ChoiceForgeProject; labels: I18nLabels }) {
  return (
    <div className="vars-list">
      <div className="section-title"><span>*create</span><button className="ghost-btn">+ {labels.addVar}</button></div>
      <table className="vars-table">
        <thead><tr><th>tipo</th><th>name</th><th>inicial</th><th>usos</th></tr></thead>
        <tbody>
          {data.variables.map((variable) => (
            <tr key={variable.name}>
              <td><span className={`type-pill type-${variable.type}`}>{variable.type[0]}</span></td>
              <td><code className="var-cell">{variable.name}</code>{variable.fairmath && <span className="fm-tag">%</span>}</td>
              <td><code className="dim">{variable.initial}</code></td>
              <td className="dim">{variable.uses}x</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AchievementsList({ data, labels }: { data: ChoiceForgeProject; labels: I18nLabels }) {
  return (
    <div className="ach-list">
      <div className="section-title"><span>*achievement</span><button className="ghost-btn">+ {labels.addAch}</button></div>
      <ul>
        {data.achievements.map((achievement) => (
          <li key={achievement.id} className={`ach-item ${achievement.hidden ? "is-hidden" : ""}`}>
            <div className="ach-medal">{achievement.points}</div>
            <div className="ach-meta">
              <div className="ach-title">{achievement.title} {achievement.hidden && <span className="ach-hidden">*</span>}</div>
              <div className="ach-desc">{achievement.desc}</div>
              <code className="ach-id">*achieve {achievement.id}</code>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssetsList() {
  const assets = ["logo_signal.png", "rooftop_rain.jpg", "kana_portrait.png", "deck_diagram.svg"];
  return (
    <div className="assets-list">
      <div className="section-title"><span>*image</span><button className="ghost-btn">+ import</button></div>
      <div className="assets-grid">
        {assets.map((asset) => (
          <div className="asset-card" key={asset}>
            <div className="asset-thumb"><span className="asset-thumb-label">img</span></div>
            <div className="asset-name">{asset}</div>
            <div className="asset-dim">mock</div>
          </div>
        ))}
      </div>
    </div>
  );
}
