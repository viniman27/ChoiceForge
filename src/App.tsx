import { lazy, Suspense, useEffect, useState, type CSSProperties } from "react";
import { unzipSync } from "fflate";
import { BottomBar } from "./components/BottomBar";
import { Dashboard } from "./components/Dashboard";
import { GraphCanvas } from "./components/GraphCanvas";
import { LeftPanel } from "./components/LeftPanel";
import { PlaytestView } from "./components/PlaytestView";
import { RightPanel } from "./components/RightPanel";
import { TopBar } from "./components/TopBar";
import { i18n } from "./data/sampleProject";
import { createExportPackage, generateSceneChoiceScript, generateStartupChoiceScript, generateStatsChoiceScript } from "./domain/choicescript";
import { importChoiceScriptArchive, importChoiceScriptSceneText } from "./domain/choicescriptImport";
import type { ChoiceForgeProject, Density, EditorView, Language, StoryNode, Theme } from "./domain/types";
import { useProjectStore } from "./state/projectStore";

const GeneratedDocumentView = lazy(() => import("./components/GeneratedDocumentView").then((module) => ({ default: module.GeneratedDocumentView })));

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
  const [selectedId, setSelectedId] = useState<string | null>("n1");
  const [activeTab, setActiveTab] = useState("scenes");
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [zoom, setZoom] = useState(0.85);
  const [view, setView] = useState<EditorView>("editor");
  const [generatedDocumentId, setGeneratedDocumentId] = useState<GeneratedDocumentId | null>(null);
  const [generatedDocumentLine, setGeneratedDocumentLine] = useState<number | null>(null);
  const [playOpen, setPlayOpen] = useState(false);
  const [layout, setLayout] = useState(loadLayout);
  const [resizeTarget, setResizeTarget] = useState<ResizeTarget | null>(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [consoleOpen, setConsoleOpen] = useState(false);
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
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        actions.saveNow();
        setSaveStatus(formatSaveStatus(lang));
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== "z") return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      actions.undo();
      setSelectedId(null);
      setGeneratedDocumentId(null);
      setGeneratedDocumentLine(null);
      setPlayOpen(false);
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [actions, lang]);

  useEffect(() => {
    if (!saveStatus) return;
    const handle = window.setTimeout(() => setSaveStatus(""), 3500);
    return () => window.clearTimeout(handle);
  }, [saveStatus]);

  const selectedNode = lintedProject.nodes.find((node) => node.id === selectedId) ?? null;
  const generatedDocument = generatedDocumentId ? createGeneratedDocument(generatedDocumentId, lintedProject) : null;
  const currentSceneSourcePreserved = Boolean(lintedProject.sceneData?.[lintedProject.sceneTitle]?.sourceText);
  const currentSceneId = lintedProject.scenes.find((scene) => scene.current)?.id ?? lintedProject.sceneTitle;
  const activeSceneId = generatedDocumentId === "startup" || generatedDocumentId === "stats" ? generatedDocumentId : currentSceneId;
  const appStyle = {
    "--left-panel-width": `${layout.left}px`,
    "--right-panel-width": `${layout.right}px`,
  } as CSSProperties;
  const focusNode = (id: string) => {
      const node = lintedProject.nodes.find((candidate) => candidate.id === id);
      setSelectedId(id);
      if (!node) return;
      setGeneratedDocumentId(null);
      setGeneratedDocumentLine(null);
      setPlayOpen(false);
    setPan(centerPanForNode(node, zoom, layout, consoleOpen));
  };
  const confirmVisualConversion = () => {
    const confirmed = window.confirm(
      "Convert this imported scene to visual editing?\n\nExport will stop using the preserved .txt source and will use the current visual graph instead. The preserved source remains in undo history, but this conversion can lose ChoiceScript constructs the visual importer does not fully model.",
    );
    if (!confirmed) return;
    actions.convertCurrentSceneToVisual();
    setGeneratedDocumentId(null);
    setGeneratedDocumentLine(null);
    setPlayOpen(false);
    setSelectedId("n1");
  };

  return (
    <div className={`app ${resizeTarget ? "is-resizing" : ""}`} data-bot-open={consoleOpen ? "true" : "false"} style={appStyle}>
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
        onMetadataChange={actions.updateMetadata}
        canUndo={actions.canUndo}
        textModeActive={generatedDocumentId === "scene"}
        onUndo={() => {
          actions.undo();
          setSelectedId(null);
          setGeneratedDocumentId(null);
          setGeneratedDocumentLine(null);
          setPlayOpen(false);
        }}
        onSave={() => {
          actions.saveNow();
          setSaveStatus(formatSaveStatus(lang));
        }}
        saveStatus={saveStatus}
        onTextMode={() => {
          setPlayOpen(false);
          setGeneratedDocumentId((current) => (current === "scene" ? null : "scene"));
          setGeneratedDocumentLine(null);
          setSelectedId(null);
        }}
        onPlay={() => {
          setPlayOpen(true);
          setGeneratedDocumentId(null);
          setGeneratedDocumentLine(null);
          setSelectedId(null);
        }}
        onImport={(files) => importChoiceForgeProject(files, lintedProject, actions.setProject, () => {
          setPlayOpen(false);
          setGeneratedDocumentId(null);
          setGeneratedDocumentLine(null);
          setSelectedId("n1");
          resetViewport(setPan, setZoom);
        }, lang)}
        onExport={() => {
          if (!confirmExportWithLintErrors(lintedProject, lang)) return;
          downloadGeneratedProject(lintedProject);
        }}
        onResetProject={() => {
          const confirmed = window.confirm(lang === "pt"
            ? "Resetar substitui o projeto salvo localmente pelo exemplo inicial. Deseja continuar?"
            : "Reset replaces the locally saved project with the starter sample. Continue?");
          if (!confirmed) return;
          actions.resetProject(lang);
          setSaveStatus(formatSaveStatus(lang));
          setGeneratedDocumentId(null);
          setGeneratedDocumentLine(null);
          setPlayOpen(false);
          setSelectedId("n1");
          resetViewport(setPan, setZoom);
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
          setGeneratedDocumentLine(null);
          setPlayOpen(false);
          actions.addScene();
          setSelectedId("n1");
        }}
        onSelectScene={(id, targetLine) => {
          const scene = lintedProject.scenes.find((candidate) => candidate.id === id);
          const keepTextMode = generatedDocumentId === "scene";
          const hasPreservedSource = Boolean(scene && !scene.isStart && !scene.special && lintedProject.sceneData?.[scene.name]?.sourceText);
          setPlayOpen(false);
          if (scene?.isStart || scene?.special) {
            setGeneratedDocumentId(scene.isStart ? "startup" : "stats");
            setGeneratedDocumentLine(targetLine ?? null);
            setSelectedId(null);
            return;
          }
          setGeneratedDocumentId(targetLine || keepTextMode || hasPreservedSource ? "scene" : null);
          setGeneratedDocumentLine(targetLine ?? null);
          actions.selectScene(id);
          setSelectedId(targetLine || hasPreservedSource ? null : "n1");
        }}
        onUpdateScene={actions.updateScene}
        onMoveScene={actions.moveScene}
        onMoveSceneBefore={actions.moveSceneBefore}
        onDuplicateScene={actions.duplicateScene}
        onDeleteScene={actions.deleteScene}
        onAddVariable={actions.addVariable}
        onUpdateVariable={actions.updateVariable}
        onDeleteVariable={actions.deleteVariable}
        onAddAchievement={actions.addAchievement}
        onUpdateAchievement={actions.updateAchievement}
        onDeleteAchievement={actions.deleteAchievement}
        onAddAsset={actions.addAsset}
        onUpdateAsset={actions.updateAsset}
        onDeleteAsset={actions.deleteAsset}
        onSelectNode={focusNode}
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
        <Suspense fallback={<section className="generated-doc generated-doc-loading">Loading editor...</section>}>
          <GeneratedDocumentView
            {...generatedDocument}
            editable
            targetLine={generatedDocumentLine}
            sourcePreserved={generatedDocumentId === "scene" && currentSceneSourcePreserved}
            onConvertSource={confirmVisualConversion}
            onClose={() => {
              setGeneratedDocumentId(null);
              setGeneratedDocumentLine(null);
              setSelectedId("n1");
            }}
            onSave={(content) => {
              if (generatedDocumentId === "startup") {
                actions.replaceStartupText(content);
                return "startup.txt applied to project metadata.";
              }
              if (generatedDocumentId === "stats") {
                actions.replaceStatsText(content);
                return "choicescript_stats.txt applied to stat settings.";
              }
              if (generatedDocumentId === "scene") {
                actions.replaceCurrentSceneText(content);
                setSelectedId("n1");
                return `${lintedProject.sceneTitle}.txt parsed into the board.`;
              }
            }}
          />
        </Suspense>
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
          sourcePreserved={currentSceneSourcePreserved}
          onConvertSource={confirmVisualConversion}
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
        sourcePreserved={currentSceneSourcePreserved}
        onConvertSource={confirmVisualConversion}
        onUpdateNode={currentSceneSourcePreserved ? noopUpdateNode : actions.updateNode}
        onAddFlowEdge={currentSceneSourcePreserved ? noopFlowEdge : actions.addFlowEdge}
        onDeleteFlowEdge={currentSceneSourcePreserved ? noopFlowEdge : actions.deleteFlowEdge}
        onSelectNode={focusNode}
      />
      <BottomBar
        data={lintedProject}
        labels={i18n[lang]}
        open={consoleOpen}
        onOpenChange={setConsoleOpen}
        onSelectIssue={(lint) => {
          const scene = lintedProject.scenes.find((candidate) => candidate.name === lint.scene);
          setPlayOpen(false);
          if (lint.line && scene?.isStart) {
            setGeneratedDocumentId("startup");
            setGeneratedDocumentLine(lint.line);
            setSelectedId(null);
            return;
          }
          if (lint.line && scene?.special) {
            setGeneratedDocumentId("stats");
            setGeneratedDocumentLine(lint.line);
            setSelectedId(null);
            return;
          }
          if (scene && !scene.isStart && !scene.special && scene.name !== lintedProject.sceneTitle) {
            actions.selectScene(scene.id);
          }
          if (lint.line && scene && !scene.isStart && !scene.special) {
            setGeneratedDocumentId("scene");
            setGeneratedDocumentLine(lint.line);
            setSelectedId(null);
            return;
          }
          setGeneratedDocumentId(null);
          setGeneratedDocumentLine(null);
          if (lint.node) {
            if (!scene || scene.name === lintedProject.sceneTitle) focusNode(lint.node);
            else setSelectedId(lint.node);
            return;
          }
          setSelectedId(null);
          setActiveTab(tabForLintMessage(lint.msg));
        }}
      />
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

function formatSaveStatus(lang: Language): string {
  const time = new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
  return lang === "pt" ? `Salvo localmente ${time}` : `Saved locally ${time}`;
}

function centerPanForNode(node: StoryNode, zoom: number, layout: { left: number; right: number }, consoleOpen: boolean) {
  const canvasWidth = Math.max(BOARD_MIN, window.innerWidth - layout.left - layout.right - RESIZE_GUTTERS);
  const canvasHeight = Math.max(240, window.innerHeight - 56 - (consoleOpen ? 220 : 36));
  return {
    x: Math.round(canvasWidth / 2 - (node.x + node.w / 2) * zoom),
    y: Math.round(canvasHeight / 2 - (node.y + 110) * zoom),
  };
}

function resetViewport(setPan: (pan: { x: number; y: number }) => void, setZoom: (zoom: number) => void) {
  setPan({ x: 20, y: 20 });
  setZoom(0.85);
}

function noopUpdateNode() {
  return;
}

function noopFlowEdge() {
  return;
}

function tabForLintMessage(message: string): string {
  if (/variable/i.test(message)) return "variables";
  if (/achievement/i.test(message)) return "achievements";
  if (/asset/i.test(message)) return "assets";
  return "scenes";
}

function createGeneratedDocument(id: GeneratedDocumentId, project: ChoiceForgeProject) {
  if (id === "startup") {
    const preserved = project.startupSource !== undefined;
    return {
      title: "startup.txt",
      path: "mygame/startup.txt",
      description: preserved ? "Imported startup source preserved for safe export." : "Title, author, scene_list, variables, achievements, and exported initial scene.",
      content: generateStartupChoiceScript(project),
    };
  }

  if (id === "stats") {
    const preserved = project.statsSource !== undefined;
    return {
      title: "choicescript_stats.txt",
      path: "mygame/choicescript_stats.txt",
      description: preserved ? "Imported stats source preserved for safe export." : "Status screen generated from project variables and achievements.",
      content: generateStatsChoiceScript(project),
    };
  }

  const preserved = Boolean(project.sceneData?.[project.sceneTitle]?.sourceText);
  return {
    title: `${project.sceneTitle}.txt`,
    path: `mygame/${project.sceneTitle}.txt`,
    description: preserved ? "Imported ChoiceScript source preserved for safe export." : "ChoiceScript generated from the current scene graph.",
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

function confirmExportWithLintErrors(project: ChoiceForgeProject, lang: Language): boolean {
  const errors = project.lints.filter((lint) => lint.level === "error");
  if (!errors.length) return true;
  return window.confirm(lang === "pt"
    ? `O projeto tem ${errors.length} erro(s) de linter. Exportar mesmo assim?`
    : `The project has ${errors.length} linter error(s). Export anyway?`);
}

async function importChoiceForgeProject(files: File[], currentProject: ChoiceForgeProject, setProject: (project: ChoiceForgeProject) => void, onDone: () => void, lang: Language) {
  try {
    if (files.length === 0) return;
    if (files.length === 1 && isSceneTextFile(files[0])) {
      setProject(await importSingleSceneFile(currentProject, files[0]));
    } else if (files.length === 1 && files[0].name.toLowerCase().endsWith(".zip")) {
      const file = files[0];
      const entries = await extractZipEntries(new Uint8Array(await file.arrayBuffer()));
      const projectJson = entries.find((entry) => entry.name === "project.json" || entry.name.endsWith("/project.json"));
      if (projectJson) {
        const parsed = JSON.parse(new TextDecoder().decode(projectJson.bytes)) as ChoiceForgeProject;
        assertChoiceForgeProject(parsed);
        setProject(parsed);
      } else {
        setProject(importChoiceScriptArchive(entries));
      }
    } else if (files.length === 1 && files[0].name.toLowerCase().endsWith(".json")) {
      const file = files[0];
      const parsed = JSON.parse(await file.text()) as ChoiceForgeProject;
      assertChoiceForgeProject(parsed);
      setProject(parsed);
    } else {
      const entries = await selectedImportEntries(files);
      const projectJson = entries.find((entry) => isChoiceForgeProjectJsonPath(entry.name));
      if (projectJson) {
        const parsed = JSON.parse(new TextDecoder().decode(projectJson.bytes)) as ChoiceForgeProject;
        assertChoiceForgeProject(parsed);
        setProject(parsed);
      } else {
        const txtEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith(".txt"));
        if (!txtEntries.length) throw new Error("no text files selected");
        setProject(importChoiceScriptArchive(txtEntries));
      }
    }
    onDone();
  } catch (error) {
    console.error("ChoiceForge import failed", error);
    const reason = error instanceof Error && error.message ? `\n\n${error.message}` : "";
    window.alert((lang === "pt" ? "Nao foi possivel importar este projeto. Use um .zip ChoiceScript/ChoiceForge, project.json, ou selecione todos os arquivos .txt do projeto juntos." : "Could not import this project. Use a ChoiceScript/ChoiceForge .zip, project.json, or select all project .txt files together.") + reason);
  }
}

function isSceneTextFile(file: File): boolean {
  if (!file.name.toLowerCase().endsWith(".txt")) return false;
  const name = file.name.toLowerCase();
  return name !== "startup.txt" && name !== "choicescript_stats.txt";
}

async function importSingleSceneFile(project: ChoiceForgeProject, file: File): Promise<ChoiceForgeProject> {
  const sceneName = normalizeImportIdentifier(file.name.replace(/\.txt$/i, ""));
  const sourceText = await file.text();
  const graph = { ...importChoiceScriptSceneText(sceneName, sourceText, project.sceneData?.[sceneName]), sourceText };
  const existingScene = project.scenes.find((scene) => scene.name === sceneName && !scene.isStart && !scene.special);
  const sceneSummary = existingScene ?? { id: nextImportedSceneId(sceneName, project), name: sceneName, words: 0, nodes: graph.nodes.length };
  const scenes = existingScene
    ? project.scenes.map((scene) => (scene.id === existingScene.id ? { ...sceneSummary, current: true } : { ...scene, current: false }))
    : [
      ...project.scenes.filter((scene) => !scene.special).map((scene) => ({ ...scene, current: false })),
      { ...sceneSummary, current: true },
      ...project.scenes.filter((scene) => scene.special).map((scene) => ({ ...scene, current: false })),
    ];

  return {
    ...project,
    sceneTitle: sceneName,
    sceneSubtitle: `${sceneName}.txt - imported ChoiceScript`,
    scenes,
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: {
      ...(project.sceneData ?? {}),
      [sceneName]: graph,
    },
  };
}

function nextImportedSceneId(sceneName: string, project: ChoiceForgeProject): string {
  const existing = new Set(project.scenes.map((scene) => scene.id));
  let id = sceneName;
  let suffix = 2;
  while (existing.has(id)) {
    id = `${sceneName}_${suffix}`;
    suffix += 1;
  }
  return id;
}

async function selectedImportEntries(files: File[]) {
  return Promise.all(files.map(async (file) => ({
    name: selectedImportPath(file),
    bytes: new Uint8Array(await file.arrayBuffer()),
  })));
}

function selectedImportPath(file: File): string {
  const importFile = file as File & { choiceForgeRelativePath?: string; webkitRelativePath?: string };
  return importFile.choiceForgeRelativePath || importFile.webkitRelativePath || file.name;
}

function isChoiceForgeProjectJsonPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  return normalized === "_choiceforge/project.json" || normalized.endsWith("/_choiceforge/project.json");
}

function normalizeImportIdentifier(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.match(/^[a-z_]/) ? normalized : `_${normalized || "scene"}`;
}

function assertChoiceForgeProject(value: unknown): asserts value is ChoiceForgeProject {
  if (!value || typeof value !== "object") throw new Error("invalid project");
  const project = value as Partial<ChoiceForgeProject>;
  if (typeof project.title !== "string" || typeof project.author !== "string" || typeof project.sceneTitle !== "string") throw new Error("invalid metadata");
  if (!Array.isArray(project.scenes) || !Array.isArray(project.variables) || !Array.isArray(project.nodes) || !Array.isArray(project.edges)) throw new Error("invalid collections");
}

function extractZipEntries(bytes: Uint8Array) {
  const files = unzipSync(bytes);
  return Object.entries(files)
    .filter(([name]) => !name.endsWith("/"))
    .map(([name, fileBytes]) => ({ name, bytes: fileBytes }));
}

function createZipArchive(files: ReturnType<typeof createExportPackage>["files"]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const name = encoder.encode(file.path);
    const content = typeof file.content === "string" ? encoder.encode(file.content) : file.content;
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
