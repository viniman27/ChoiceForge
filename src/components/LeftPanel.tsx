import { useMemo, useState } from "react";
import type { AchievementSummary, AssetSummary, ChoiceForgeProject, I18nLabels, SceneSummary, StoryNode, VariableSummary } from "../domain/types";

interface LeftPanelProps {
  data: ChoiceForgeProject;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeSceneId: string;
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
  onAddAsset: () => void;
  onUpdateAsset: (id: string, patch: Partial<AssetSummary>) => void;
  onDeleteAsset: (id: string) => void;
  onSelectNode: (id: string) => void;
}

export function LeftPanel({
  data,
  activeTab,
  setActiveTab,
  activeSceneId,
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
  onAddAsset,
  onUpdateAsset,
  onDeleteAsset,
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
          <SearchResults results={searchResults} labels={labels} onSelectNode={onSelectNode} onSelectScene={onSelectScene} />
        ) : activeTab === "scenes" && (
          <ScenesList
            data={data}
            labels={labels}
            activeSceneId={activeSceneId}
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
        {!search.trim() && activeTab === "assets" && <AssetsList data={data} labels={labels} onAddAsset={onAddAsset} onUpdateAsset={onUpdateAsset} onDeleteAsset={onDeleteAsset} />}
      </div>
    </aside>
  );
}

interface SearchResult {
  id: string;
  kind: "node" | "scene" | "variable" | "achievement" | "asset";
  title: string;
  detail: string;
  nodeId?: string;
  sceneId?: string;
}

