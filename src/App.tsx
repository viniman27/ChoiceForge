import { useEffect, useState } from "react";
import { BottomBar } from "./components/BottomBar";
import { Dashboard } from "./components/Dashboard";
import { GraphCanvas } from "./components/GraphCanvas";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";
import { TopBar } from "./components/TopBar";
import { i18n } from "./data/sampleProject";
import { createExportPackage } from "./domain/choicescript";
import type { ChoiceForgeProject, Density, EditorView, Language, Theme } from "./domain/types";
import { useProjectStore } from "./state/projectStore";

export default function App() {
  const [lang, setLang] = useState<Language>("pt");
  const [theme, setTheme] = useState<Theme>("light");
  const [density, setDensity] = useState<Density>("rich");
  const [selectedId, setSelectedId] = useState<string | null>("n3");
  const [activeTab, setActiveTab] = useState("scenes");
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [zoom, setZoom] = useState(0.85);
  const [view, setView] = useState<EditorView>("editor");
  const { lintedProject, actions } = useProjectStore();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.nodeStyle = "soft";
    document.documentElement.dataset.direction = "default";
  }, [theme]);

  const selectedNode = lintedProject.nodes.find((node) => node.id === selectedId) ?? null;

  return (
    <div className="app" data-bot-open="false">
      <TopBar
        data={lintedProject}
        lang={lang}
        theme={theme}
        density={density}
        view={view}
        onLangChange={setLang}
        onThemeChange={setTheme}
        onDensityChange={setDensity}
        onViewChange={setView}
        onExport={() => downloadGeneratedProject(lintedProject)}
        onResetProject={() => {
          actions.resetProject(lang);
          setSelectedId("n3");
        }}
      />
      <LeftPanel
        data={lintedProject}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        labels={i18n[lang]}
        onAddScene={actions.addScene}
        onAddVariable={actions.addVariable}
      />
      <GraphCanvas
        data={lintedProject}
        density={density}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        pan={pan}
        onPan={setPan}
        zoom={zoom}
        setZoom={setZoom}
        onMoveNode={actions.moveNode}
      />
      <RightPanel
        node={selectedNode}
        project={lintedProject}
        labels={i18n[lang]}
        onUpdateNode={actions.updateNode}
      />
      <BottomBar data={lintedProject} labels={i18n[lang]} />
      {view === "dashboard" && <Dashboard data={lintedProject} labels={i18n[lang]} onClose={() => setView("editor")} />}
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
