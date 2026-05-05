import { useMemo, useState } from "react";
import type { AchievementSummary, ChoiceForgeProject, I18nLabels, SceneSummary, StoryNode, VariableSummary } from "../domain/types";

interface LeftPanelProps {
  data: ChoiceForgeProject;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  labels: I18nLabels;
  onAddScene: () => void;
  onSelectScene: (id: string) => void;
  onUpdateScene: (id: string, patch: Partial<SceneSummary>) => void;
  onDuplicateScene: (id: string) => void;
  onDeleteScene: (id: string) => void;
  onAddVariable: () => void;
  onUpdateVariable: (name: string, patch: Partial<VariableSummary>) => void;
  onAddAchievement: () => void;
  onUpdateAchievement: (id: string, patch: Partial<AchievementSummary>) => void;
  onDeleteAchievement: (id: string) => void;
  onSelectNode: (id: string) => void;
}

export function LeftPanel({
  data,
  activeTab,
  setActiveTab,
  labels,
  onAddScene,
  onSelectScene,
  onUpdateScene,
  onDuplicateScene,
  onDeleteScene,
  onAddVariable,
  onUpdateVariable,
  onAddAchievement,
  onUpdateAchievement,
  onDeleteAchievement,
  onSelectNode,
}: LeftPanelProps) {
  const [search, setSearch] = useState("");
  const searchResults = useMemo(() => searchProject(data, search), [data, search]);
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
        <input type="text" placeholder={labels.search} value={search} onChange={(event) => setSearch(event.target.value)} />
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
        {search.trim() ? (
          <SearchResults results={searchResults} onSelectNode={onSelectNode} />
        ) : activeTab === "scenes" && (
          <ScenesList
            data={data}
            labels={labels}
            onAddScene={onAddScene}
            onSelectScene={onSelectScene}
            onUpdateScene={onUpdateScene}
            onDuplicateScene={onDuplicateScene}
            onDeleteScene={onDeleteScene}
          />
        )}
        {!search.trim() && activeTab === "variables" && <VariablesList data={data} labels={labels} onAddVariable={onAddVariable} onUpdateVariable={onUpdateVariable} />}
        {!search.trim() && activeTab === "achievements" && (
          <AchievementsList
            data={data}
            labels={labels}
            onAddAchievement={onAddAchievement}
            onUpdateAchievement={onUpdateAchievement}
            onDeleteAchievement={onDeleteAchievement}
          />
        )}
        {!search.trim() && activeTab === "assets" && <AssetsList />}
      </div>
    </aside>
  );
}

interface SearchResult {
  id: string;
  kind: "node" | "scene" | "variable" | "achievement";
  title: string;
  detail: string;
  nodeId?: string;
}

