import { useState } from "react";
import { computeVariableUses, computeAchievementUses } from "../domain/choicescript";
import type { ChoiceForgeProject, I18nLabels, NodeType, StoryNode } from "../domain/types";

export function Dashboard({ data, labels, onClose, onUpdateWordGoal }: { data: ChoiceForgeProject; labels: I18nLabels; onClose: () => void; onUpdateWordGoal: (goal: number | undefined) => void }) {
  const currentSceneWords = countSceneWords(data.nodes);
  const sceneRows = data.scenes.filter((scene) => !scene.special).map((scene) => ({
    ...scene,
    words: scene.name === data.sceneTitle ? currentSceneWords : scene.words,
    nodes: scene.name === data.sceneTitle ? data.nodes.length : scene.nodes,
  }));
  const totalWords = sceneRows.reduce((sum, scene) => sum + scene.words, 0);
  const totalNodes = sceneRows.reduce((sum, scene) => sum + scene.nodes, 0);
  const choiceCount = data.nodes.filter((node) => node.type === "choice").length;
  const optionCount = data.nodes.reduce((sum, node) => sum + (node.options?.length ?? 0), 0);
  const endingCount = data.nodes.filter((node) => node.type === "ending" || node.type === "finish").length;
  const maxWords = Math.max(1, ...sceneRows.map((scene) => scene.words));
  const typeRows = summarizeNodeTypes(data.nodes);
  const variableUses = computeVariableUses(data);
  const unusedVariables = data.variables.filter((variable) => (variableUses.get(variable.name) ?? 0) === 0);
  const maxVarUses = Math.max(1, ...[...variableUses.values()]);
  const achievementUses = computeAchievementUses(data);
  const unusedAchievements = data.achievements.filter((a) => (achievementUses.get(a.id) ?? 0) === 0);
  const maxAchUses = Math.max(1, ...[...achievementUses.values()]);
  const [goalInput, setGoalInput] = useState(data.wordGoal !== undefined ? String(data.wordGoal) : "");
  const goalPct = data.wordGoal && data.wordGoal > 0 ? Math.min(100, Math.round((totalWords / data.wordGoal) * 100)) : null;

  return (
    <div className="dashboard-overlay">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Project stats</h1>
          <div className="dash-subtitle">{data.title} - {data.scenes.length} scenes</div>
        </div>
        <button className="dash-close" onClick={onClose}>back to editor</button>
      </div>
      <div className="dash-grid">
        <div className="kpi-card" data-accent="1"><span className="kpi-label">total words</span><span className="kpi-value">{totalWords.toLocaleString()}</span></div>
        <div className="kpi-card" data-accent="2"><span className="kpi-label">{labels.nodes}</span><span className="kpi-value">{totalNodes}</span></div>
        <div className="kpi-card" data-accent="3"><span className="kpi-label">choices / options</span><span className="kpi-value">{choiceCount}/{optionCount}</span></div>
        <div className="kpi-card" data-accent="4"><span className="kpi-label">endings in this scene</span><span className="kpi-value">{endingCount}</span></div>
        <div className="kpi-card" data-accent={unusedVariables.length > 0 ? "warn" : "ok"}><span className="kpi-label">unused variables</span><span className="kpi-value">{unusedVariables.length}</span></div>
        <div className="kpi-card" data-accent={unusedAchievements.length > 0 ? "warn" : "ok"}><span className="kpi-label">unused achievements</span><span className="kpi-value">{unusedAchievements.length}</span></div>

        <div className="dash-card wide word-goal-card">
          <div className="dash-card-head">
            <span className="dash-card-title">word count goal</span>
            {goalPct !== null && <span className="dash-card-meta">{goalPct}%</span>}
          </div>
          <div className="word-goal-row">
            <label className="word-goal-label">target</label>
            <input
              className="word-goal-input"
              type="number"
              min="0"
              placeholder="set a word goal…"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onBlur={() => {
                const n = parseInt(goalInput, 10);
                onUpdateWordGoal(isNaN(n) || n <= 0 ? undefined : n);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
            <span className="word-goal-current">{totalWords.toLocaleString()} written</span>
          </div>
          {goalPct !== null && (
            <div className="word-goal-track">
              <div
                className="word-goal-fill"
                style={{ width: `${goalPct}%`, background: goalPct >= 100 ? "var(--accent-2)" : "var(--accent-1)" }}
              />
            </div>
          )}
        </div>

        <div className="dash-card wide">
          <div className="dash-card-head"><span className="dash-card-title">words by scene</span></div>
          {sceneRows.map((scene) => (
            <div className="bar-row" key={scene.id}>
              <span className="bar-name">{scene.name}.txt</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${(scene.words / maxWords) * 100}%`, background: scene.warning ? "var(--warn)" : "var(--accent-1)" }} /></span>
              <span className="bar-val">{scene.words.toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="dash-card">
          <div className="dash-card-head"><span className="dash-card-title">current scene</span><span className="dash-card-meta">{data.sceneTitle}.txt</span></div>
          <div className="bar-row"><span className="bar-name">words</span><span className="bar-track"><span className="bar-fill" style={{ width: "100%", background: "var(--accent-2)" }} /></span><span className="bar-val">{currentSceneWords.toLocaleString()}</span></div>
          <div className="bar-row"><span className="bar-name">connections</span><span className="bar-track"><span className="bar-fill" style={{ width: "100%", background: "var(--c-goto)" }} /></span><span className="bar-val">{data.edges.length}</span></div>
          <div className="bar-row"><span className="bar-name">variables</span><span className="bar-track"><span className="bar-fill" style={{ width: "100%", background: "var(--c-set)" }} /></span><span className="bar-val">{data.variables.length}</span></div>
          <div className="bar-row"><span className="bar-name">achievements</span><span className="bar-track"><span className="bar-fill" style={{ width: "100%", background: "var(--accent-3)" }} /></span><span className="bar-val">{data.achievements.length}</span></div>
        </div>

        <div className="dash-card">
          <div className="dash-card-head"><span className="dash-card-title">node types</span><span className="dash-card-meta">{data.nodes.length} on canvas</span></div>
          {typeRows.map((row) => (
            <div className="bar-row" key={row.type}>
              <span className="bar-name">{labels.nodeTypes[row.type]}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${(row.count / data.nodes.length) * 100}%`, background: row.color }} /></span>
              <span className="bar-val">{row.count}</span>
            </div>
          ))}
        </div>

        {data.variables.length > 0 && (
          <div className="dash-card wide">
            <div className="dash-card-head">
              <span className="dash-card-title">variable usage</span>
              <span className="dash-card-meta">{data.variables.length} declared, {unusedVariables.length} unused</span>
            </div>
            {data.variables.map((variable) => {
              const uses = variableUses.get(variable.name) ?? 0;
              return (
                <div className="bar-row" key={variable.name}>
                  <span className="bar-name" title={`${variable.type} — ${variable.desc || variable.name}`}>{variable.name}</span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${(uses / maxVarUses) * 100}%`, background: uses === 0 ? "var(--warn)" : "var(--c-set)" }} />
                  </span>
                  <span className="bar-val" style={{ color: uses === 0 ? "var(--warn)" : undefined }}>{uses}</span>
                </div>
              );
            })}
          </div>
        )}

        {data.achievements.length > 0 && (
          <div className="dash-card wide">
            <div className="dash-card-head">
              <span className="dash-card-title">achievement usage</span>
              <span className="dash-card-meta">{data.achievements.length} declared, {unusedAchievements.length} unused</span>
            </div>
            {data.achievements.map((achievement) => {
              const uses = achievementUses.get(achievement.id) ?? 0;
              return (
                <div className="bar-row" key={achievement.id}>
                  <span className="bar-name" title={`${achievement.points}pts — ${achievement.title}`}>{achievement.id}</span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${(uses / maxAchUses) * 100}%`, background: uses === 0 ? "var(--warn)" : "var(--accent-3)" }} />
                  </span>
                  <span className="bar-val" style={{ color: uses === 0 ? "var(--warn)" : undefined }}>{uses}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function countSceneWords(nodes: StoryNode[]): number {
  return countWords(nodes.flatMap((node) => [
    node.title,
    node.body ?? "",
    node.prompt ?? "",
    ...(node.options?.map((option) => option.text) ?? []),
  ]).join(" "));
}

function countWords(text: string): number {
  return text
    .replace(/\$\{[^}]+\}/g, " ")
    .replace(/@\{[^}]+\}/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function summarizeNodeTypes(nodes: StoryNode[]) {
  const colors: Record<NodeType, string> = {
    passage: "var(--c-passage)",
    choice: "var(--c-choice)",
    fake_choice: "var(--c-choice)",
    if: "var(--c-if)",
    set: "var(--c-set)",
    label: "var(--c-label)",
    goto: "var(--c-goto)",
    goto_scene: "var(--c-goto)",
    gosub: "var(--c-gosub)",
    return: "var(--c-gosub)",
    ending: "var(--c-ending)",
    finish: "var(--c-ending)",
    checkpoint: "var(--c-check)",
    restore_checkpoint: "var(--c-check)",
    page_break: "var(--c-check)",
    comment: "var(--ink-mute)",
    input_text: "var(--c-set)",
    input_number: "var(--c-set)",
    rand: "var(--c-set)",
    gosub_scene: "var(--c-gosub)",
    image: "var(--c-passage)",
    temp: "var(--c-set)",
    params: "var(--c-set)",
  };
  const counts = nodes.reduce((map, node) => map.set(node.type, (map.get(node.type) ?? 0) + 1), new Map<NodeType, number>());
  return [...counts.entries()].map(([type, count]) => ({ type, count, color: colors[type] }));
}
