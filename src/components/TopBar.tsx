import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import type { ChoiceForgeProject, Density, EditorView, I18nLabels, Language, Theme } from "../domain/types";
import { basenameOf, type RecentFile } from "../platform/recentFiles";
import { COLOR_TAG_VALUES } from "./NodeCard";
import "./TopBar.css";

export interface TopBarProps {
  data: ChoiceForgeProject;
  lang: Language;
  labels: I18nLabels;
  theme: Theme;
  density: Density;
  view: EditorView;
  selectedNodeTitle?: string;
  onLangChange: (lang: Language) => void;
  onThemeChange: (theme: Theme) => void;
  onDensityChange: (density: Density) => void;
  onViewChange: (view: EditorView) => void;
  onMetadataChange: (patch: Partial<Pick<ChoiceForgeProject, "title" | "author" | "wordGoal">>) => void;
  canUndo: boolean;
  canRedo: boolean;
  textModeActive: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  saveStatus: string;
  onTextMode: () => void;
  onPlay: () => void;
  onValidate: () => void;
  onImport: (files: File[]) => void;
  onExport: () => void;
  onExportDot: () => void;
  onExportGame?: () => void;
  onSaveProjectFile?: () => void;
  onNewProject: () => void;
  onSnapshots: () => void;
  onHelp: () => void;
  currentFilePath?: string | null;
  onNativeOpen?: () => void;
  onNativeSave?: () => void;
  onNativeSaveAs?: () => void;
  recentFiles?: RecentFile[];
  onOpenRecent?: (path: string) => void;
  onClearRecent?: () => void;
}

