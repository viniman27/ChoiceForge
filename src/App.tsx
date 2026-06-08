import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { unzipSync, zipSync, type ZipOptions } from "fflate";
import { BottomBar } from "./components/BottomBar";
import { Dashboard } from "./components/Dashboard";
import { CommandPalette } from "./components/CommandPalette";
import { TemplatesPalette } from "./components/TemplatesPalette";
import { HelpGuide } from "./components/HelpGuide";
import { ManuscriptView } from "./components/ManuscriptView";
import { NewProjectModal } from "./components/NewProjectModal";
import { SnapshotPanel } from "./components/SnapshotPanel";
import { SceneMapView } from "./components/SceneMapView";
import { GraphCanvas } from "./components/GraphCanvas";
import { LeftPanel } from "./components/LeftPanel";
import { OfficialPlayView } from "./components/OfficialPlayView";
import { PanelErrorBoundary } from "./components/PanelErrorBoundary";
import { RightPanel } from "./components/RightPanel";
import { TopBar } from "./components/TopBar";
import { ValidationView } from "./components/ValidationView";
import { i18n } from "./data/sampleProject";
import { createExportPackage, generateSceneChoiceScript, generateStartupChoiceScript, generateStatsChoiceScript } from "./domain/choicescript";
import { importChoiceScriptArchive, importChoiceScriptSceneText } from "./domain/choicescriptImport";
import { exportProjectAsDot } from "./domain/graphvizExport";
import type { ChoiceForgeProject, Density, EditorView, Language, StoryNode, Theme } from "./domain/types";
import { useProjectStore } from "./state/projectStore";
import { isTauri, nativeExportZip, nativeOpenProject, nativeOpenProjectAt, nativeSaveBytes, nativeSaveProject, nativeSaveProjectAs, nativeWriteProject, setWindowTitle } from "./platform/fileSystem";
import { addRecentFile, basenameOf, loadRecentFiles, removeRecentFile, type RecentFile } from "./platform/recentFiles";
import { checkForUpdate, dismissUpdate, installUpdate, isDismissed, isUpdateCheckOptedOut, setUpdateCheckOptOut, type InstallProgress, type UpdateInfo } from "./platform/updateCheck";

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
  const [validateOpen, setValidateOpen] = useState(false);
  const [layout, setLayout] = useState(loadLayout);
  const [resizeTarget, setResizeTarget] = useState<ResizeTarget | null>(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const currentFilePathRef = useRef<string | null>(null);
  currentFilePathRef.current = currentFilePath;
  const [dirtyOnDisk, setDirtyOnDisk] = useState(false);
  const lastWrittenSerialisedRef = useRef<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateOptedOut, setUpdateOptedOut] = useState(() => isUpdateCheckOptedOut());
  const { lintedProject, actions, snapshotIndex, isConvertingScene } = useProjectStore();

  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(() => isTauri() ? loadRecentFiles() : []);

  const applyOpenedProject = useCallback((path: string, content: string) => {
    try {
      const project = JSON.parse(content) as ChoiceForgeProject;
      actions.setProject(project);
      setCurrentFilePath(path);
      lastWrittenSerialisedRef.current = content;
      setDirtyOnDisk(false);
      setSelectedId("n1");
      setGeneratedDocumentId(null);
      setGeneratedDocumentLine(null);
      setPlayOpen(false);
      resetViewport(setPan, setZoom);
      const name = basenameOf(path);
      void setWindowTitle(`ChoiceForge — ${name}`);
      setSaveStatus(`Opened ${name}`);
      setRecentFiles(addRecentFile(path));
      return true;
    } catch {
      window.alert("Failed to parse project file. Make sure it is a valid ChoiceForge .json export.");
      return false;
    }
  }, [actions]);

  const handleNativeOpen = useCallback(async () => {
    const result = await nativeOpenProject();
    if (!result) return;
    applyOpenedProject(result.path, result.content);
  }, [applyOpenedProject]);

  const handleOpenRecent = useCallback(async (path: string) => {
    const result = await nativeOpenProjectAt(path);
    if (!result) {
      setRecentFiles(removeRecentFile(path));
      window.alert(`The file no longer exists at:\n${path}\n\nIt has been removed from Recent.`);
      return;
    }
    applyOpenedProject(result.path, result.content);
  }, [applyOpenedProject]);

  const handleClearRecent = useCallback(() => {
    setRecentFiles([]);
    try { window.localStorage.removeItem("choiceforge.recentFiles.v1"); } catch { /* ignore */ }
  }, []);

  const handleNativeSave = useCallback(async () => {
    const content = serializeProjectForDisk(lintedProject);
    const path = await nativeSaveProject(content, currentFilePathRef.current ?? undefined);
    if (!path) return;
    setCurrentFilePath(path);
    lastWrittenSerialisedRef.current = content;
    setDirtyOnDisk(false);
    const name = basenameOf(path);
    void setWindowTitle(`ChoiceForge — ${name}`);
    setSaveStatus(`Saved to ${name}`);
    setRecentFiles(addRecentFile(path));
  }, [lintedProject]);

  const handleNativeSaveAs = useCallback(async () => {
    const content = serializeProjectForDisk(lintedProject);
    const path = await nativeSaveProjectAs(content);
    if (!path) return;
    setCurrentFilePath(path);
    lastWrittenSerialisedRef.current = content;
    setDirtyOnDisk(false);
    const name = basenameOf(path);
    void setWindowTitle(`ChoiceForge — ${name}`);
    setSaveStatus(`Saved as ${name}`);
    setRecentFiles(addRecentFile(path));
  }, [lintedProject]);

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
        if (isTauri()) {
          void handleNativeSave();
        } else {
          actions.saveNow();
          setSaveStatus(formatSaveStatus(lang));
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        setTemplatesOpen((v) => !v);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "z") {
        if (isTypingTarget(event.target)) return;
        event.preventDefault();
        actions.redo();
        setSelectedId(null);
        setGeneratedDocumentId(null);
        setGeneratedDocumentLine(null);
        setPlayOpen(false);
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== "z") {
        if (event.key === "?" && !isTypingTarget(event.target)) {
          event.preventDefault();
          setHelpOpen((v) => !v);
        }
        return;
      }
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
  }, [actions, lang, handleNativeSave]);

  useEffect(() => {
    if (!saveStatus) return;
    const handle = window.setTimeout(() => setSaveStatus(""), 3500);
    return () => window.clearTimeout(handle);
  }, [saveStatus]);

  useEffect(() => {
    if (!isTauri()) return;
    const serialised = serializeProjectForDisk(lintedProject);
    if (lastWrittenSerialisedRef.current === null) {
      lastWrittenSerialisedRef.current = serialised;
      return;
    }
    if (serialised === lastWrittenSerialisedRef.current) {
      if (dirtyOnDisk) setDirtyOnDisk(false);
      return;
    }
    if (!dirtyOnDisk) setDirtyOnDisk(true);
    const path = currentFilePathRef.current;
    if (!path) return;
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          await nativeWriteProject(serialised, path);
          lastWrittenSerialisedRef.current = serialised;
          setDirtyOnDisk(false);
        } catch (err) {
          console.error("[ChoiceForge] desktop autosave failed", err);
        }
      })();
    }, 1500);
    return () => window.clearTimeout(handle);
  }, [lintedProject, dirtyOnDisk]);

  useEffect(() => {
    if (!isTauri()) return;
    const baseName = currentFilePath ? (currentFilePath.replace(/\\/g, "/").split("/").pop() ?? "project.json") : null;
    const prefix = dirtyOnDisk ? "● " : "";
    const title = baseName ? `${prefix}ChoiceForge — ${baseName}` : `${prefix}ChoiceForge`;
    void setWindowTitle(title);
  }, [currentFilePath, dirtyOnDisk]);

  useEffect(() => {
    let cancelled = false;
    let lastCheck = 0;
    const MIN_INTERVAL_MS = 5 * 60 * 1000;
    const run = async (force = false) => {
      if (!force && updateOptedOut) return;
      if (!force && Date.now() - lastCheck < MIN_INTERVAL_MS) return;
      lastCheck = Date.now();
      const info = await checkForUpdate(__APP_VERSION__);
      if (cancelled) return;
      if (info && (force || !isDismissed(info.version))) {
        setUpdateInfo(info);
      }
      return info;
    };
    if (!updateOptedOut) void run(false);
    // Re-check when the window regains focus — covers the case where a user
    // launched the app before a new release went live and would otherwise
    // never see the banner until they restart.
    const onFocus = () => { void run(false); };
    window.addEventListener("focus", onFocus);
    // Devtools hook so users can manually trigger a check without UI.
    (window as unknown as { __cfCheckForUpdate?: () => Promise<UpdateInfo | null | undefined> }).__cfCheckForUpdate = () => run(true);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [updateOptedOut]);

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
  const navigateToScene = useCallback((id: string) => {
    const scene = lintedProject.scenes.find((s) => s.id === id);
    if (!scene) return;
    setPlayOpen(false);
    if (scene.isStart) {
      setGeneratedDocumentId("startup");
      setGeneratedDocumentLine(null);
      setSelectedId(null);
    } else if (scene.special) {
      setGeneratedDocumentId("stats");
      setGeneratedDocumentLine(null);
      setSelectedId(null);
    } else {
      const hasPreserved = Boolean(lintedProject.sceneData?.[scene.name]?.sourceText);
      setGeneratedDocumentId(hasPreserved ? "scene" : null);
      setGeneratedDocumentLine(null);
      actions.selectScene(id);
      setSelectedId(hasPreserved ? null : "n1");
    }
    setView("editor");
  }, [lintedProject, actions]);

  const confirmVisualConversion = () => {
    const confirmed = window.confirm(
      "Convert this imported scene to visual editing?\n\nExport will stop using the preserved .txt source and will use the current visual graph instead. The preserved source remains in undo history, but this conversion can lose ChoiceScript constructs the visual importer does not fully model.",
    );
    if (!confirmed) return;
    actions.convertCurrentSceneToVisual();
    setPlayOpen(false);
    setSelectedId("n1");
  };

  useEffect(() => {
    if (!isConvertingScene) {
      const graph = lintedProject.sceneData?.[lintedProject.sceneTitle];
      if (graph && !graph.sourceText && generatedDocumentId === "scene") {
        setGeneratedDocumentId(null);
        setGeneratedDocumentLine(null);
      }
    }
  }, [isConvertingScene]);

  return (
    <div className={`app ${resizeTarget ? "is-resizing" : ""}`} data-bot-open={consoleOpen ? "true" : "false"} style={appStyle}>
      <DevBadge />
      {updateInfo && (
        <UpdateBanner
          info={updateInfo}
          onDismiss={() => { dismissUpdate(updateInfo.version); setUpdateInfo(null); }}
          onTurnOff={() => { setUpdateCheckOptOut(true); setUpdateOptedOut(true); setUpdateInfo(null); }}
        />
      )}
      <TopBar
        data={lintedProject}
        lang={lang}
        labels={i18n[lang]}
        theme={theme}
        density={density}
        view={view}
        selectedNodeTitle={selectedNode?.title ?? undefined}
        onLangChange={setLang}
        onThemeChange={setTheme}
        onDensityChange={setDensity}
        onViewChange={setView}
        onMetadataChange={actions.updateMetadata}
        canUndo={actions.canUndo}
        canRedo={actions.canRedo}
        textModeActive={generatedDocumentId === "scene"}
        onUndo={() => {
          actions.undo();
          setSelectedId(null);
          setGeneratedDocumentId(null);
          setGeneratedDocumentLine(null);
          setPlayOpen(false);
        }}
        onRedo={() => {
          actions.redo();
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
          setValidateOpen(false);
          setGeneratedDocumentId(null);
          setGeneratedDocumentLine(null);
          setSelectedId(null);
        }}
        onValidate={() => {
          setValidateOpen(true);
          setPlayOpen(false);
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
        onExportDot={() => downloadGraphvizDot(lintedProject)}
        onSnapshots={() => setSnapshotsOpen(true)}
        onNewProject={() => setNewProjectOpen(true)}
        onHelp={() => setHelpOpen(true)}
        currentFilePath={currentFilePath}
        onNativeOpen={isTauri() ? handleNativeOpen : undefined}
        onNativeSave={isTauri() ? handleNativeSave : undefined}
        onNativeSaveAs={isTauri() ? handleNativeSaveAs : undefined}
        recentFiles={isTauri() ? recentFiles : undefined}
        onOpenRecent={isTauri() ? handleOpenRecent : undefined}
        onClearRecent={isTauri() ? handleClearRecent : undefined}
      />
      <PanelErrorBoundary panelName="Left panel">
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
        onMoveVariable={actions.moveVariable}
        onAddAchievement={actions.addAchievement}
        onUpdateAchievement={actions.updateAchievement}
        onDeleteAchievement={actions.deleteAchievement}
        onMoveAchievement={actions.moveAchievement}
        onAddAsset={actions.addAsset}
        onUpdateAsset={actions.updateAsset}
        onDeleteAsset={actions.deleteAsset}
        onSelectNode={focusNode}
        onNavigateToNode={(sceneName, nodeId) => {
          const scene = lintedProject.scenes.find((s) => s.name === sceneName);
          if (scene) navigateToScene(scene.id);
          setTimeout(() => focusNode(nodeId), 0);
        }}
        onReplace={actions.replaceInNodes}
      />
      </PanelErrorBoundary>
      <button
        className="resize-handle resize-handle-left"
        type="button"
        aria-label="resize left panel"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setResizeTarget("left");
        }}
      />
      <PanelErrorBoundary panelName="Canvas / editor">
      {validateOpen ? (
        <ValidationView project={lintedProject} onClose={() => setValidateOpen(false)} />
      ) : playOpen ? (
        <OfficialPlayView project={lintedProject} onClose={() => setPlayOpen(false)} />
      ) : generatedDocument ? (
        <Suspense fallback={<section className="generated-doc generated-doc-loading">Loading editor...</section>}>
          <GeneratedDocumentView
            {...generatedDocument}
            editable
            targetLine={generatedDocumentLine}
            sourcePreserved={generatedDocumentId === "scene" && currentSceneSourcePreserved}
            isConverting={isConvertingScene}
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
          onMoveNodes={actions.moveNodes}
          onLayoutNodes={actions.layoutNodes}
          onResizeNode={(id, w) => actions.updateNode(id, { w })}
          onConnectNodes={actions.connectNodes}
          onAddNode={(type, position) => {
            const id = nextNodeId(lintedProject.nodes);
            actions.addNode(type, id, position, lang);
            setSelectedId(id);
          }}
          onAddAndConnectNode={(fromId, type, position) => {
            const id = nextNodeId(lintedProject.nodes);
            actions.addNode(type, id, position, lang);
            actions.connectNodes(fromId, id);
            setSelectedId(id);
          }}
          onUpdateTitle={(id, title) => actions.updateNode(id, { title })}
          onDuplicateNode={(id) => {
            const newId = actions.duplicateNode(id);
            if (newId) setSelectedId(newId);
          }}
          onDeleteNodes={(ids) => {
            actions.deleteNodes(ids);
            setSelectedId(null);
          }}
          onPasteNodes={(nodes, edges, center) => {
            const newIds = actions.pasteNodes(nodes, edges, center);
            if (newIds[0]) setSelectedId(newIds[0]);
            return newIds;
          }}
          onBulkUpdateNodes={actions.bulkUpdateNodes}
          sourcePreserved={currentSceneSourcePreserved}
          onConvertSource={confirmVisualConversion}
          onNavigateToScene={(sceneName) => {
            const scene = lintedProject.scenes.find((s) => s.name === sceneName);
            if (scene) navigateToScene(scene.id);
          }}
          isConvertingScene={isConvertingScene}
        />
      )}
      </PanelErrorBoundary>
      <button
        className="resize-handle resize-handle-right"
        type="button"
        aria-label="resize right panel"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setResizeTarget("right");
        }}
      />
      <PanelErrorBoundary panelName="Inspector">
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
        onSelectScene={(id) => {
          const scene = lintedProject.scenes.find((s) => s.id === id);
          if (!scene) return;
          setPlayOpen(false);
          const hasPreserved = Boolean(!scene.isStart && !scene.special && lintedProject.sceneData?.[scene.name]?.sourceText);
          setGeneratedDocumentId(hasPreserved ? "scene" : null);
          setGeneratedDocumentLine(null);
          actions.selectScene(id);
          setSelectedId(hasPreserved ? null : "n1");
        }}
      />
      </PanelErrorBoundary>
      <BottomBar
        data={lintedProject}
        labels={i18n[lang]}
        lang={lang}
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
      {view === "manuscript" && <ManuscriptView data={lintedProject} onClose={() => setView("editor")} onNavigateToNode={(sceneName, nodeId) => { const scene = lintedProject.scenes.find((s) => s.name === sceneName); if (scene) navigateToScene(scene.id); setSelectedId(nodeId); setView("editor"); }} />}
      {view === "dashboard" && <Dashboard data={lintedProject} labels={i18n[lang]} onClose={() => setView("editor")} onUpdateWordGoal={(goal) => actions.updateMetadata({ wordGoal: goal })} onUpdateSceneGoal={(id, goal) => actions.updateSceneMetadata(id, { wordGoal: goal })} onNavigateToNode={(sceneName, nodeId) => { const scene = lintedProject.scenes.find((s) => s.name === sceneName); if (scene) navigateToScene(scene.id); setSelectedId(nodeId); setView("editor"); }} />}
      {view === "map" && (
        <SceneMapView
          data={lintedProject}
          labels={i18n[lang]}
          activeSceneId={activeSceneId}
          onSelectScene={navigateToScene}
        />
      )}
      {snapshotsOpen && (
        <SnapshotPanel
          snapshots={snapshotIndex}
          labels={i18n[lang]}
          onSave={(name) => actions.saveSnapshot(name)}
          onRestore={(id) => { actions.restoreSnapshot(id); setSelectedId(null); setGeneratedDocumentId(null); setGeneratedDocumentLine(null); setPlayOpen(false); }}
          onDelete={(id) => actions.deleteSnapshot(id)}
          onClose={() => setSnapshotsOpen(false)}
        />
      )}
      {helpOpen && <HelpGuide onClose={() => setHelpOpen(false)} />}
      {newProjectOpen && (
        <NewProjectModal
          labels={i18n[lang]}
          onBlank={(title, author) => {
            actions.newBlankProject(title, author);
            setSaveStatus(formatSaveStatus(lang));
            setGeneratedDocumentId(null);
            setGeneratedDocumentLine(null);
            setPlayOpen(false);
            setSelectedId("n1");
            resetViewport(setPan, setZoom);
            setNewProjectOpen(false);
          }}
          onExample={() => {
            actions.resetProject(lang);
            setSaveStatus(formatSaveStatus(lang));
            setGeneratedDocumentId(null);
            setGeneratedDocumentLine(null);
            setPlayOpen(false);
            setSelectedId("n1");
            resetViewport(setPan, setZoom);
            setNewProjectOpen(false);
          }}
          onClose={() => setNewProjectOpen(false)}
        />
      )}
      {paletteOpen && (
        <CommandPalette
          project={lintedProject}
          onClose={() => setPaletteOpen(false)}
          onSelectScene={(id) => { navigateToScene(id); }}
          onSelectNode={(sceneId, nodeId) => {
            const scene = lintedProject.scenes.find((s) => s.id === sceneId);
            if (!scene) return;
            setPlayOpen(false);
            setGeneratedDocumentId(null);
            setGeneratedDocumentLine(null);
            setView("editor");
            if (scene.name !== lintedProject.sceneTitle) {
              actions.selectScene(sceneId);
              setSelectedId(nodeId);
            } else {
              focusNode(nodeId);
            }
          }}
          onCommand={(cmd) => {
            if (cmd === "layout") { actions.layoutNodes(); }
            else if (cmd === "fit") { resetViewport(setPan, setZoom); }
            else if (cmd === "dashboard") { setView("dashboard"); }
            else if (cmd === "map") { setView("map"); }
            else if (cmd === "manuscript") { setView("manuscript"); }
            else if (cmd === "play") { setPlayOpen(true); setGeneratedDocumentId(null); setGeneratedDocumentLine(null); setSelectedId(null); }
            else if (cmd === "export") { if (confirmExportWithLintErrors(lintedProject, lang)) downloadGeneratedProject(lintedProject); }
            else if (cmd === "save") { actions.saveNow(); setSaveStatus(formatSaveStatus(lang)); }
            else if (cmd === "undo") { actions.undo(); setSelectedId(null); setGeneratedDocumentId(null); setGeneratedDocumentLine(null); setPlayOpen(false); }
            else if (cmd === "redo") { actions.redo(); setSelectedId(null); setGeneratedDocumentId(null); setGeneratedDocumentLine(null); setPlayOpen(false); }
            else if (cmd === "shortcuts") { setHelpOpen(true); }
          }}
        />
      )}
      {templatesOpen && (
        <TemplatesPalette
          lang={lang}
          labels={i18n[lang]}
          onPick={(template) => {
            // Center the template on the rough viewport center in world coords.
            const cx = Math.round((window.innerWidth / 2 - pan.x) / zoom);
            const cy = Math.round((window.innerHeight / 2 - pan.y) / zoom);
            const newIds = actions.pasteNodes(
              JSON.parse(JSON.stringify(template.nodes)),
              JSON.parse(JSON.stringify(template.edges)),
              { x: cx, y: cy },
            );
            if (newIds[0]) setSelectedId(newIds[0]);
          }}
          onClose={() => setTemplatesOpen(false)}
        />
      )}
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
  const locale = lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US";
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
  if (lang === "pt") return `Salvo localmente ${time}`;
  if (lang === "es") return `Guardado localmente ${time}`;
  return `Saved locally ${time}`;
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
  const suggestedName = `${project.title}.zip`;
  if (isTauri()) {
    void nativeExportZip(zipBytes, suggestedName).catch((err) => {
      console.error("[ChoiceForge] native export failed", err);
      window.alert(`Export failed: ${err?.message ?? String(err)}`);
    });
    return;
  }
  const blob = new Blob([toArrayBuffer(zipBytes)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadGraphvizDot(project: ChoiceForgeProject) {
  const dot = exportProjectAsDot(project);
  const bytes = new TextEncoder().encode(dot);
  const suggestedName = `${(project.title || "choiceforge-project").replace(/[^a-zA-Z0-9._-]/g, "_")}.dot`;
  if (isTauri()) {
    void nativeSaveBytes(bytes, suggestedName, "Graphviz DOT", ["dot"]).catch((err) => {
      console.error("[ChoiceForge] .dot export failed", err);
      window.alert(`Export failed: ${err?.message ?? String(err)}`);
    });
    return;
  }
  const blob = new Blob([bytes], { type: "text/vnd.graphviz" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function confirmReplaceProject(project: ChoiceForgeProject, lang: Language): boolean {
  if (project.nodes.length <= 1 && !project.variables.length && !project.achievements.length) return true;
  return window.confirm(
    lang === "pt" ? "Isso substituira o projeto atual. Continuar?"
    : lang === "es" ? "Esto reemplazara el proyecto actual. ¿Continuar?"
    : "This will replace the current project. Continue?"
  );
}

function confirmExportWithLintErrors(project: ChoiceForgeProject, lang: Language): boolean {
  const errors = project.lints.filter((lint) => lint.level === "error");
  if (!errors.length) return true;
  return window.confirm(
    lang === "pt" ? `O projeto tem ${errors.length} erro(s) de linter. Exportar mesmo assim?`
    : lang === "es" ? `El proyecto tiene ${errors.length} error(es) de linter. ¿Exportar de todas formas?`
    : `The project has ${errors.length} linter error(s). Export anyway?`
  );
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
        if (!confirmReplaceProject(currentProject, lang)) return;
        setProject(parsed);
      } else {
        if (!confirmReplaceProject(currentProject, lang)) return;
        setProject(importChoiceScriptArchive(entries));
      }
    } else if (files.length === 1 && files[0].name.toLowerCase().endsWith(".json")) {
      const file = files[0];
      const parsed = JSON.parse(await file.text()) as ChoiceForgeProject;
      assertChoiceForgeProject(parsed);
      if (!confirmReplaceProject(currentProject, lang)) return;
      setProject(parsed);
    } else {
      const entries = await selectedImportEntries(files);
      const projectJson = entries.find((entry) => isChoiceForgeProjectJsonPath(entry.name));
      if (projectJson) {
        const parsed = JSON.parse(new TextDecoder().decode(projectJson.bytes)) as ChoiceForgeProject;
        assertChoiceForgeProject(parsed);
        if (!confirmReplaceProject(currentProject, lang)) return;
        setProject(parsed);
      } else {
        const txtEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith(".txt"));
        if (!txtEntries.length) throw new Error("no text files selected");
        if (!confirmReplaceProject(currentProject, lang)) return;
        setProject(importChoiceScriptArchive(txtEntries));
      }
    }
    onDone();
  } catch (error) {
    console.error("ChoiceForge import failed", error);
    const reason = error instanceof Error && error.message ? `\n\n${error.message}` : "";
    const importMsg = lang === "pt"
      ? "Nao foi possivel importar este projeto. Use um .zip ChoiceScript/ChoiceForge, project.json, ou selecione todos os arquivos .txt do projeto juntos."
      : lang === "es"
      ? "No se pudo importar este proyecto. Use un .zip de ChoiceScript/ChoiceForge, project.json, o seleccione todos los archivos .txt del proyecto juntos."
      : "Could not import this project. Use a ChoiceScript/ChoiceForge .zip, project.json, or select all project .txt files together.";
    window.alert(importMsg + reason);
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

const LARGE_ZIP_BYTES = 256 * 1024;

function extractZipEntries(bytes: Uint8Array): Promise<{ name: string; bytes: Uint8Array }[]> {
  if (bytes.byteLength <= LARGE_ZIP_BYTES) {
    return Promise.resolve(extractZipEntriesSync(bytes));
  }
  return extractZipEntriesViaWorker(bytes).catch(() => extractZipEntriesSync(bytes));
}

function extractZipEntriesSync(bytes: Uint8Array) {
  const files = unzipSync(bytes);
  return Object.entries(files)
    .filter(([name]) => !name.endsWith("/"))
    .map(([name, fileBytes]) => ({ name, bytes: fileBytes }));
}

function extractZipEntriesViaWorker(bytes: Uint8Array): Promise<{ name: string; bytes: Uint8Array }[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./workers/zipParser.ts", import.meta.url), { type: "module" });
    const timer = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("zip parse worker timeout"));
    }, 30000);
    worker.onmessage = (event: MessageEvent<import("./workers/zipParser.ts").ZipParseResponse>) => {
      window.clearTimeout(timer);
      worker.terminate();
      if (!event.data.ok || !event.data.entries) {
        reject(new Error(event.data.error ?? "zip parse failed"));
        return;
      }
      resolve(event.data.entries);
    };
    worker.onerror = (err) => {
      window.clearTimeout(timer);
      worker.terminate();
      reject(err.error ?? new Error("zip parse worker error"));
    };
    worker.postMessage({ bytes });
  });
}

