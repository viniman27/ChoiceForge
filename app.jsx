// Main app — wires everything together

const { useState, useEffect, useMemo } = React;

function App() {
  const tweaks = window.useTweaks(window.__tweakDefaults || {});
  const lang = tweaks.values.lang || "en";
  const theme = tweaks.values.theme || "light";
  const density = tweaks.values.density || "rich";
  const nodeStyle = tweaks.values.nodeStyle || "soft";
  const direction = tweaks.values.direction || "default";

  window.__lang = lang;

  // story data — clone so we can mutate node positions
  const [data, setData] = useState(() => JSON.parse(JSON.stringify(window.STORY[lang])));
  // re-seed when language toggles
  useEffect(() => {
    setData(JSON.parse(JSON.stringify(window.STORY[lang])));
    setSelectedId("n3");
  }, [lang]);

  const [selectedId, setSelectedId] = useState("n3");
  const [activeTab, setActiveTab] = useState("scenes");
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [zoom, setZoom] = useState(0.85);
  const [view, setView] = useState("editor"); // editor | dashboard

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.nodeStyle = nodeStyle;
    document.documentElement.dataset.direction = direction;
  }, [theme, nodeStyle, direction]);

  const selectedNode = data.nodes.find((n) => n.id === selectedId);

  const onMoveNode = (id, x, y) => {
    setData((d) => ({ ...d, nodes: d.nodes.map((n) => n.id === id ? { ...n, x, y } : n) }));
  };
  const onUpdateNode = (id, patch) => {
    setData((d) => ({ ...d, nodes: d.nodes.map((n) => n.id === id ? { ...n, ...patch } : n) }));
  };

  return (
    <div className="app" data-bot-open="false">
      <window.TopBar data={data} lang={lang} setLang={(l) => tweaks.setTweak("lang", l)} onPlay={() => alert("play-test mode")} view={view} setView={setView}/>
      <window.LeftPanel data={data} activeTab={activeTab} setActiveTab={setActiveTab} lang={lang}/>
      <window.GraphCanvas
        data={data} density={density}
        selectedId={selectedId} setSelectedId={setSelectedId}
        onMoveNode={onMoveNode}
        pan={pan} onPan={setPan}
        zoom={zoom} setZoom={setZoom}
      />
      <window.RightPanel node={selectedNode} lang={lang} onUpdateNode={onUpdateNode}/>
      <window.BottomBar data={data} lang={lang}/>
      {view === "dashboard" && <window.Dashboard data={data} lang={lang} onClose={() => setView("editor")}/>}
      <ChoiceForgeTweaks tweaks={tweaks}/>
    </div>
  );
}

function ChoiceForgeTweaks({ tweaks }) {
  const { values, setTweak } = tweaks;
  const lang = values.lang || "en";
  const L = (pt, en) => lang === "pt" ? pt : en;
  return (
    <window.TweaksPanel title="Tweaks">
      <window.TweakSection title={L("direção estética", "aesthetic direction")}>
        <window.TweakSelect label={L("preset", "preset")} value={values.direction} onChange={(v) => setTweak("direction", v)}
          options={[
            { value: "default", label: L("padrão (papel quente)", "default (warm paper)") },
            { value: "neon", label: L("neon (cyberpunk escuro)", "neon (dark cyberpunk)") },
            { value: "editorial", label: L("editorial (revista)", "editorial (magazine)") },
            { value: "brutal", label: L("brutalista (mono)", "brutalist (mono)") },
            { value: "crt", label: L("CRT (terminal verde)", "CRT (green terminal)") },
            { value: "analog", label: L("analógico (papel quadriculado)", "analog (graph paper)") },
          ]}/>
      </window.TweakSection>

      <window.TweakSection title={L("aparência", "appearance")}>
        <window.TweakRadio label={L("tema", "theme")} value={values.theme} onChange={(v) => setTweak("theme", v)}
          options={[{ value: "light", label: L("claro", "light") }, { value: "dark", label: L("escuro", "dark") }]}/>
        <window.TweakRadio label={L("idioma", "language")} value={values.lang} onChange={(v) => setTweak("lang", v)}
          options={[{ value: "en", label: "EN" }, { value: "pt", label: "PT-BR" }]}/>
      </window.TweakSection>

      <window.TweakSection title={L("nós", "nodes")}>
        <window.TweakRadio label={L("densidade", "density")} value={values.density} onChange={(v) => setTweak("density", v)}
          options={[
            { value: "minimal", label: L("mínimo", "minimal") },
            { value: "medium", label: L("médio", "medium") },
            { value: "rich", label: L("rico", "rich") },
          ]}/>
        <window.TweakRadio label={L("estilo", "style")} value={values.nodeStyle} onChange={(v) => setTweak("nodeStyle", v)}
          options={[
            { value: "soft", label: L("suave", "soft") },
            { value: "ink", label: L("tinta", "ink") },
            { value: "paper", label: L("papel", "paper") },
          ]}/>
      </window.TweakSection>
    </window.TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