function SearchResults({ results, labels, onSelectNode, onSelectScene }: { results: SearchResult[]; labels: I18nLabels; onSelectNode: (id: string) => void; onSelectScene: (id: string) => void }) {
  return (
    <div className="search-results">
      <div className="section-title"><span>{labels.words === "words" ? "results" : "resultados"}</span><span>{results.length}</span></div>
      {results.length === 0 ? (
        <p className="empty-search">{labels.words === "words" ? "no results" : "nenhum resultado"}</p>
      ) : (
        <ul>
          {results.map((result) => (
            <li key={result.id}>
              <button
                className={`search-result ${result.nodeId || result.sceneId ? "is-clickable" : ""}`}
                onClick={() => {
                  if (result.sceneId) onSelectScene(result.sceneId);
                  if (result.nodeId) onSelectNode(result.nodeId);
                }}
              >
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
      detail: `${scene.words.toLocaleString()} words - ${scene.nodes} nodes`,
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
  (data.assets ?? []).forEach((asset) => {
    addResult(results, normalized, {
      id: `asset-${asset.id}`,
      kind: "asset",
      title: asset.id,
      detail: `${asset.kind} ${asset.path} ${asset.desc}`,
    });
  });
  Object.entries(data.sceneData ?? { [data.sceneTitle]: { nodes: data.nodes, edges: data.edges } }).forEach(([sceneName, graph]) => {
    const scene = data.scenes.find((candidate) => candidate.name === sceneName);
    graph.nodes.forEach((node) => {
      nodeSearchTargets(node).forEach((target, index) => {
        addResult(results, normalized, {
          id: `node-${sceneName}-${node.id}-${index}`,
          kind: "node",
          title: `${sceneName}.txt / ${node.id} - ${node.title}`,
          detail: target,
          nodeId: node.id,
          sceneId: scene?.id,
        });
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
    ...(node.fakeOptions?.map((option) => `${option.text} ${option.cond?.expr ?? ""}`) ?? []),
    ...(node.branches?.map((branch) => `${branch.kind} ${branch.expr ?? ""}`) ?? []),
    ...(node.sets?.map((set) => `${set.var} ${set.op} ${set.val}`) ?? []),
    node.target ?? "",
  ].filter(Boolean);
}

function ScenesList({
  data,
  labels,
  activeSceneId,
  onAddScene,
  onSelectScene,
  onUpdateScene,
  onDuplicateScene,
  onDeleteScene,
}: {
  data: ChoiceForgeProject;
  labels: I18nLabels;
  activeSceneId: string;
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
          <li key={scene.id} className={`scene-item ${activeSceneId === scene.id ? "is-current" : ""} ${scene.special ? "is-special" : ""}`} onClick={() => onSelectScene(scene.id)}>
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
                  {!scene.isStart && !scene.special && <button className="mini-action" onClick={(event) => { event.stopPropagation(); onDuplicateScene(scene.id); }}>dup</button>}
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
        <thead><tr><th>type</th><th>name</th><th>initial</th><th>stats</th><th>desc</th></tr></thead>
        <tbody>
          {data.variables.map((variable) => (
            <tr key={variable.name}>
              <td>
                <select value={variable.type} onChange={(event) => onUpdateVariable(variable.name, { type: event.target.value as VariableSummary["type"], fairmath: event.target.value === "number" ? variable.fairmath : false })}>
                  <option value="number">num</option>
                  <option value="string">str</option>
                  <option value="boolean">bool</option>
                </select>
              </td>
              <td>
                <input className="var-edit" value={variable.name} onChange={(event) => onUpdateVariable(variable.name, { name: normalizeIdentifier(event.target.value) })} />
              </td>
              <td><input className="var-edit small" value={variable.initial} onChange={(event) => onUpdateVariable(variable.name, { initial: event.target.value })} /></td>
              <td>
                <label className={`stat-format-toggle ${variable.type !== "number" ? "is-disabled" : ""}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(variable.fairmath)}
                    disabled={variable.type !== "number"}
                    onChange={(event) => onUpdateVariable(variable.name, { fairmath: event.target.checked })}
                  />
                  <span>{variable.fairmath ? "percent" : "text"}</span>
                </label>
              </td>
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
                placeholder="description before unlock"
              />
              <input
                className="ach-desc-edit"
                value={achievement.postDesc ?? achievement.desc}
                onChange={(event) => onUpdateAchievement(achievement.id, { postDesc: event.target.value })}
                aria-label="achievement post description"
                placeholder="description after unlock"
              />
              <code className="ach-id">*achieve {achievement.id}</code>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssetsList({
  data,
  labels,
  onAddAsset,
  onUpdateAsset,
  onDeleteAsset,
}: {
  data: ChoiceForgeProject;
  labels: I18nLabels;
  onAddAsset: () => void;
  onUpdateAsset: (id: string, patch: Partial<AssetSummary>) => void;
  onDeleteAsset: (id: string) => void;
}) {
  const assets = data.assets ?? [];
  return (
    <div className="assets-list">
      <div className="section-title"><span>assets</span><button className="ghost-btn" onClick={onAddAsset}>+ asset</button></div>
      {assets.length === 0 ? (
        <p className="empty-search">{labels.words === "words" ? "no assets yet" : "nenhum asset cadastrado"}</p>
      ) : (
        <ul className="asset-list">
          {assets.map((asset) => (
            <li className={`asset-row asset-${asset.kind}`} key={asset.id}>
              <div className="asset-kind">{asset.kind}</div>
              <div className="asset-fields">
                <div className="asset-field-row">
                  <input className="asset-id-edit" value={asset.id} onChange={(event) => onUpdateAsset(asset.id, { id: normalizeIdentifier(event.target.value) })} aria-label="asset id" />
                  <select value={asset.kind} onChange={(event) => onUpdateAsset(asset.id, { kind: event.target.value as AssetSummary["kind"] })}>
                    <option value="image">image</option>
                    <option value="audio">audio</option>
                    <option value="data">data</option>
                    <option value="other">other</option>
                  </select>
                  <button className="mini-action danger" onClick={() => onDeleteAsset(asset.id)}>del</button>
                </div>
                <label className="asset-file-btn">
                  {labels.words === "words" ? "file" : "arquivo"}
                  <input
                    type="file"
                    onChange={(event) => {
                      importAssetFile(event.currentTarget.files?.[0], asset, onUpdateAsset);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <input className="asset-path-edit" value={asset.path} onChange={(event) => onUpdateAsset(asset.id, { path: event.target.value })} aria-label="asset path" />
                <input className="asset-desc-edit" value={asset.desc} onChange={(event) => onUpdateAsset(asset.id, { desc: event.target.value })} aria-label="asset description" placeholder={labels.words === "words" ? "usage or note" : "uso ou observacao"} />
                {asset.fileName && (
                  <div className="asset-file-meta">
                    <span>{asset.fileName}</span>
                    <span>{formatFileSize(asset.size ?? 0)}</span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function importAssetFile(file: File | undefined, asset: AssetSummary, onUpdateAsset: (id: string, patch: Partial<AssetSummary>) => void) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    onUpdateAsset(asset.id, {
      path: asset.path && asset.path !== "images/new_asset.png" ? asset.path : `${assetFolder(file)}/${file.name}`,
      kind: assetKindFromFile(file),
      desc: asset.desc || file.name,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      dataUrl: String(reader.result ?? ""),
    });
  });
  reader.readAsDataURL(file);
}

function assetKindFromFile(file: File): AssetSummary["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.includes("json") || file.type.includes("text")) return "data";
  return "other";
}

function assetFolder(file: File): string {
  const kind = assetKindFromFile(file);
  if (kind === "image") return "images";
  if (kind === "audio") return "audio";
  if (kind === "data") return "data";
  return "assets";
}

function formatFileSize(size: number): string {
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
