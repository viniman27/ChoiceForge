import { useEffect, useState, type CSSProperties } from "react";
import { BottomBar } from "./components/BottomBar";
import { Dashboard } from "./components/Dashboard";
import { GeneratedDocumentView } from "./components/GeneratedDocumentView";
import { GraphCanvas } from "./components/GraphCanvas";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";
import { TopBar } from "./components/TopBar";
import { i18n } from "./data/sampleProject";
import { createExportPackage, generateSceneChoiceScript, generateStartupChoiceScript, generateStatsChoiceScript } from "./domain/choicescript";
import type { ChoiceForgeProject, Density, EditorView, Language, StoryNode, Theme } from "./domain/types";
import { useProjectStore } from "./state/projectStore";

type GeneratedDocumentId = "startup" | "stats" | "scene";
type ResizeTarget = "left" | "right";

const LAYOUT_STORAGE_KEY = "choiceforge.layout.v1";
const LEFT_PANEL_DEFAULT = 280;
const RIGHT_PANEL_DEFAULT = 360;
const LEFT_PANEL_MIN = 220;
const LEFT_PANEL_MAX = 520;
const RIGHT_PANEL_MIN = 300;
const RIGHT_PANEL_MAX = 640;
const BOARD_MIN = 460;
const RESIZE_GUTTERS = 12;

export default function App() {
  const [lang, setLang] = useState<Language>("en");
  const [theme, setTheme] = useState<Theme>("light");
  const [density, setDensity] = useState<Density>("rich");
  const [selectedId, setSelectedId] = useState<string | null>("n3");
  const [activeTab, setActiveTab] = useState("scenes");
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [zoom, setZoom] = useState(0.85);
  const [view, setView] = useState<EditorView>("editor");
  const [generatedDocumentId, setGeneratedDocumentId] = useState<GeneratedDocumentId | null>(null);
  const [layout, setLayout] = useState(loadLayout);
  const [resizeTarget, setResizeTarget] = useState<ResizeTarget | null>(null);
  const { lintedProject, actions } = useProjectStore();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.nodeStyle = "soft";
    document.documentElement.dataset.direction = "default";
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    if (!resizeTarget) return;

    const move = (event: PointerEvent) => {
      setLayout((current) => {
        const maxLeft = Math.min(LEFT_PANEL_MAX, window.innerWidth - current.right - BOARD_MIN - RESIZE_GUTTERS);
        const maxRight = Math.min(RIGHT_PANEL_MAX, window.innerWidth - current.left - BOARD_MIN - RESIZE_GUTTERS);
        if (resizeTarget === "left") {
          return { ...current, left: clamp(event.clientX, LEFT_PANEL_MIN, maxLeft) };
        }
        return { ...current, right: clamp(window.innerWidth - event.clientX, RIGHT_PANEL_MIN, maxRight) };
      });
    };
    const up = () => setResizeTarget(null);

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [resizeTarget]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== "z") return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      actions.undo();
      setSelectedId(null);
      setGeneratedDocumentId(null);
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [actions]);

  const selectedNode = lintedProject.nodes.find((node) => node.id === selectedId) ?? null;
  const generatedDocument = generatedDocumentId ? createGeneratedDocument(generatedDocumentId, lintedProject) : null;
  const activeSceneId = generatedDocumentId ?? lintedProject.scenes.find((scene) => scene.current)?.id ?? lintedProject.sceneTitle;
  const appStyle = {
    "--left-panel-width": `${layout.left}px`,
    "--right-panel-width": `${layout.right}px`,
  } as CSSProperties;

  return (
    <div className={`app ${resizeTarget ? "is-resizing" : ""}`} data-bot-open="false" style={appStyle}>
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
        canUndo={actions.canUndo}
        textModeActive={generatedDocumentId === "scene"}
        onUndo={() => {
          actions.undo();
          setSelectedId(null);
          setGeneratedDocumentId(null);
        }}
        onTextMode={() => {
          setGeneratedDocumentId((current) => (current === "scene" ? null : "scene"));
          setSelectedId(null);
        }}
        onExport={() => downloadGeneratedProject(lintedProject)}
        onResetProject={() => {
          actions.resetProject(lang);
          setGeneratedDocumentId(null);
          setSelectedId("n3");
        }}
      />
      <LeftPanel
        data={lintedProject}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeSceneId={activeSceneId}
        labels={i18n[lang]}
        onAddScene={() => {
          setGeneratedDocumentId(null);
          actions.addScene();
          setSelectedId("n1");
        }}
        onSelectScene={(id) => {
          const scene = lintedProject.scenes.find((candidate) => candidate.id === id);
          const keepTextMode = generatedDocumentId === "scene";
          if (scene?.isStart || scene?.special) {
            setGeneratedDocumentId(scene.isStart ? "startup" : "stats");
            setSelectedId(null);
            return;
          }
          setGeneratedDocumentId(keepTextMode ? "scene" : null);
          actions.selectScene(id);
          setSelectedId("n1");
        }}
        onUpdateScene={actions.updateScene}
        onDuplicateScene={actions.duplicateScene}
        onDeleteScene={actions.deleteScene}
        onAddVariable={actions.addVariable}
        onUpdateVariable={actions.updateVariable}
        onAddAchievement={actions.addAchievement}
        onUpdateAchievement={actions.updateAchievement}
        onDeleteAchievement={actions.deleteAchievement}
        onAddAsset={actions.addAsset}
        onUpdateAsset={actions.updateAsset}
        onDeleteAsset={actions.deleteAsset}
        onSelectNode={setSelectedId}
      />
      <button
        className="resize-handle resize-handle-left"
        type="button"
        aria-label="redimensionar painel esquerdo"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setResizeTarget("left");
        }}
      />
      {generatedDocument ? (
        <GeneratedDocumentView {...generatedDocument} />
      ) : (
        <GraphCanvas
          data={lintedProject}
          density={density}
          labels={i18n[lang]}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          pan={pan}
          onPan={setPan}
          zoom={zoom}
          setZoom={setZoom}
          onMoveNode={actions.moveNode}
          onLayoutNodes={actions.layoutNodes}
          onConnectNodes={actions.connectNodes}
          onAddNode={(type, position) => {
            const id = nextNodeId(lintedProject.nodes);
            actions.addNode(type, id, position);
            setSelectedId(id);
          }}
          onDeleteNode={(id) => {
            actions.deleteNode(id);
            setSelectedId(null);
          }}
        />
      )}
      <button
        className="resize-handle resize-handle-right"
        type="button"
        aria-label="redimensionar painel direito"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setResizeTarget("right");
        }}
      />
      <RightPanel
        node={selectedNode}
        project={lintedProject}
        labels={i18n[lang]}
        onUpdateNode={actions.updateNode}
        onAddFlowEdge={actions.addFlowEdge}
        onDeleteFlowEdge={actions.deleteFlowEdge}
      />
      <BottomBar data={lintedProject} labels={i18n[lang]} onSelectNode={setSelectedId} />
      {view === "dashboard" && <Dashboard data={lintedProject} labels={i18n[lang]} onClose={() => setView("editor")} />}
    </div>
  );
}

