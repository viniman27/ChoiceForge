import { useEffect, useMemo, useState } from "react";
import { BottomBar } from "./components/BottomBar";
import { Dashboard } from "./components/Dashboard";
import { GraphCanvas } from "./components/GraphCanvas";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";
import { TopBar } from "./components/TopBar";
import { i18n, sampleProjects } from "./data/sampleProject";
import { generateProjectJson, generateSceneChoiceScript, lintProject } from "./domain/choicescript";
import type { ChoiceForgeProject, Density, EditorView, Language, Theme } from "./domain/types";

function cloneProject(project: ChoiceForgeProject): ChoiceForgeProject {
  return structuredClone(project);
}

export default function App() {
  const [lang, setLang] = useState<Language>("pt");
  const [theme, setTheme] = useState<Theme>("light");
  const [density, setDensity] = useState<Density>("rich");
  const [data, setData] = useState(() => cloneProject(sampleProjects.pt));
  const [selectedId, setSelectedId] = useState<string | null>("n3");
  const [activeTab, setActiveTab] = useState("scenes");
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [zoom, setZoom] = useState(0.85);
  const [view, setView] = useState<EditorView>("editor");

  useEffect(() => {
    setData(cloneProject(sampleProjects[lang]));
    setSelectedId("n3");
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.nodeStyle = "soft";
    document.documentElement.dataset.direction = "default";
  }, [theme]);

  const lintedData = useMemo(() => ({ ...data, lints: lintProject(data) }), [data]);
  const selectedNode = lintedData.nodes.find((node) => node.id === selectedId) ?? null;

  return (
    <div className="app" data-bot-open="false">
      <TopBar
        data={lintedData}
        lang={lang}
        theme={theme}
        density={density}
        view={view}
        onLangChange={setLang}
        onThemeChange={setTheme}
        onDensityChange={setDensity}
        onViewChange={setView}
        onExport={() => downloadGeneratedProject(lintedData)}
      />
      <LeftPanel data={lintedData} activeTab={activeTab} setActiveTab={setActiveTab} labels={i18n[lang]} />
      <GraphCanvas
        data={lintedData}
        density={density}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        pan={pan}
        onPan={setPan}
        zoom={zoom}
        setZoom={setZoom}
        onMoveNode={(id, x, y) => {
          setData((current) => ({
            ...current,
            nodes: current.nodes.map((node) => (node.id === id ? { ...node, x, y } : node)),
          }));
        }}
      />
      <RightPanel
        node={selectedNode}
        project={lintedData}
        labels={i18n[lang]}
        onUpdateNode={(id, patch) => {
          setData((current) => ({
            ...current,
            nodes: current.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
          }));
        }}
      />
      <BottomBar data={lintedData} labels={i18n[lang]} />
      {view === "dashboard" && <Dashboard data={lintedData} labels={i18n[lang]} onClose={() => setView("editor")} />}
    </div>
  );
}

function downloadGeneratedProject(project: ChoiceForgeProject) {
  const payload = [
    `# ${project.title}`,
    "",
    "## project.json",
    "```json",
    generateProjectJson(project),
    "```",
    "",
    `## ${project.sceneTitle}.txt`,
    "```choicescript",
    generateSceneChoiceScript(project),
    "```",
    "",
  ].join("\n");

  const blob = new Blob([payload], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.title}-choiceforge-export.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}