function createZipArchive(files: ReturnType<typeof createExportPackage>["files"]): Uint8Array {
  const encoder = new TextEncoder();
  const entries: Record<string, [Uint8Array, ZipOptions]> = {};
  files.forEach((file) => {
    const content = typeof file.content === "string" ? encoder.encode(file.content) : file.content;
    const options: ZipOptions = isAlreadyCompressed(file.path) ? { level: 0 } : { level: 6 };
    entries[file.path] = [content, options];
  });
  return zipSync(entries);
}

function isAlreadyCompressed(path: string): boolean {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  return ["png", "jpg", "jpeg", "gif", "webp", "mp3", "ogg", "mp4", "m4a", "aac", "zip"].includes(ext);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function serializeProjectForDisk(project: ChoiceForgeProject): string {
  const { lints: _lints, ...rest } = project;
  return JSON.stringify({ ...rest, lints: [] }, null, 2);
}

function UpdateBanner({ info, onDismiss, onTurnOff }: { info: UpdateInfo; onDismiss: () => void; onTurnOff: () => void }) {
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openRelease = () => {
    window.open(info.url, "_blank", "noopener,noreferrer");
  };
  const installAndRestart = async () => {
    setError(null);
    setProgress({ phase: "downloading", downloaded: 0, total: null });
    const ok = await installUpdate(setProgress);
    if (!ok) {
      setProgress(null);
      setError("Install failed — opening the release page instead.");
      openRelease();
    }
  };

  if (progress) {
    const pct = progress.phase === "downloading" && progress.total
      ? Math.round((progress.downloaded ?? 0) / progress.total * 100)
      : null;
    const label = progress.phase === "downloading"
      ? (pct !== null ? `Downloading ${pct}%` : "Downloading…")
      : progress.phase === "installing" ? "Installing…" : "Restarting…";
    return (
      <div className="update-banner" role="status">
        <span className="update-banner-icon" aria-hidden="true">⬆</span>
        <span className="update-banner-text"><strong>{label}</strong></span>
      </div>
    );
  }

  return (
    <div className="update-banner" role="status">
      <span className="update-banner-icon" aria-hidden="true">⬆</span>
      <span className="update-banner-text">
        <strong>ChoiceForge {info.version}</strong> is available.
        {error && <span className="update-banner-error"> {error}</span>}
      </span>
      {info.canAutoInstall ? (
        <button className="update-banner-cta" onClick={() => void installAndRestart()}>Install &amp; restart</button>
      ) : (
        <button className="update-banner-cta" onClick={openRelease}>View release</button>
      )}
      {info.canAutoInstall && (
        <button className="update-banner-btn" onClick={openRelease} title="Open release notes in browser">Notes</button>
      )}
      <button className="update-banner-btn" onClick={onDismiss} title="Dismiss until next release">Later</button>
      <button className="update-banner-btn" onClick={onTurnOff} title="Stop checking for updates">Turn off</button>
    </div>
  );
}

function nextNodeId(nodes: StoryNode[]): string {
  const max = nodes.reduce((currentMax, node) => {
    const match = /^n(\d+)$/.exec(node.id);
    return match ? Math.max(currentMax, Number(match[1])) : currentMax;
  }, 0);
  return `n${max + 1}`;
}

function isDevPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  if (isTauri()) return false;
  const host = window.location.hostname;
  if (host === "choiceforge.pages.dev") return false;
  if (host === "localhost" || host === "127.0.0.1") return false;
  return host.endsWith(".pages.dev");
}

function DevBadge() {
  if (!isDevPreviewHost()) return null;
  return (
    <a
      className="dev-badge"
      href="https://choiceforge.pages.dev"
      title="You're on the dev preview — click to go to production"
      rel="noopener"
    >
      DEV
    </a>
  );
}