export function TopBar({ data, lang, labels, theme, density, view, selectedNodeTitle, onLangChange, onThemeChange, onDensityChange, onViewChange, onMetadataChange, canUndo, canRedo, textModeActive, onUndo, onRedo, onSave, saveStatus, onTextMode, onPlay, onValidate, onImport, onExport, onExportDot, onExportGame, onSaveProjectFile, onNewProject, onSnapshots, onHelp, currentFilePath, onNativeOpen, onNativeSave, onNativeSaveAs, recentFiles, onOpenRecent, onClearRecent }: TopBarProps) {
  const ui = useTopBarUiState();
  const menuLabels = getTopBarMenuLabels(lang);
  const saveProject = onSaveProjectFile ?? onNativeSave ?? onSave;
  const openProject = onNativeOpen ?? (() => void openImportPicker(onImport));
  const openFilesLabel = onNativeOpen ? menuLabels.openProject : menuLabels.openOrImportFiles;
  const openFilesHint = onNativeOpen ? menuLabels.openProjectHint : menuLabels.openOrImportFilesHint;

  return (
    <header className="top-bar">
      <div className="brand">
        <div className="brand-mark">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 4 L11 2 L19 4 L19 14 L11 20 L3 14 Z" fill="var(--accent-1)" stroke="var(--ink)" strokeWidth="1.2" />
            <path d="M8 9 L11 7 L14 9 L14 13 L11 15 L8 13 Z" fill="var(--paper-1)" stroke="var(--ink)" strokeWidth="1" />
          </svg>
        </div>
        <div className="brand-text">
          <span className="brand-name">ChoiceForge</span>
          <span className="brand-project-edit">
            <input
              value={data.title}
              aria-label="project title"
              placeholder="title"
              title={data.title || "Project title"}
              onChange={(event) => onMetadataChange({ title: event.target.value, author: data.author })}
            />
            <span className="dim">/</span>
            <input
              value={data.author}
              aria-label="project author"
              placeholder="author"
              title={data.author || "Project author"}
              onChange={(event) => onMetadataChange({ title: data.title, author: event.target.value })}
            />
          </span>
        </div>
      </div>

      <div className="bread">
        <div className="tab-toggle">
          <button className={view === "editor" ? "is-active" : ""} onClick={() => onViewChange("editor")}>editor</button>
          <button className={view === "map" ? "is-active" : ""} onClick={() => onViewChange("map")}>map</button>
          <button className={view === "manuscript" ? "is-active" : ""} onClick={() => onViewChange("manuscript")}>prose</button>
          <button className={view === "dashboard" ? "is-active" : ""} onClick={() => onViewChange("dashboard")}>stats</button>
        </div>
        <code style={{ marginLeft: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          {(() => {
            const s = data.scenes.find((scene) => scene.name === data.sceneTitle || scene.id === data.sceneTitle);
            return s?.colorTag ? <span className="breadcrumb-scene-dot" style={{ "--ct": COLOR_TAG_VALUES[s.colorTag] } as CSSProperties} /> : null;
          })()}
          {data.sceneTitle}
        </code>
        {selectedNodeTitle && (
          <>
            <span className="dim">/</span>
            <code className="breadcrumb-node">{selectedNodeTitle}</code>
          </>
        )}
      </div>

      <div className="top-actions">
        <MenuButton label={menuLabels.file}>
          <MenuAction label={menuLabels.newProject} hint={menuLabels.newProjectHint} onSelect={onNewProject} />
          <MenuAction label={openFilesLabel} hint={openFilesHint} onSelect={openProject} />
          {onNativeOpen && <RecentFilesMenuItems recentFiles={recentFiles ?? []} onOpenRecent={onOpenRecent} onClearRecent={onClearRecent} recentLabel={labels.topOpenRecent} clearLabel={labels.topOpenRecentClear} emptyLabel={labels.topOpenRecentEmpty} />}
          <MenuAction label={menuLabels.saveProject} hint={menuLabels.saveProjectHint} onSelect={saveProject} />
          {onNativeSaveAs && <MenuAction label={menuLabels.saveProjectAs} hint={menuLabels.saveProjectAsHint} onSelect={onNativeSaveAs} />}
          <MenuSeparator />
          {onNativeOpen && <MenuAction label={menuLabels.importText} hint={menuLabels.importTextHint} onSelect={() => void openImportPicker(onImport)} />}
          <MenuAction label={menuLabels.importFolder} hint={menuLabels.importFolderHint} onSelect={() => void openImportFolderPicker(onImport)} />
          <MenuSeparator />
          <MenuAction label={menuLabels.exportZip} hint={menuLabels.exportZipHint} onSelect={onExport} />
          <MenuAction label={menuLabels.exportGame} hint={menuLabels.exportGameHint} onSelect={onExportGame} disabled={!onExportGame} />
          <MenuAction label={menuLabels.exportDot} hint={menuLabels.exportDotHint} onSelect={onExportDot} />
          <MenuSeparator />
          <MenuAction label={menuLabels.snapshots} hint={labels.snapTitle} onSelect={onSnapshots} />
        </MenuButton>
        <MenuButton label={menuLabels.interfaceMenu}>
          <MenuAction label={menuLabels.zoomOut} hint="Ctrl+-" onSelect={ui.zoomOut} />
          <MenuAction label={menuLabels.zoomIn} hint="Ctrl++" onSelect={ui.zoomIn} />
          <MenuAction label={menuLabels.zoomReset} hint="Ctrl+0" onSelect={ui.zoomReset} />
          <MenuSeparator />
          <MenuAction label="Zoom 100%" onSelect={() => ui.setZoom(1)} />
          <MenuAction label="Zoom 125%" onSelect={() => ui.setZoom(1.25)} />
          <MenuAction label="Zoom 150%" onSelect={() => ui.setZoom(1.5)} />
          <MenuSeparator />
          <MenuCheckbox label={menuLabels.leftPanel} checked={ui.leftPanelVisible} onSelect={() => ui.setLeftPanelVisible((value) => !value)} />
          <MenuCheckbox label={menuLabels.rightPanel} checked={ui.rightPanelVisible} onSelect={() => ui.setRightPanelVisible((value) => !value)} />
        </MenuButton>
        <select className="ghost-btn" aria-label={menuLabels.language} title={menuLabels.language} value={lang} onChange={(event) => onLangChange(event.target.value as Language)}>
          <option value="pt">PT-BR</option>
          <option value="en">EN</option>
          <option value="es">ES</option>
        </select>
        <select className="ghost-btn" aria-label={menuLabels.theme} title={menuLabels.theme} value={theme} onChange={(event) => onThemeChange(event.target.value as Theme)}>
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
        <select className="ghost-btn" aria-label={menuLabels.density} title={menuLabels.density} value={density} onChange={(event) => onDensityChange(event.target.value as Density)}>
          <option value="minimal">minimal</option>
          <option value="medium">medium</option>
          <option value="rich">rich</option>
        </select>
        <button className={`ghost-btn ${textModeActive ? "is-active" : ""}`} onClick={onTextMode}>{textModeActive ? labels.topBoardToggle : labels.topTextToggle}</button>
        <button className="ghost-btn" onClick={onUndo} disabled={!canUndo} title="Ctrl+Z">{labels.topUndo}</button>
        <button className="ghost-btn" onClick={onRedo} disabled={!canRedo} title="Ctrl+Shift+Z">{labels.topRedo}</button>
        {onNativeSave ? (
          <button className="ghost-btn" onClick={onNativeSave} title={`${labels.topSave} (Ctrl+S)`}>{labels.topSave}</button>
        ) : (
          <button className="ghost-btn" onClick={onSave} title="Ctrl+S">{labels.topSave}</button>
        )}
        {saveStatus && <span className="save-status">{saveStatus}</span>}
        <button
          className="ghost-btn"
          onClick={onValidate}
          title="Run Quicktest / Randomtest (Choice of Games submission requirements)"
        >
          ✓ Validate
        </button>
        <button className="play-btn" onClick={onPlay}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor"><path d="M2 1l8 4.5-8 4.5z" /></svg>
          {labels.play}
        </button>
        <button className="ghost-btn hg-help-btn" onClick={onHelp} title="Help guide (?)">?</button>
      </div>
    </header>
  );
}

const UI_ZOOM_STORAGE_KEY = "choiceforge.uiZoom";
const UI_LEFT_PANEL_STORAGE_KEY = "choiceforge.leftPanelVisible";
const UI_RIGHT_PANEL_STORAGE_KEY = "choiceforge.rightPanelVisible";
const UI_ZOOM_MIN = 0.8;
const UI_ZOOM_MAX = 1.5;
const UI_ZOOM_STEP = 0.1;

function useTopBarUiState() {
  const [zoom, setZoomRaw] = useState(() => readStoredZoom());
  const [leftPanelVisible, setLeftPanelVisible] = useState(() => readStoredBoolean(UI_LEFT_PANEL_STORAGE_KEY, true));
  const [rightPanelVisible, setRightPanelVisible] = useState(() => readStoredBoolean(UI_RIGHT_PANEL_STORAGE_KEY, true));

  const setZoom = (value: number | ((current: number) => number)) => {
    setZoomRaw((current) => clampZoom(typeof value === "function" ? value(current) : value));
  };

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--cf-ui-zoom", String(zoom));
    root.setAttribute("data-cf-ui-zoom", String(Math.round(zoom * 100)));
    window.localStorage.setItem(UI_ZOOM_STORAGE_KEY, String(zoom));
  }, [zoom]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-cf-left-panel", leftPanelVisible ? "visible" : "hidden");
    window.localStorage.setItem(UI_LEFT_PANEL_STORAGE_KEY, leftPanelVisible ? "1" : "0");
  }, [leftPanelVisible]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-cf-right-panel", rightPanelVisible ? "visible" : "hidden");
    window.localStorage.setItem(UI_RIGHT_PANEL_STORAGE_KEY, rightPanelVisible ? "1" : "0");
  }, [rightPanelVisible]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || isEditableTarget(event.target)) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoom((current) => current + UI_ZOOM_STEP);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setZoom((current) => current - UI_ZOOM_STEP);
      } else if (event.key === "0") {
        event.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return {
    zoom,
    setZoom,
    zoomIn: () => setZoom((current) => current + UI_ZOOM_STEP),
    zoomOut: () => setZoom((current) => current - UI_ZOOM_STEP),
    zoomReset: () => setZoom(1),
    leftPanelVisible,
    rightPanelVisible,
    setLeftPanelVisible,
    setRightPanelVisible,
  };
}