function SearchResults({ results, onSelectNode }: { results: SearchResult[]; onSelectNode: (id: string) => void }) {
  return (
    <div className="search-results">
      <div className="section-title"><span>resultados</span><span>{results.length}</span></div>
      {results.length === 0 ? (
        <p className="empty-search">nenhum resultado</p>
      ) : (
        <ul>
          {results.map((result) => (
            <li key={result.id}>
              <button className={`search-result ${result.nodeId ? "is-clickable" : ""}`} onClick={() => result.nodeId && onSelectNode(result.nodeId)}>
                <span className={`result-kind result-${result.kind}`}>{result.kind}</span>
                <span className="result-main">
                  <span className="result-title">{result.title}</span>
                  <span className="result-detail">{result.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function searchProject(data: ChoiceForgeProject, query: string): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const results: SearchResult[] = [];
  data.scenes.forEach((scene) => {
    addResult(results, normalized, {
      id: `scene-${scene.id}`,
      kind: "scene",
      title: `${scene.name}.txt`,
      detail: `${scene.words.toLocaleString()} palavras - ${scene.nodes} nos`,
    });
  });
  data.variables.forEach((variable) => {
    addResult(results, normalized, {
      id: `var-${variable.name}`,
      kind: "variable",
      title: variable.name,
      detail: `${variable.type} = ${variable.initial} ${variable.desc}`,
    });
  });
  data.achievements.forEach((achievement) => {
    addResult(results, normalized, {
      id: `ach-${achievement.id}`,
      kind: "achievement",
      title: achievement.title,
      detail: `${achievement.id} ${achievement.desc} ${achievement.preDesc ?? ""} ${achievement.postDesc ?? ""}`,
    });
  });
  data.nodes.forEach((node) => {
    nodeSearchTargets(node).forEach((target, index) => {
      addResult(results, normalized, {
        id: `node-${node.id}-${index}`,
        kind: "node",
        title: `${node.id} - ${node.title}`,
        detail: target,
        nodeId: node.id,
      });
    });
  });

  return results.slice(0, 40);
}

function addResult(results: SearchResult[], query: string, result: SearchResult) {
  if (`${result.title} ${result.detail}`.toLowerCase().includes(query)) results.push(result);
}

function nodeSearchTargets(node: StoryNode): string[] {
  return [
    node.body ?? "",
    node.prompt ?? "",
    ...(node.options?.map((option) => `${option.text} ${option.cond?.expr ?? ""}`) ?? []),
    ...(node.branches?.map((branch) => `${branch.kind} ${branch.expr ?? ""}`) ?? []),
    ...(node.sets?.map((set) => `${set.var} ${set.op} ${set.val}`) ?? []),
    node.target ?? "",
  ].filter(Boolean);
}

function ScenesList({
  data,
  labels,
  onAddScene,
  onSelectScene,
  onUpdateScene,
  onDuplicateScene,
  onDeleteScene,
}: {
  data: ChoiceForgeProject;
  labels: I18nLabels;
  onAddScene: () => void;
  onSelectScene: (id: string) => void;
  onUpdateScene: (id: string, patch: Partial<SceneSummary>) => void;
  onDuplicateScene: (id: string) => void;
  onDeleteScene: (id: string) => void;
}) {
  return (
    <div className="scene-list">
      <div className="section-title"><span>scene_list</span><button className="ghost-btn" onClick={onAddScene}>+ {labels.addScene}</button></div>
      <ul>
        {data.scenes.map((scene) => (
          <li key={scene.id} className={`scene-item ${scene.current ? "is-current" : ""} ${scene.special ? "is-special" : ""}`} onClick={() => onSelectScene(scene.id)}>
            <span className="scene-handle">::</span>
            <div className="scene-meta">
              <div className="scene-name">
                {scene.isStart || scene.special ? (
                  <code>{scene.name}.txt</code>
                ) : (
                  <input className="scene-edit" value={scene.name} onClick={(event) => event.stopPropagation()} onChange={(event) => onUpdateScene(scene.id, { name: normalizeIdentifier(event.target.value) })} />
                )}
                {scene.isStart && <span className="scene-tag">start</span>}
                {scene.special && <span className="scene-tag">stats</span>}
                {scene.warning && <span className="scene-tag warn">!</span>}
              </div>
              <div className="scene-stats">
                {scene.words.toLocaleString()} {labels.words} - {scene.nodes} {labels.nodes}
                <span className="scene-actions">
                  <button className="mini-action" onClick={(event) => { event.stopPropagation(); onDuplicateScene(scene.id); }}>dup</button>
                  {!scene.isStart && !scene.special && <button className="mini-action danger" onClick={(event) => { event.stopPropagation(); onDeleteScene(scene.id); }}>del</button>}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VariablesList({
  data,
  labels,
  onAddVariable,
  onUpdateVariable,
}: {
  data: ChoiceForgeProject;
  labels: I18nLabels;
  onAddVariable: () => void;
  onUpdateVariable: (name: string, patch: Partial<VariableSummary>) => void;
}) {
  return (
    <div className="vars-list">
      <div className="section-title"><span>*create</span><button className="ghost-btn" onClick={onAddVariable}>+ {labels.addVar}</button></div>
      <table className="vars-table">
        <thead><tr><th>tipo</th><th>name</th><th>inicial</th><th>desc</th></tr></thead>
        <tbody>
          {data.variables.map((variable) => (
            <tr key={variable.name}>
              <td>
                <select value={variable.type} onChange={(event) => onUpdateVariable(variable.name, { type: event.target.value as VariableSummary["type"] })}>
                  <option value="number">num</option>
                  <option value="string">str</option>
                  <option value="boolean">bool</option>
                </select>
              </td>
              <td>
                <input className="var-edit" value={variable.name} onChange={(event) => onUpdateVariable(variable.name, { name: normalizeIdentifier(event.target.value) })} />
                {variable.fairmath && <span className="fm-tag">%</span>}
              </td>
              <td><input className="var-edit small" value={variable.initial} onChange={(event) => onUpdateVariable(variable.name, { initial: event.target.value })} /></td>
              <td><input className="var-edit desc" value={variable.desc} onChange={(event) => onUpdateVariable(variable.name, { desc: event.target.value })} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function normalizeIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^[^a-z_]+/, "")
    .replace(/_+/g, "_");
}

function AchievementsList({
  data,
  labels,
  onAddAchievement,
  onUpdateAchievement,
  onDeleteAchievement,
}: {
  data: ChoiceForgeProject;
  labels: I18nLabels;
  onAddAchievement: () => void;
  onUpdateAchievement: (id: string, patch: Partial<AchievementSummary>) => void;
  onDeleteAchievement: (id: string) => void;
}) {
  return (
    <div className="ach-list">
      <div className="section-title"><span>*achievement</span><button className="ghost-btn" onClick={onAddAchievement}>+ {labels.addAch}</button></div>
      <ul>
        {data.achievements.map((achievement) => (
          <li key={achievement.id} className={`ach-item ${achievement.hidden ? "is-hidden" : ""}`}>
            <input
              className="ach-medal ach-points"
              type="number"
              min="0"
              value={achievement.points}
              onChange={(event) => onUpdateAchievement(achievement.id, { points: Number(event.target.value) || 0 })}
              aria-label="achievement points"
            />
            <div className="ach-meta">
              <div className="ach-row">
                <input
                  className="ach-title-edit"
                  value={achievement.title}
                  onChange={(event) => onUpdateAchievement(achievement.id, { title: event.target.value })}
                  aria-label="achievement title"
                />
                <label className="ach-hidden-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(achievement.hidden)}
                    onChange={(event) => onUpdateAchievement(achievement.id, { hidden: event.target.checked })}
                  />
                  hidden
                </label>
                <button className="mini-action danger" onClick={() => onDeleteAchievement(achievement.id)}>del</button>
              </div>
              <div className="ach-code-row">
                <code>*achievement</code>
                <input
                  className="ach-id-edit"
                  value={achievement.id}
                  onChange={(event) => onUpdateAchievement(achievement.id, { id: normalizeIdentifier(event.target.value) })}
                  aria-label="achievement id"
                />
              </div>
              <input
                className="ach-desc-edit"
                value={achievement.preDesc ?? achievement.desc}
                onChange={(event) => onUpdateAchievement(achievement.id, { preDesc: event.target.value, desc: event.target.value })}
                aria-label="achievement pre description"
                placeholder="descricao antes de desbloquear"
              />
              <input
                className="ach-desc-edit"
                value={achievement.postDesc ?? achievement.desc}
                onChange={(event) => onUpdateAchievement(achievement.id, { postDesc: event.target.value })}
                aria-label="achievement post description"
                placeholder="descricao depois de desbloquear"
              />
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
