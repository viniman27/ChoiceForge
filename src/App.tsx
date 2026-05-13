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
import { importChoiceScriptArchive } from "./domain/choicescriptImport";
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
  const [selectedId, setSelectedId] = useState<string | null>("n1");
  const [activeTab, setActiveTab] = useState("scenes");
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [zoom, setZoom] = useState(0.85);
  const [view, setView] = useState<EditorView>("editor");
  const [generatedDocumentId, setGeneratedDocumentId] = useState<GeneratedDocumentId | null>(null);
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
    setPlayOpen(false);
    setPan(centerPanForNode(node, zoom, layout, consoleOpen));
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
          setPlayOpen(false);
          setSelectedId("n1");
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
        <GeneratedDocumentView
          {...generatedDocument}
          editable
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
        onSelectNode={focusNode}
      />
      <BottomBar
        data={lintedProject}
        labels={i18n[lang]}
        open={consoleOpen}
        onOpenChange={setConsoleOpen}
        onSelectIssue={(lint) => {
          const scene = lintedProject.scenes.find((candidate) => candidate.name === lint.scene);
          setGeneratedDocumentId(null);
          setPlayOpen(false);
          if (scene && !scene.isStart && !scene.special && scene.name !== lintedProject.sceneTitle) {
            actions.selectScene(scene.id);
          }
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

function tabForLintMessage(message: string): string {
  if (/variable/i.test(message)) return "variables";
  if (/achievement/i.test(message)) return "achievements";
  if (/asset/i.test(message)) return "assets";
  return "scenes";
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

function confirmExportWithLintErrors(project: ChoiceForgeProject, lang: Language): boolean {
  const errors = project.lints.filter((lint) => lint.level === "error");
  if (!errors.length) return true;
  return window.confirm(lang === "pt"
    ? `O projeto tem ${errors.length} erro(s) de linter. Exportar mesmo assim?`
    : `The project has ${errors.length} linter error(s). Export anyway?`);
}

async function importChoiceForgeProject(file: File, setProject: (project: ChoiceForgeProject) => void, onDone: () => void, lang: Language) {
  try {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const entries = await extractZipEntries(new Uint8Array(await file.arrayBuffer()));
      const projectJson = entries.find((entry) => entry.name === "project.json" || entry.name.endsWith("/project.json"));
      if (projectJson) {
        const parsed = JSON.parse(new TextDecoder().decode(projectJson.bytes)) as ChoiceForgeProject;
        assertChoiceForgeProject(parsed);
        setProject(parsed);
      } else {
        setProject(importChoiceScriptArchive(entries));
      }
    } else {
      const parsed = JSON.parse(await file.text()) as ChoiceForgeProject;
      assertChoiceForgeProject(parsed);
      setProject(parsed);
    }
    onDone();
  } catch {
    window.alert(lang === "pt" ? "Nao foi possivel importar este projeto. Use um .zip ChoiceScript/ChoiceForge ou o project.json." : "Could not import this project. Use a ChoiceScript/ChoiceForge .zip or project.json.");
  }
}

function assertChoiceForgeProject(value: unknown): asserts value is ChoiceForgeProject {
  if (!value || typeof value !== "object") throw new Error("invalid project");
  const project = value as Partial<ChoiceForgeProject>;
  if (typeof project.title !== "string" || typeof project.author !== "string" || typeof project.sceneTitle !== "string") throw new Error("invalid metadata");
  if (!Array.isArray(project.scenes) || !Array.isArray(project.variables) || !Array.isArray(project.nodes) || !Array.isArray(project.edges)) throw new Error("invalid collections");
}

async function extractZipEntries(bytes: Uint8Array) {
  const decoder = new TextDecoder();
  const entries: { name: string; bytes: Uint8Array }[] = [];
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    if (readU32(bytes, offset) !== 0x04034b50) break;
    const flags = readU16(bytes, offset + 6);
    const method = readU16(bytes, offset + 8);
    const compressedSize = readU32(bytes, offset + 18);
    const fileNameLength = readU16(bytes, offset + 26);
    const extraLength = readU16(bytes, offset + 28);
    const nameStart = offset + 30;
    const contentStart = nameStart + fileNameLength + extraLength;
    const contentEnd = contentStart + compressedSize;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + fileNameLength));

    if ((flags & 0x08) !== 0) throw new Error("unsupported streamed zip");
    if (contentEnd > bytes.length) throw new Error("invalid zip entry");
    const content = bytes.slice(contentStart, contentEnd);
    if (!name.endsWith("/")) {
      if (method === 0) entries.push({ name, bytes: content });
      else if (method === 8) entries.push({ name, bytes: await inflateRaw(content) });
      else throw new Error("unsupported compressed zip");
    }

    offset = contentEnd;
  }

  return entries;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toArrayBuffer(bytes)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
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

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
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