function readStoredZoom() {
  const stored = Number(window.localStorage.getItem(UI_ZOOM_STORAGE_KEY));
  return clampZoom(Number.isFinite(stored) && stored > 0 ? stored : 1);
}

function clampZoom(value: number) {
  return Math.round(Math.min(UI_ZOOM_MAX, Math.max(UI_ZOOM_MIN, value)) * 100) / 100;
}

function readStoredBoolean(key: string, fallback: boolean) {
  const stored = window.localStorage.getItem(key);
  if (stored === "1") return true;
  if (stored === "0") return false;
  return fallback;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

function getTopBarMenuLabels(lang: Language) {
  if (lang === "pt") {
    return {
      file: "Arquivo",
      interfaceMenu: "Interface",
      newProject: "Novo projeto",
      newProjectHint: "Cria um projeto ChoiceForge vazio.",
      openProject: "Abrir projeto / importar JSON",
      openProjectHint: "Abre arquivo nativo no desktop ou importa .json/.zip/.txt no navegador.",
      openOrImportFiles: "Abrir/importar arquivos",
      openOrImportFilesHint: "Seleciona .json, .zip ou cenas .txt no navegador.",
      saveProject: "Salvar projeto",
      saveProjectHint: "Salva o arquivo de projeto ChoiceForge; não exporta o jogo.",
      saveProjectAs: "Salvar projeto como...",
      saveProjectAsHint: "Escolhe um destino para o arquivo de projeto ChoiceForge.",
      importText: "Importar cenas de texto",
      importTextHint: "Importa arquivos de origem: ChoiceForge .json, ChoiceScript .zip ou cenas .txt.",
      importFolder: "Importar pasta de cenas",
      importFolderHint: "Importa uma pasta ChoiceScript com cenas .txt como um projeto.",
      exportZip: "Exportar ZIP ChoiceScript",
      exportZipHint: "Exporta a origem ChoiceScript jogável em .zip; diferente do arquivo de projeto.",
      exportGame: "Exportar jogo jogável",
      exportGameHint: "Baixa um ZIP com index.html, runtime e mídia para jogar no navegador após extrair.",
      exportDot: "Exportar grafo DOT",
      exportDotHint: "Exporta só o grafo do projeto como Graphviz .dot.",
      snapshots: "Snapshots",
      zoomIn: "Aumentar zoom",
      zoomOut: "Diminuir zoom",
      zoomReset: "Redefinir zoom",
      leftPanel: "Painel esquerdo",
      rightPanel: "Painel direito",
      language: "Idioma",
      theme: "Tema",
      density: "Densidade",
    };
  }
  if (lang === "es") {
    return {
      file: "Archivo",
      interfaceMenu: "Interfaz",
      newProject: "Nuevo proyecto",
      newProjectHint: "Crea un proyecto ChoiceForge vacío.",
      openProject: "Abrir proyecto / importar JSON",
      openProjectHint: "Abre archivo nativo en escritorio o importa .json/.zip/.txt en navegador.",
      openOrImportFiles: "Abrir/importar archivos",
      openOrImportFilesHint: "Selecciona .json, .zip o escenas .txt en el navegador.",
      saveProject: "Guardar proyecto",
      saveProjectHint: "Guarda el archivo de proyecto ChoiceForge; no exporta el juego.",
      saveProjectAs: "Guardar proyecto como...",
      saveProjectAsHint: "Elige destino para el archivo de proyecto ChoiceForge.",
      importText: "Importar escenas de texto",
      importTextHint: "Importa fuentes: ChoiceForge .json, ChoiceScript .zip o escenas .txt.",
      importFolder: "Importar carpeta de escenas",
      importFolderHint: "Importa una carpeta ChoiceScript con escenas .txt como proyecto.",
      exportZip: "Exportar ZIP ChoiceScript",
      exportZipHint: "Exporta la fuente ChoiceScript jugable en .zip; no es el archivo de proyecto.",
      exportGame: "Exportar juego jugable",
      exportGameHint: "Descarga un ZIP con index.html, runtime y medios para jugar en el navegador tras extraerlo.",
      exportDot: "Exportar grafo DOT",
      exportDotHint: "Exporta solo el grafo del proyecto como Graphviz .dot.",
      snapshots: "Capturas",
      zoomIn: "Aumentar zoom",
      zoomOut: "Disminuir zoom",
      zoomReset: "Restablecer zoom",
      leftPanel: "Panel izquierdo",
      rightPanel: "Panel derecho",
      language: "Idioma",
      theme: "Tema",
      density: "Densidad",
    };
  }
  return {
    file: "File",
    interfaceMenu: "Interface",
    newProject: "New project",
    newProjectHint: "Create an empty ChoiceForge project.",
    openProject: "Open project / import JSON",
    openProjectHint: "Open a native desktop file or import .json/.zip/.txt in the browser.",
    openOrImportFiles: "Open/import files",
    openOrImportFilesHint: "Select .json, .zip, or .txt scene files in the browser.",
    saveProject: "Save project",
    saveProjectHint: "Save the ChoiceForge project file; this does not export the game.",
    saveProjectAs: "Save project as...",
    saveProjectAsHint: "Choose a destination for the ChoiceForge project file.",
    importText: "Import text scenes",
    importTextHint: "Import source files: ChoiceForge .json, ChoiceScript .zip, or individual .txt scenes.",
    importFolder: "Import scenes folder",
    importFolderHint: "Import a ChoiceScript folder with .txt scenes as one project.",
    exportZip: "Export ChoiceScript ZIP",
    exportZipHint: "Export playable ChoiceScript source as a .zip; separate from the project file.",
    exportGame: "Export playable game",
    exportGameHint: "Download a ZIP with index.html, runtime and media; extract it to play in a browser.",
    exportDot: "Export graph DOT",
    exportDotHint: "Export only the project graph as a Graphviz .dot file.",
    snapshots: "Snapshots",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    zoomReset: "Reset zoom",
    leftPanel: "Left panel",
    rightPanel: "Right panel",
    language: "Language",
    theme: "Theme",
    density: "Density",
  };
}

function MenuButton({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const focusFirstOnOpenRef = useRef(false);
  const menuId = useId();

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!open) return;
    if (focusFirstOnOpenRef.current) {
      focusFirstOnOpenRef.current = false;
      focusFirstMenuItem();
    }
    const onAway = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) closeMenu(false);
    };
    const onEsc = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeMenu(true);
    };
    window.addEventListener("mousedown", onAway);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onAway);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const focusFirstMenuItem = () => {
    window.setTimeout(() => menuRef.current?.querySelector<HTMLElement>("[role^='menuitem']:not([disabled])")?.focus(), 0);
  };

  const handleButtonKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (open) {
        focusFirstMenuItem();
        return;
      }
      focusFirstOnOpenRef.current = true;
      setOpen(true);
    }
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role^='menuitem']:not([disabled])") ?? []);
    const current = items.indexOf(document.activeElement as HTMLElement);
    const delta = event.key === "ArrowDown" ? 1 : -1;
    items[(current + delta + items.length) % items.length]?.focus();
  };

  return (
    <span className="cf-menu-wrap" ref={containerRef}>
      <button ref={triggerRef} className={`ghost-btn cf-menu-trigger ${open ? "is-active" : ""}`} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((value) => !value)} onKeyDown={handleButtonKeyDown}>
        {label}
        <span className="cf-menu-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div
          id={menuId}
          className="cf-menu"
          role="menu"
          aria-label={label}
          ref={menuRef}
          onKeyDown={handleMenuKeyDown}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("[role^='menuitem']")) closeMenu(false);
          }}
        >
          {children}
        </div>
      )}
    </span>
  );
}

