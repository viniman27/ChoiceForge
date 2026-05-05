import type { ChoiceForgeProject, I18nLabels, NodeType, StoryNode } from "../domain/types";

export function Dashboard({ data, labels, onClose }: { data: ChoiceForgeProject; labels: I18nLabels; onClose: () => void }) {
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
  const endingCount = data.nodes.filter((node) => node.type === "ending").length;
  const maxWords = Math.max(1, ...sceneRows.map((scene) => scene.words));
  const typeRows = summarizeNodeTypes(data.nodes);

  return (
    <div className="dashboard-overlay">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Estatisticas do projeto</h1>
          <div className="dash-subtitle">{data.title} - {data.scenes.length} cenas</div>
        </div>
        <button className="dash-close" onClick={onClose}>voltar ao editor</button>
      </div>
      <div className="dash-grid">
        <div className="kpi-card" data-accent="1"><span className="kpi-label">palavras totais</span><span className="kpi-value">{totalWords.toLocaleString()}</span></div>
        <div className="kpi-card" data-accent="2"><span className="kpi-label">{labels.nodes}</span><span className="kpi-value">{totalNodes}</span></div>
        <div className="kpi-card" data-accent="3"><span className="kpi-label">escolhas / opcoes</span><span className="kpi-value">{choiceCount}/{optionCount}</span></div>
        <div className="kpi-card" data-accent="4"><span className="kpi-label">finais nesta cena</span><span className="kpi-value">{endingCount}</span></div>

        <div className="dash-card wide">
          <div className="dash-card-head"><span className="dash-card-title">palavras por cena</span></div>
          {sceneRows.map((scene) => (
            <div className="bar-row" key={scene.id}>
              <span className="bar-name">{scene.name}.txt</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${(scene.words / maxWords) * 100}%`, background: scene.warning ? "var(--warn)" : "var(--accent-1)" }} /></span>
              <span className="bar-val">{scene.words.toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="dash-card">
          <div className="dash-card-head"><span className="dash-card-title">cena atual</span><span className="dash-card-meta">{data.sceneTitle}.txt</span></div>
          <div className="bar-row"><span className="bar-name">palavras</span><span className="bar-track"><span className="bar-fill" style={{ width: "100%", background: "var(--accent-2)" }} /></span><span className="bar-val">{currentSceneWords.toLocaleString()}</span></div>
          <div className="bar-row"><span className="bar-name">conexoes</span><span className="bar-track"><span className="bar-fill" style={{ width: "100%", background: "var(--c-goto)" }} /></span><span className="bar-val">{data.edges.length}</span></div>
          <div className="bar-row"><span className="bar-name">variaveis</span><span className="bar-track"><span className="bar-fill" style={{ width: "100%", background: "var(--c-set)" }} /></span><span className="bar-val">{data.variables.length}</span></div>
          <div className="bar-row"><span className="bar-name">conquistas</span><span className="bar-track"><span className="bar-fill" style={{ width: "100%", background: "var(--accent-3)" }} /></span><span className="bar-val">{data.achievements.length}</span></div>
        </div>

        <div className="dash-card">
          <div className="dash-card-head"><span className="dash-card-title">tipos de no</span><span className="dash-card-meta">{data.nodes.length} no canvas</span></div>
          {typeRows.map((row) => (
            <div className="bar-row" key={row.type}>
              <span className="bar-name">{labels.nodeTypes[row.type]}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${(row.count / data.nodes.length) * 100}%`, background: row.color }} /></span>
              <span className="bar-val">{row.count}</span>
            </div>
          ))}
        </div>
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
    if: "var(--c-if)",
    set: "var(--c-set)",
    label: "var(--c-label)",
    goto: "var(--c-goto)",
    goto_scene: "var(--c-goto)",
    gosub: "var(--c-gosub)",
    ending: "var(--c-ending)",
    checkpoint: "var(--c-check)",
  };
  const counts = nodes.reduce((map, node) => map.set(node.type, (map.get(node.type) ?? 0) + 1), new Map<NodeType, number>());
  return [...counts.entries()].map(([type, count]) => ({ type, count, color: colors[type] }));
}
