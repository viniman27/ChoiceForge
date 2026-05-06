import { useEffect, useState, type CSSProperties } from "react";
import { BottomBar } from "./components/BottomBar";
import { Dashboard } from "./components/Dashboard";
import { GeneratedDocumentView } from "./components/GeneratedDocumentView";
import { GraphCanvas } from "./components/GraphCanvas";
import { LeftPanel } from "./components/LeftPanel";
import { PlaytestView } from "./components/PlaytestView";
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
  const [playOpen, setPlayOpen] = useState(false);
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
      setPlayOpen(false);
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
          setPlayOpen(false);
        }}
        onTextMode={() => {
          setPlayOpen(false);
          setGeneratedDocumentId((current) => (current === "scene" ? null : "scene"));
          setSelectedId(null);
        }}
        onPlay={() => {
          setPlayOpen(true);
          setGeneratedDocumentId(null);
          setSelectedId(null);
        }}
        onImport={(file) => importChoiceForgeProject(file, actions.setProject, () => {
          setPlayOpen(false);
          setGeneratedDocumentId(null);
          setSelectedId("n1");
        }, lang)}
        onExport={() => downloadGeneratedProject(lintedProject)}
        onResetProject={() => {
          actions.resetProject(lang);
          setGeneratedDocumentId(null);
          setPlayOpen(false);
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
          setPlayOpen(false);
          actions.addScene();
          setSelectedId("n1");
        }}
        onSelectScene={(id) => {
          const scene = lintedProject.scenes.find((candidate) => candidate.id === id);
          const keepTextMode = generatedDocumentId === "scene";
          setPlayOpen(false);
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
        aria-label="resize left panel"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setResizeTarget("left");
        }}
      />
      {playOpen ? (
        <PlaytestView project={lintedProject} onClose={() => setPlayOpen(false)} />
      ) : generatedDocument ? (
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
        aria-label="resize right panel"
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
      description: "Title, author, scene_list, variables, achievements, and exported initial scene.",
      content: generateStartupChoiceScript(project),
    };
  }

  if (id === "stats") {
    return {
      title: "choicescript_stats.txt",
      path: "mygame/choicescript_stats.txt",
      description: "Status screen generated from project variables and achievements.",
      content: generateStatsChoiceScript(project),
    };
  }

  return {
    title: `${project.sceneTitle}.txt`,
    path: `mygame/${project.sceneTitle}.txt`,
    description: "ChoiceScript generated from the current scene graph.",
    content: `${generateSceneChoiceScript(project)}\n`,
  };
}

function downloadGeneratedProject(project: ChoiceForgeProject) {
  const zipBytes = createZipArchive(createExportPackage(project).files);
  const blob = new Blob([toArrayBuffer(zipBytes)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.title}.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importChoiceForgeProject(file: File, setProject: (project: ChoiceForgeProject) => void, onDone: () => void, lang: Language) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result ?? "")) as ChoiceForgeProject;
      assertChoiceForgeProject(parsed);
      setProject(parsed);
      onDone();
    } catch {
      window.alert(lang === "pt" ? "Nao foi possivel importar este project.json." : "Could not import this project.json.");
    }
  });
  reader.readAsText(file);
}

function assertChoiceForgeProject(value: unknown): asserts value is ChoiceForgeProject {
  if (!value || typeof value !== "object") throw new Error("invalid project");
  const project = value as Partial<ChoiceForgeProject>;
  if (typeof project.title !== "string" || typeof project.author !== "string" || typeof project.sceneTitle !== "string") throw new Error("invalid metadata");
  if (!Array.isArray(project.scenes) || !Array.isArray(project.variables) || !Array.isArray(project.nodes) || !Array.isArray(project.edges)) throw new Error("invalid collections");
}

function createZipArchive(files: ReturnType<typeof createExportPackage>["files"]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const name = encoder.encode(file.path);
    const content = encoder.encode(file.content);
    const crc = crc32(content);
    const localHeader = concatBytes(
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(content.length),
      u32(content.length),
      u16(name.length),
      u16(0),
      name,
    );
    localParts.push(localHeader, content);

    centralParts.push(concatBytes(
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(content.length),
      u32(content.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ));

    offset += localHeader.length + content.length;
  });

  const centralDirectory = concatBytes(...centralParts);
  const localFiles = concatBytes(...localParts);
  const end = concatBytes(
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDirectory.length),
    u32(localFiles.length),
    u16(0),
  );

  return concatBytes(localFiles, centralDirectory, end);
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  bytes.forEach((byte) => {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  });
  return (crc ^ 0xffffffff) >>> 0;
}

function nextNodeId(nodes: StoryNode[]): string {
  const max = nodes.reduce((currentMax, node) => {
    const match = /^n(\d+)$/.exec(node.id);
    return match ? Math.max(currentMax, Number(match[1])) : currentMax;
  }, 0);
  return `n${max + 1}`;
}