function MenuAction({ label, hint, onSelect, disabled }: { label: string; hint?: string; onSelect?: () => void; disabled?: boolean }) {
  return (
    <button className="cf-menu-item" role="menuitem" disabled={disabled} title={hint} onClick={() => onSelect?.()}>
      <span>{label}</span>
      {hint && <small>{hint}</small>}
    </button>
  );
}

function MenuCheckbox({ label, checked, onSelect }: { label: string; checked: boolean; onSelect: () => void }) {
  return (
    <button className="cf-menu-item" role="menuitemcheckbox" aria-checked={checked} onClick={onSelect}>
      <span>{checked ? "✓" : "○"} {label}</span>
    </button>
  );
}

function MenuSeparator() {
  return <div className="cf-menu-separator" role="separator" />;
}

interface FilePickerHandle {
  getFile: () => Promise<File>;
}

interface DirectoryPickerFileHandle extends FilePickerHandle {
  kind: "file";
  name: string;
}

interface DirectoryPickerDirectoryHandle {
  kind: "directory";
  name: string;
  values: () => AsyncIterable<DirectoryPickerFileHandle | DirectoryPickerDirectoryHandle>;
}

interface WindowWithFilePicker extends Window {
  showOpenFilePicker?: (options: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FilePickerHandle[]>;
  showDirectoryPicker?: () => Promise<DirectoryPickerDirectoryHandle>;
}

async function openImportPicker(onImport: (files: File[]) => void) {
  const showOpenFilePicker = (window as WindowWithFilePicker).showOpenFilePicker;
  if (showOpenFilePicker) {
    try {
      const handles = await showOpenFilePicker({
        multiple: true,
        excludeAcceptAllOption: false,
        types: [
          {
            description: "ChoiceForge project",
            accept: {
              "application/json": [".json"],
              "application/zip": [".zip"],
              "text/plain": [".txt"],
            },
          },
        ],
      });
      const files = await Promise.all(handles.map((handle) => handle.getFile()));
      if (files.length > 0) onImport(files);
    } catch (error) {
      if (isAbortError(error)) return;
      window.setTimeout(() => openImportInputFallback(onImport), 0);
    }
    return;
  }

  openImportInputFallback(onImport);
}

async function openImportFolderPicker(onImport: (files: File[]) => void) {
  const showDirectoryPicker = (window as WindowWithFilePicker).showDirectoryPicker;
  if (showDirectoryPicker) {
    try {
      const directory = await showDirectoryPicker();
      const files = await collectDirectoryFiles(directory, directory.name);
      if (files.length > 0) onImport(files);
    } catch (error) {
      if (isAbortError(error)) return;
      window.setTimeout(() => openImportFolderInputFallback(onImport), 0);
    }
    return;
  }

  openImportFolderInputFallback(onImport);
}

function openImportInputFallback(onImport: (files: File[]) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = "application/json,application/zip,text/plain,.json,.zip,.txt";
  input.style.position = "fixed";
  input.style.left = "-10000px";
  input.style.top = "0";
  input.style.opacity = "0";

  let cleaned = false;
  const handleFocus = () => window.setTimeout(cleanup, 500);
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    window.removeEventListener("focus", handleFocus);
    input.remove();
  };

