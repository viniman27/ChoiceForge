// Stats dashboard

function Dashboard({ data, lang, onClose }) {
  const t = window.I18N[lang];
  const L = (pt, en) => lang === "pt" ? pt : en;

  const totalWords = data.scenes.reduce((s, sc) => s + sc.words, 0);
  const totalNodes = data.scenes.reduce((s, sc) => s + sc.nodes, 0);
  const totalChoices = 38;
  const totalEndings = 7;

  // word distribution by scene
  const maxWords = Math.max(...data.scenes.map(s => s.words));

  // heatmap: 8x4 grid of "node connectivity" — synthetic
  const heatData = [
    1,2,3,4,3,2,1,0,
    2,4,5,5,4,3,2,1,
    1,3,4,3,5,4,2,1,
    0,1,2,3,4,3,2,1,
  ];
  const warnCells = [10, 19]; // problem nodes

  // node type distribution
  const nodeTypes = [
    { name: "passage", val: 38, color: "var(--c-passage)" },
    { name: "choice", val: 22, color: "var(--c-choice)" },
    { name: "*if", val: 16, color: "var(--c-if)" },
    { name: "*set", val: 28, color: "var(--c-set)" },
    { name: "*goto", val: 12, color: "var(--c-goto)" },
    { name: "*ending", val: 7, color: "var(--c-ending)" },
  ];
  const totalTypes = nodeTypes.reduce((s, n) => s + n.val, 0);

  // path table
  const paths = [
    { route: "intro_grid → midnight_market → rooftop", reach: 78, status: "ok" },
    { route: "intro_grid → ice_breaker → the_burn", reach: 62, status: "ok" },
    { route: "intro_grid → midnight_market → the_burn", reach: 54, status: "warn" },
    { route: "intro_grid → endings (sem_deck)", reach: 18, status: "ok" },
    { route: "the_burn → ??? (label ausente)", reach: 0, status: "err" },
  ];

  // Sparkline path
  const spark = (vals, color) => {
    const max = Math.max(...vals), min = Math.min(...vals);
    const w = 100, h = 24;
    const pts = vals.map((v, i) => `${(i / (vals.length-1)) * w},${h - ((v-min)/(max-min || 1)) * h}`).join(" ");
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"/>
      </svg>
    );
  };

  // Donut
  const Donut = () => {
    const r = 50, cx = 60, cy = 60;
    let acc = 0;
    return (
      <svg width="120" height="120" viewBox="0 0 120 120" className="donut-svg">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--paper-3)" strokeWidth="14"/>
        {nodeTypes.map((n, i) => {
          const frac = n.val / totalTypes;
          const dash = 2 * Math.PI * r * frac;
          const off = -2 * Math.PI * r * acc;
          acc += frac;
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                    stroke={n.color} strokeWidth="14"
                    strokeDasharray={`${dash} ${2 * Math.PI * r}`}
                    strokeDashoffset={off}
                    transform={`rotate(-90 ${cx} ${cy})`}/>
          );
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fontFamily="var(--ff-display)"
              fontWeight="600" fontSize="22" fill="var(--ink)">{totalTypes}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontFamily="var(--ff-mono)"
              fontSize="9" fill="var(--ink-mute)">{t.nodes}</text>
      </svg>
    );
  };

  return (
    <div className="dashboard-overlay">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">{L("Estatísticas do projeto", "Project statistics")}</h1>
          <div className="dash-subtitle">
            {data.title} · {L("atualizado agora", "updated just now")} · {data.scenes.length} {L("cenas", "scenes")}
          </div>
        </div>
        <button className="dash-close" onClick={onClose}>
          ← {L("voltar ao editor", "back to editor")}
        </button>
      </div>

      <div className="dash-grid">
        <div className="kpi-card" data-accent="1">
          <span className="kpi-label">{L("palavras totais", "total words")}</span>
          <span className="kpi-value">{totalWords.toLocaleString()}</span>
          <span className="kpi-unit">{L("≈ 95 min de leitura", "≈ 95 min reading")}</span>
          <div className="kpi-spark">{spark([1200, 2400, 3100, 4221, 5800, 8200, 14920], "var(--accent-1)")}</div>
        </div>
        <div className="kpi-card" data-accent="2">
          <span className="kpi-label">{L("nós", "nodes")}</span>
          <span className="kpi-value">{totalNodes}</span>
          <span className="kpi-unit">{L("9% órfãos", "9% orphan")}</span>
          <div className="kpi-spark">{spark([6, 24, 38, 52, 70, 95, 115], "var(--accent-2)")}</div>
        </div>
        <div className="kpi-card" data-accent="3">
          <span className="kpi-label">{L("escolhas", "choices")}</span>
          <span className="kpi-value">{totalChoices}</span>
          <span className="kpi-unit">{L("3.2 opções/escolha", "3.2 options/choice")}</span>
          <div className="kpi-spark">{spark([3, 8, 14, 19, 24, 30, 38], "var(--accent-3)")}</div>
        </div>
        <div className="kpi-card" data-accent="4">
          <span className="kpi-label">{L("finais alcançáveis", "reachable endings")}</span>
          <span className="kpi-value">{totalEndings}</span>
          <span className="kpi-unit">{L("2 ainda inalcançados", "2 still unreached")}</span>
          <div className="kpi-spark">{spark([1, 2, 2, 4, 5, 6, 7], "var(--c-set)")}</div>
        </div>

        <div className="dash-card">
          <div className="dash-card-head">
            <span className="dash-card-title">{L("palavras por cena", "words per scene")}</span>
            <span className="dash-card-meta">σ = 1.412</span>
          </div>
          {data.scenes.filter(s => !s.special).map((s) => (
            <div className="bar-row" key={s.id}>
              <span className="bar-name">{s.name}.txt</span>
              <span className="bar-track">
                <span className="bar-fill" style={{
                  width: `${(s.words / maxWords) * 100}%`,
                  background: s.warning ? "var(--warn)" : (s.current ? "var(--accent-1)" : "var(--accent-2)"),
                }}/>
              </span>
              <span className="bar-val">{s.words.toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="dash-card">
          <div className="dash-card-head">
            <span className="dash-card-title">{L("distribuição de tipos de nó", "node type distribution")}</span>
            <span className="dash-card-meta">{totalTypes} {t.nodes}</span>
          </div>
          <div className="donut-wrap">
            <Donut/>
            <div className="donut-legend">
              {nodeTypes.map((n) => (
                <div className="donut-row" key={n.name}>
                  <span className="donut-swatch" style={{ background: n.color }}/>
                  <span className="donut-name">{n.name}</span>
                  <span className="donut-val">{n.val} · {Math.round(n.val/totalTypes*100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="dash-card wide">
          <div className="dash-card-head">
            <span className="dash-card-title">{L("mapa de calor — conexões por nó", "heatmap — connections per node")}</span>
            <span className="dash-card-meta">{L("contornos vermelhos = nós problemáticos", "red outlines = problem nodes")}</span>
          </div>
          <div className="heatmap">
            {heatData.map((h, i) => (
              <div key={i} className="heat-cell" data-h={h} data-warn={warnCells.includes(i)}/>
            ))}
          </div>
          <div className="heat-legend">
            <span>{L("baixa", "low")}</span>
            <div className="heat-legend-cells">
              {[0,1,2,3,4,5].map(h => <div key={h} className="heat-cell" data-h={h}/>)}
            </div>
            <span>{L("alta", "high")}</span>
          </div>
        </div>

        <div className="dash-card wide">
          <div className="dash-card-head">
            <span className="dash-card-title">{L("caminhos mais percorridos (Quick Test, 200 simulações)", "most-traveled paths (Quick Test, 200 sims)")}</span>
            <span className="dash-card-meta">{L("cobertura média: 73%", "avg coverage: 73%")}</span>
          </div>
          <table className="path-table">
            <thead>
              <tr>
                <th>{L("rota", "route")}</th>
                <th>{L("alcance", "reach")}</th>
                <th>{L("status", "status")}</th>
              </tr>
            </thead>
            <tbody>
              {paths.map((p, i) => (
                <tr key={i}>
                  <td>{p.route}</td>
                  <td>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, width: 140 }}>
                      <span className="bar-track" style={{ flex: 1 }}>
                        <span className="bar-fill" style={{
                          width: `${p.reach}%`,
                          background: p.status === "err" ? "var(--err)" : p.status === "warn" ? "var(--warn)" : "var(--accent-2)",
                        }}/>
                      </span>
                      <span style={{ width: 30, textAlign: "right" }}>{p.reach}%</span>
                    </div>
                  </td>
                  <td><span className={`path-tag ${p.status === "ok" ? "" : p.status}`}>{p.status === "ok" ? "ok" : p.status === "warn" ? "warn" : "error"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
