import { useEffect, useMemo, useState } from "react";
import { BottomBar } from "./components/BottomBar";
import { Dashboard } from "./components/Dashboard";
import { GraphCanvas } from "./components/GraphCanvas";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";
import { TopBar } from "./components/TopBar";
import { i18n, sampleProjects } from "./data/sampleProject";
import { createExportPackage, lintProject } from "./domain/choicescript";
import type { ChoiceForgeProject, Density, EditorView, Language, Theme } from "./domain/types";

const STORAGE_KEY = "choiceforge.project.v1";

function cloneProject(project: ChoiceForgeProject): ChoiceForgeProject {
  return structuredClone(project);
}

function loadInitialProject(): ChoiceForgeProject {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return cloneProject(sampleProjects.pt);

  try {
    return JSON.parse(saved) as ChoiceForgeProject;
  } catch {
    return cloneProject(sampleProjects.pt);
  }
}

export default function App() {
  const [lang, setLang] = useState<Language>("pt");
  const [theme, setTheme] = useState<Theme>("light");
  const [density, setDensity] = useState<Density>("rich");
  const [data, setData] = useState(loadInitialProject);
  const [selectedId, setSelectedId] = useState<string | null>("n3");
  const [activeTab, setActiveTab] = useState("scenes");
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [zoom, setZoom] = useState(0.85);
  const [view, setView] = useState<EditorView>("editor");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }, 400);

    return () => window.clearTimeout(handle);
  }, [data]);

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
        onResetProject={() => {
          const fresh = cloneProject(sampleProjects[lang]);
          setData(fresh);
          setSelectedId("n3");
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        }}
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
  const payload = JSON.stringify(createExportPackage(project), null, 2);
  const blob = new Blob([`${payload}\n`], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.title}.choiceforge-export.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