function loadLayout() {
  const fallback = { left: LEFT_PANEL_DEFAULT, right: RIGHT_PANEL_DEFAULT };
  try {
    const saved = JSON.parse(window.localStorage.getItem(LAYOUT_STORAGE_KEY) ?? "null") as Partial<typeof fallback> | null;
    if (!saved) return fallback;
    return {
      left: clamp(saved.left ?? fallback.left, LEFT_PANEL_MIN, LEFT_PANEL_MAX),
      right: clamp(saved.right ?? fallback.right, RIGHT_PANEL_MIN, RIGHT_PANEL_MAX),
    };
  } catch {
    return fallback;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function createGeneratedDocument(id: GeneratedDocumentId, project: ChoiceForgeProject) {
  if (id === "startup") {
    return {
      title: "startup.txt",
      path: "mygame/startup.txt",
      description: "Titulo, autor, scene_list, variaveis, conquistas e cena inicial exportada.",
      content: generateStartupChoiceScript(project),
    };
  }

  if (id === "stats") {
    return {
      title: "choicescript_stats.txt",
      path: "mygame/choicescript_stats.txt",
      description: "Tela de status gerada a partir das variaveis e conquistas do projeto.",
      content: generateStatsChoiceScript(project),
    };
  }

  return {
    title: `${project.sceneTitle}.txt`,
    path: `mygame/${project.sceneTitle}.txt`,
    description: "ChoiceScript gerado a partir do grafo visual da cena atual.",
    content: `${generateSceneChoiceScript(project)}\n`,
  };
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

function nextNodeId(nodes: StoryNode[]): string {
  const max = nodes.reduce((currentMax, node) => {
    const match = /^n(\d+)$/.exec(node.id);
    return match ? Math.max(currentMax, Number(match[1])) : currentMax;
  }, 0);
  return `n${max + 1}`;
}
