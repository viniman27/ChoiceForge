import { useEffect, useMemo, useRef, useState } from "react";
import { computeVariableUses, computeAchievementUses, computeVariableLocations, computeAchievementLocations } from "../domain/choicescript";
import type { VarLocation, AchievementLocation } from "../domain/choicescript";
import type { AchievementSummary, AssetSummary, ChoiceForgeProject, I18nLabels, SceneSummary, StoryNode, VariableSummary } from "../domain/types";

interface LeftPanelProps {
  data: ChoiceForgeProject;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeSceneId: string;
  labels: I18nLabels;
  onAddScene: () => void;
  onSelectScene: (id: string, targetLine?: number) => void;
  onUpdateScene: (id: string, patch: Partial<SceneSummary>) => void;
  onMoveScene: (id: string, direction: "up" | "down") => void;
  onMoveSceneBefore: (id: string, beforeId: string | null) => void;
  onDuplicateScene: (id: string) => void;
  onDeleteScene: (id: string) => void;
  onAddVariable: () => void;
  onUpdateVariable: (name: string, patch: Partial<VariableSummary>) => void;
  onDeleteVariable: (name: string) => void;
  onMoveVariable: (name: string, direction: "up" | "down") => void;
  onAddAchievement: () => void;
  onUpdateAchievement: (id: string, patch: Partial<AchievementSummary>) => void;
  onDeleteAchievement: (id: string) => void;
  onAddAsset: () => void;
  onUpdateAsset: (id: string, patch: Partial<AssetSummary>) => void;
  onDeleteAsset: (id: string) => void;
  onSelectNode: (id: string) => void;
  onNavigateToNode?: (sceneName: string, nodeId: string) => void;
  onReplace: (find: string, replace: string, scope: "scene" | "all") => number;
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
  onMoveScene,
  onMoveSceneBefore,
  onDuplicateScene,
  onDeleteScene,
  onAddVariable,
  onUpdateVariable,
  onDeleteVariable,
  onMoveVariable,
  onAddAchievement,
  onUpdateAchievement,
  onDeleteAchievement,
  onAddAsset,
  onUpdateAsset,
  onDeleteAsset,
  onSelectNode,
  onNavigateToNode,
  onReplace,
}: LeftPanelProps) {
  const [search, setSearch] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);
  const [replaceText, setReplaceText] = useState("");
  const [replaceStatus, setReplaceStatus] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const searchResults = useMemo(() => searchProject(data, search), [data, search]);
  const tabs = [
    { id: "scenes", label: labels.leftTabs[0] },
    { id: "variables", label: labels.leftTabs[1] },
    { id: "achievements", label: labels.leftTabs[2] },
    { id: "assets", label: labels.leftTabs[3] },
  ];

  useEffect(() => {
    if (!replaceStatus) return;
    const handle = window.setTimeout(() => setReplaceStatus(null), 3000);
    return () => window.clearTimeout(handle);
  }, [replaceStatus]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setReplaceMode(false);
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (!event.shiftKey && event.key.toLowerCase() === "h") {
        event.preventDefault();
        setReplaceMode(true);
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, []);

  return (
    <aside className="left-panel">
      <div className={`search-bar ${replaceMode ? "is-replace-mode" : ""}`}>
        <div className="search-row">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="6" cy="6" r="4" /><path d="M9 9l3 3" />
          </svg>
          <input ref={searchInputRef} type="text" placeholder={labels.search} value={search} onChange={(event) => setSearch(event.target.value)} />
          <button
            className={`search-toggle-replace ${replaceMode ? "is-active" : ""}`}
            title={replaceMode ? "close replace" : "find & replace (Ctrl H)"}
            onClick={() => {
              const next = !replaceMode;
              setReplaceMode(next);
              if (next) setTimeout(() => replaceInputRef.current?.focus(), 0);
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M2 3h8M2 6h6M2 9h4M9 7l2 2-2 2" />
            </svg>
          </button>
          {!replaceMode && <kbd>Ctrl Shift F</kbd>}
        </div>
        {replaceMode && (
          <div className="replace-row">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 4h10M2 8h6M10 7l2 2-2 2" />
            </svg>
            <input
              ref={replaceInputRef}
              type="text"
              placeholder={labels.replace}
              value={replaceText}
              onChange={(event) => setReplaceText(event.target.value)}
            />
            <div className="replace-actions">
              <button
                className="replace-btn"
                title="replace in current scene"
                disabled={!search.trim()}
                onClick={() => {
                  const count = onReplace(search, replaceText, "scene");
                  setReplaceStatus(count === 0 ? (labels.words === "words" ? "no matches" : labels.words === "palabras" ? "sin coincidencias" : "nenhuma ocorrência") : `${count} replaced in scene`);
                }}
              >
                scene
              </button>
              <button
                className="replace-btn"
                title="replace in all scenes"
                disabled={!search.trim()}
                onClick={() => {
                  const count = onReplace(search, replaceText, "all");
                  setReplaceStatus(count === 0 ? (labels.words === "words" ? "no matches" : labels.words === "palabras" ? "sin coincidencias" : "nenhuma ocorrência") : `${count} replaced in all`);
                }}
              >
                all
              </button>
            </div>
            {replaceStatus && <span className="replace-status">{replaceStatus}</span>}
          </div>
        )}
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
          <SearchResults
            results={searchResults}
            labels={labels}
            onOpenResult={(result) => {
              if (result.sceneId) onSelectScene(result.sceneId, result.line);
              if (result.nodeId) onSelectNode(result.nodeId);
              if (result.kind === "variable") setActiveTab("variables");
              if (result.kind === "achievement") setActiveTab("achievements");
              if (result.kind === "asset") setActiveTab("assets");
              if (result.kind === "scene") setActiveTab("scenes");
              setSearch("");
            }}
          />
        ) : activeTab === "scenes" && (
          <ScenesList
            data={data}
            labels={labels}
            activeSceneId={activeSceneId}
            onAddScene={onAddScene}
            onSelectScene={onSelectScene}
            onUpdateScene={onUpdateScene}
            onMoveScene={onMoveScene}
            onMoveSceneBefore={onMoveSceneBefore}
            onDuplicateScene={onDuplicateScene}
            onDeleteScene={onDeleteScene}
          />
        )}
        {!search.trim() && activeTab === "variables" && <VariablesList data={data} labels={labels} onAddVariable={onAddVariable} onUpdateVariable={onUpdateVariable} onDeleteVariable={onDeleteVariable} onMoveVariable={onMoveVariable} onNavigateToNode={onNavigateToNode} />}
        {!search.trim() && activeTab === "achievements" && (
          <AchievementsList
            data={data}
            labels={labels}
            onAddAchievement={onAddAchievement}
            onUpdateAchievement={onUpdateAchievement}
            onDeleteAchievement={onDeleteAchievement}
            onNavigateToNode={onNavigateToNode}
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
  searchText?: string;
  line?: number;
  nodeId?: string;
  sceneId?: string;
}

function SearchResults({ results, labels, onOpenResult }: { results: SearchResult[]; labels: I18nLabels; onOpenResult: (result: SearchResult) => void }) {
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
                className="search-result is-clickable"
                onClick={() => onOpenResult(result)}
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
    const sourceStatus = sceneSourceStatus(data, scene);
    const preservedText = scene.isStart ? data.startupSource : scene.special ? data.statsSource : data.sceneData?.[scene.name]?.sourceText;
    const line = preservedText ? lineForQuery(preservedText, normalized) : undefined;
    addResult(results, normalized, {
      id: `scene-${scene.id}`,
      kind: "scene",
      title: `${scene.name}.txt`,
      detail: `${scene.words.toLocaleString()} words - ${scene.nodes} nodes - ${sourceStatus}${line ? ` :${line}` : ""}`,
      searchText: preservedText,
      line,
      sceneId: scene.id,
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
  if (`${result.title} ${result.detail} ${result.searchText ?? ""}`.toLowerCase().includes(query)) results.push(result);
}

function lineForQuery(text: string, normalizedQuery: string): number | undefined {
  const index = text.toLowerCase().indexOf(normalizedQuery);
  if (index < 0) return undefined;
  return text.slice(0, index).split(/\r?\n/).length;
}

function nodeSearchTargets(node: StoryNode): string[] {
  return [
    node.body ?? "",
    node.prompt ?? "",
    ...(node.options?.map((option) => `${option.text} ${option.cond?.expr ?? ""} ${option.reuse ? `*${option.reuse}_reuse` : ""}`) ?? []),
    ...(node.fakeOptions?.map((option) => `${option.text} ${option.cond?.expr ?? ""} ${option.reuse ? `*${option.reuse}_reuse` : ""}`) ?? []),
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
  onMoveScene,
  onMoveSceneBefore,
  onDuplicateScene,
  onDeleteScene,
}: {
  data: ChoiceForgeProject;
  labels: I18nLabels;
  activeSceneId: string;
  onAddScene: () => void;
  onSelectScene: (id: string) => void;
  onUpdateScene: (id: string, patch: Partial<SceneSummary>) => void;
  onMoveScene: (id: string, direction: "up" | "down") => void;
  onMoveSceneBefore: (id: string, beforeId: string | null) => void;
  onDuplicateScene: (id: string) => void;
  onDeleteScene: (id: string) => void;
}) {
  const [draggedSceneId, setDraggedSceneId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const movableScenes = data.scenes.filter((scene) => !scene.isStart && !scene.special);
  const preservedScenes = data.scenes.filter((scene) => sceneHasPreservedSource(data, scene)).length;
  const sceneDoneCounts = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    const getNodes = (scene: (typeof data.scenes)[0]) => {
      if (scene.name === data.sceneTitle) return data.nodes;
      return data.sceneData?.[scene.name]?.nodes ?? [];
    };
    for (const scene of data.scenes) {
      const nodes = getNodes(scene);
      if (!nodes.length) continue;
      map.set(scene.name, { done: nodes.filter((n) => n.status === "done").length, total: nodes.length });
    }
    return map;
  }, [data.nodes, data.sceneData, data.sceneTitle, data.scenes]);
  const sceneErrors = useMemo(() => {
    const counts = new Map<string, { errors: number; warnings: number }>();
    data.lints.forEach((issue) => {
      if (!issue.scene) return;
      const current = counts.get(issue.scene) ?? { errors: 0, warnings: 0 };
      if (issue.level === "error") counts.set(issue.scene, { ...current, errors: current.errors + 1 });
      else if (issue.level === "warning") counts.set(issue.scene, { ...current, warnings: current.warnings + 1 });
    });
    return counts;
  }, [data.lints]);
  const generatedScenes = data.scenes.length - preservedScenes;
  return (
    <div className="scene-list">
      <div className="source-summary">
        <div>
          <span className="source-summary-label">source files</span>
          <strong>{preservedScenes} preserved</strong>
        </div>
        <div>
          <span className="source-summary-label">generated</span>
          <strong>{generatedScenes}</strong>
        </div>
      </div>
      <div className="section-title"><span>scene_list</span><button className="ghost-btn" onClick={onAddScene}>+ {labels.addScene}</button></div>
      <ul>
        {data.scenes.map((scene) => {
          const movable = !scene.isStart && !scene.special;
          const sourceStatus = sceneSourceStatus(data, scene);
          const counts = sceneErrors.get(scene.name);
          return (
          <li
            key={scene.id}
            className={`scene-item ${activeSceneId === scene.id ? "is-current" : ""} ${scene.special ? "is-special" : ""} ${dropTargetId === scene.id ? "is-drop-target" : ""} ${draggedSceneId === scene.id ? "is-dragging" : ""}`}
            draggable={movable}
            onClick={() => onSelectScene(scene.id)}
            onDragStart={(event) => {
              if (!movable) return;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", scene.id);
              setDraggedSceneId(scene.id);
            }}
            onDragOver={(event) => {
              if (!movable || !draggedSceneId || draggedSceneId === scene.id) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropTargetId(scene.id);
            }}
            onDragLeave={() => setDropTargetId((current) => (current === scene.id ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              const draggedId = event.dataTransfer.getData("text/plain") || draggedSceneId;
              if (movable && draggedId && draggedId !== scene.id) onMoveSceneBefore(draggedId, scene.id);
              setDraggedSceneId(null);
              setDropTargetId(null);
            }}
            onDragEnd={() => {
              setDraggedSceneId(null);
              setDropTargetId(null);
            }}
          >
            <span className="scene-handle">{movable ? "::" : "--"}</span>
            <div className="scene-meta">
              <div className="scene-name">
                {scene.isStart || scene.special ? (
                  <code>{scene.name}.txt</code>
                ) : (
                  <input className="scene-edit" value={scene.name} onClick={(event) => event.stopPropagation()} onChange={(event) => onUpdateScene(scene.id, { name: normalizeIdentifier(event.target.value) })} />
                )}
                {scene.isStart && <span className="scene-tag">start</span>}
                {scene.special && <span className="scene-tag">stats</span>}
                <span className={`scene-tag source-${sourceStatus}`}>{sourceStatus}</span>
                {scene.warning && <span className="scene-tag warn">!</span>}
                {counts?.errors ? <span className="scene-tag scene-err">{counts.errors}e</span> : null}
                {counts?.warnings ? <span className="scene-tag scene-warn">{counts.warnings}w</span> : null}
              </div>
              {(() => { const dc = sceneDoneCounts.get(scene.name); return dc && dc.done > 0 ? (
                <div className="scene-progress-track" title={`${dc.done}/${dc.total} nodes done`}>
                  <div className="scene-progress-fill" style={{ width: `${Math.round((dc.done / dc.total) * 100)}%` }} />
                </div>
              ) : null; })()}
              <input
                className="scene-notes"
                value={scene.notes ?? ""}
                placeholder="synopsis…"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onUpdateScene(scene.id, { notes: e.target.value || undefined })}
              />
              {!scene.isStart && !scene.special && (() => {
                const pct = scene.wordGoal ? Math.min(100, Math.round((scene.words / scene.wordGoal) * 100)) : null;
                return (
                  <div className="scene-goal-row" onClick={(e) => e.stopPropagation()}>
                    <input
                      className="scene-goal-input"
                      type="number"
                      min="0"
                      value={scene.wordGoal ?? ""}
                      placeholder="word goal…"
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        onUpdateScene(scene.id, { wordGoal: isNaN(n) || n <= 0 ? undefined : n });
                      }}
                    />
                    {pct !== null && (
                      <div className="scene-goal-track" title={`${scene.words.toLocaleString()} / ${scene.wordGoal!.toLocaleString()} words (${pct}%)`}>
                        <div className="scene-goal-fill" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--accent-2)" : "var(--accent-1)" }} />
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="scene-stats">
                {scene.words.toLocaleString()} {labels.words} - {scene.nodes} {labels.nodes}
                <span className="scene-actions">
                  {!scene.isStart && !scene.special && <button className="mini-action" disabled={movableScenes[0]?.id === scene.id} onClick={(event) => { event.stopPropagation(); onMoveScene(scene.id, "up"); }}>up</button>}
                  {!scene.isStart && !scene.special && <button className="mini-action" disabled={movableScenes.at(-1)?.id === scene.id} onClick={(event) => { event.stopPropagation(); onMoveScene(scene.id, "down"); }}>down</button>}
                  {!scene.isStart && !scene.special && <button className="mini-action" onClick={(event) => { event.stopPropagation(); onDuplicateScene(scene.id); }}>dup</button>}
                  {!scene.isStart && !scene.special && <button className="mini-action danger" onClick={(event) => { event.stopPropagation(); onDeleteScene(scene.id); }}>del</button>}
                </span>
              </div>
            </div>
          </li>
        );
        })}
        <li
          className={`scene-drop-end ${draggedSceneId ? "is-visible" : ""}`}
          onDragOver={(event) => {
            if (!draggedSceneId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setDropTargetId(null);
          }}
          onDrop={(event) => {
            event.preventDefault();
            const draggedId = event.dataTransfer.getData("text/plain") || draggedSceneId;
            if (draggedId) onMoveSceneBefore(draggedId, null);
            setDraggedSceneId(null);
            setDropTargetId(null);
          }}
        />
      </ul>
    </div>
  );
}

function VariablesList({
  data,
  labels,
  onAddVariable,
  onUpdateVariable,
  onDeleteVariable,
  onMoveVariable,
  onNavigateToNode,
}: {
  data: ChoiceForgeProject;
  labels: I18nLabels;
  onAddVariable: () => void;
  onUpdateVariable: (name: string, patch: Partial<VariableSummary>) => void;
  onDeleteVariable: (name: string) => void;
  onMoveVariable: (name: string, direction: "up" | "down") => void;
  onNavigateToNode?: (sceneName: string, nodeId: string) => void;
}) {
  const variableUses = useMemo(() => computeVariableUses(data), [data]);
  const variableLocations = useMemo(() => computeVariableLocations(data), [data]);
  const [expandedVar, setExpandedVar] = useState<string | null>(null);

  return (
    <div className="vars-list">
      <div className="section-title"><span>*create</span><button className="ghost-btn" onClick={onAddVariable}>+ {labels.addVar}</button></div>
      <table className="vars-table">
        <thead><tr><th></th><th>type</th><th>name</th><th>initial</th><th>stats</th><th>desc</th><th>uses</th><th></th></tr></thead>
        <tbody>
          {data.variables.map((variable, index) => {
            const uses = variableUses.get(variable.name) ?? 0;
            const locs = variableLocations.get(variable.name) ?? [];
            const isExpanded = expandedVar === variable.name;
            const isFirst = index === 0;
            const isLast = index === data.variables.length - 1;
            return (
              <>
                <tr key={variable.name}>
                  <td className="var-move-cell">
                    <button className="var-move-btn" disabled={isFirst} onClick={() => onMoveVariable(variable.name, "up")} title="Move up">↑</button>
                    <button className="var-move-btn" disabled={isLast} onClick={() => onMoveVariable(variable.name, "down")} title="Move down">↓</button>
                  </td>
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
                  <td>
                    <button
                      className={`var-uses-btn ${uses === 0 ? "is-zero" : ""} ${isExpanded ? "is-active" : ""}`}
                      title={uses > 0 ? "Show usage locations" : undefined}
                      onClick={() => uses > 0 && setExpandedVar(isExpanded ? null : variable.name)}
                    >{uses}</button>
                  </td>
                  <td><button className="mini-action danger" onClick={() => onDeleteVariable(variable.name)}>del</button></td>
                </tr>
                {isExpanded && locs.length > 0 && (
                  <tr key={`${variable.name}-locs`} className="var-locs-row">
                    <td colSpan={8}>
                      <VarLocationList locs={locs} onNavigate={onNavigateToNode} />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VarLocationList({ locs, onNavigate }: { locs: VarLocation[]; onNavigate?: (sceneName: string, nodeId: string) => void }) {
  const grouped = groupVarLocsByScene(locs);
  return (
    <div className="var-locs">
      {grouped.map(({ sceneName, items }) => (
        <div key={sceneName} className="var-locs-scene">
          <span className="var-locs-scene-name">{sceneName}.txt</span>
          {items.map((loc, i) => (
            <button
              key={i}
              className="var-loc-row"
              disabled={!onNavigate}
              onClick={() => onNavigate?.(loc.sceneName, loc.nodeId)}
            >
              <span className={`var-loc-kind var-loc-kind-${loc.kind}`}>{loc.kind}</span>
              <span className="var-loc-title">{loc.nodeTitle || loc.nodeId}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function groupVarLocsByScene(locs: VarLocation[]) {
  const order: string[] = [];
  const map = new Map<string, VarLocation[]>();
  for (const loc of locs) {
    if (!map.has(loc.sceneName)) { map.set(loc.sceneName, []); order.push(loc.sceneName); }
    map.get(loc.sceneName)!.push(loc);
  }
  return order.map((sceneName) => ({ sceneName, items: map.get(sceneName)! }));
}

function AchievementLocationList({ locs, onNavigate }: { locs: AchievementLocation[]; onNavigate?: (sceneName: string, nodeId: string) => void }) {
  const order: string[] = [];
  const map = new Map<string, AchievementLocation[]>();
  for (const loc of locs) {
    if (!map.has(loc.sceneName)) { map.set(loc.sceneName, []); order.push(loc.sceneName); }
    map.get(loc.sceneName)!.push(loc);
  }
  return (
    <div className="var-locs">
      {order.map((sceneName) => (
        <div key={sceneName} className="var-locs-scene">
          <span className="var-locs-scene-name">{sceneName}.txt</span>
          {map.get(sceneName)!.map((loc, i) => (
            <button
              key={i}
              className="var-loc-row"
              disabled={!onNavigate}
              onClick={() => onNavigate?.(loc.sceneName, loc.nodeId)}
            >
              <span className="var-loc-kind var-loc-kind-write">*achieve</span>
              <span className="var-loc-title">{loc.nodeTitle || loc.nodeId}</span>
            </button>
          ))}
        </div>
      ))}
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
  onNavigateToNode,
}: {
  data: ChoiceForgeProject;
  labels: I18nLabels;
  onAddAchievement: () => void;
  onUpdateAchievement: (id: string, patch: Partial<AchievementSummary>) => void;
  onDeleteAchievement: (id: string) => void;
  onNavigateToNode?: (sceneName: string, nodeId: string) => void;
}) {
  const achievementUses = useMemo(() => computeAchievementUses(data), [data]);
  const achievementLocations = useMemo(() => computeAchievementLocations(data), [data]);
  const [expandedAch, setExpandedAch] = useState<string | null>(null);

  return (
    <div className="ach-list">
      <div className="section-title"><span>*achievement</span><button className="ghost-btn" onClick={onAddAchievement}>+ {labels.addAch}</button></div>
      <ul>
        {data.achievements.map((achievement) => {
          const uses = achievementUses.get(achievement.id) ?? 0;
          const locs = achievementLocations.get(achievement.id) ?? [];
          const isExpanded = expandedAch === achievement.id;
          return (
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
              <div className="ach-footer-row">
                <code className="ach-id">*achieve {achievement.id}</code>
                <button
                  className={`var-uses-btn ${uses === 0 ? "is-zero" : ""} ${isExpanded ? "is-active" : ""}`}
                  title={uses > 0 ? "Show where this achievement is granted" : undefined}
                  onClick={() => uses > 0 && setExpandedAch(isExpanded ? null : achievement.id)}
                >{uses} use{uses !== 1 ? "s" : ""}</button>
              </div>
              {isExpanded && locs.length > 0 && (
                <AchievementLocationList locs={locs} onNavigate={onNavigateToNode} />
              )}
            </div>
          </li>
          );
        })}
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

function sceneHasPreservedSource(data: ChoiceForgeProject, scene: SceneSummary): boolean {
  if (scene.isStart) return data.startupSource !== undefined;
  if (scene.special) return data.statsSource !== undefined;
  return data.sceneData?.[scene.name]?.sourceText !== undefined;
}

function sceneSourceStatus(data: ChoiceForgeProject, scene: SceneSummary): "source" | "graph" | "generated" {
  if (sceneHasPreservedSource(data, scene)) return "source";
  if (scene.isStart || scene.special) return "generated";
  return "graph";
}