  input.addEventListener("change", () => {
    const files = Array.from(input.files ?? []);
    cleanup();
    if (files.length > 0) onImport(files);
  }, { once: true });
  window.addEventListener("focus", handleFocus, { once: true });

  document.body.appendChild(input);
  input.click();
}

function openImportFolderInputFallback(onImport: (files: File[]) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = ".txt,text/plain";
  (input as HTMLInputElement & { webkitdirectory?: boolean }).webkitdirectory = true;
  input.style.position = "fixed";
  input.style.left = "-10000px";
  input.style.top = "0";
  input.style.opacity = "0";

  let cleaned = false;
  const handleFocus = () => window.setTimeout(cleanup, 500);
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    window.removeEventListener("focus", handleFocus);
    input.remove();
  };

  input.addEventListener("change", () => {
    const files = Array.from(input.files ?? []);
    cleanup();
    if (files.length > 0) onImport(files);
  }, { once: true });
  window.addEventListener("focus", handleFocus, { once: true });

  document.body.appendChild(input);
  input.click();
}

async function collectDirectoryFiles(directory: DirectoryPickerDirectoryHandle, prefix: string): Promise<File[]> {
  const files: File[] = [];
  for await (const entry of directory.values()) {
    const path = `${prefix}/${entry.name}`;
    if (entry.kind === "file") {
      const file = await entry.getFile();
      (file as File & { choiceForgeRelativePath?: string }).choiceForgeRelativePath = path;
      files.push(file);
    } else {
      files.push(...await collectDirectoryFiles(entry, path));
    }
  }
  return files;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function RecentFilesMenuItems({
  recentFiles,
  onOpenRecent,
  onClearRecent,
  recentLabel,
  clearLabel,
  emptyLabel,
}: {
  recentFiles: RecentFile[];
  onOpenRecent?: (path: string) => void;
  onClearRecent?: () => void;
  recentLabel: string;
  clearLabel: string;
  emptyLabel: string;
}) {
  return (
    <>
      <MenuSeparator />
      <div className="cf-menu-heading">{recentLabel}</div>
      {recentFiles.length === 0 ? (
        <div className="cf-menu-empty">{emptyLabel}</div>
      ) : (
        <>
          {recentFiles.map((entry) => (
            <button
              key={entry.path}
              className="cf-menu-item cf-recent-file-item"
              onClick={() => onOpenRecent?.(entry.path)}
              title={entry.path}
              role="menuitem"
            >
              <span>{basenameOf(entry.path)}</span>
              <small>{entry.path}</small>
            </button>
          ))}
          {onClearRecent && (
            <button className="cf-menu-item" onClick={onClearRecent} role="menuitem">
              <span>{clearLabel}</span>
            </button>
          )}
        </>
      )}
      <MenuSeparator />
    </>
  );
}
