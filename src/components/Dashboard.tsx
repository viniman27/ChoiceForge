import type { ChoiceForgeProject, I18nLabels } from "../domain/types";

export function Dashboard({ data, labels, onClose }: { data: ChoiceForgeProject; labels: I18nLabels; onClose: () => void }) {
  const totalWords = data.scenes.reduce((sum, scene) => sum + scene.words, 0);
  const totalNodes = data.scenes.reduce((sum, scene) => sum + scene.nodes, 0);
  const maxWords = Math.max(...data.scenes.map((scene) => scene.words));

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
        <div className="kpi-card" data-accent="3"><span className="kpi-label">variaveis</span><span className="kpi-value">{data.variables.length}</span></div>
        <div className="kpi-card" data-accent="4"><span className="kpi-label">conquistas</span><span className="kpi-value">{data.achievements.length}</span></div>

        <div className="dash-card wide">
          <div className="dash-card-head"><span className="dash-card-title">palavras por cena</span></div>
          {data.scenes.filter((scene) => !scene.special).map((scene) => (
            <div className="bar-row" key={scene.id}>
              <span className="bar-name">{scene.name}.txt</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${(scene.words / maxWords) * 100}%`, background: scene.warning ? "var(--warn)" : "var(--accent-1)" }} /></span>
              <span className="bar-val">{scene.words.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
