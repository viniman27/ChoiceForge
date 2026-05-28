import type { ChoiceForgeProject, Density, EditorView, I18nLabels, Language, Theme } from "../domain/types";

interface TopBarProps {
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
  onImport: (files: File[]) => void;
  onExport: () => void;
  onNewProject: () => void;
  onSnapshots: () => void;
  onHelp: () => void;
  currentFilePath?: string | null;
  onNativeOpen?: () => void;
  onNativeSave?: () => void;
  onNativeSaveAs?: () => void;
}

export function TopBar({ data, lang, labels, theme, density, view, selectedNodeTitle, onLangChange, onThemeChange, onDensityChange, onViewChange, onMetadataChange, canUndo, canRedo, textModeActive, onUndo, onRedo, onSave, saveStatus, onTextMode, onPlay, onImport, onExport, onNewProject, onSnapshots, onHelp, currentFilePath, onNativeOpen, onNativeSave, onNativeSaveAs }: TopBarProps) {
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
        <code style={{ marginLeft: 12 }}>{data.sceneTitle}</code>
        {selectedNodeTitle && (
          <>
            <span className="dim">/</span>
            <code className="breadcrumb-node">{selectedNodeTitle}</code>
          </>
        )}
      </div>

      <div className="top-actions">
        <select className="ghost-btn" value={lang} onChange={(event) => onLangChange(event.target.value as Language)}>
          <option value="pt">PT-BR</option>
          <option value="en">EN</option>
          <option value="es">ES</option>
        </select>
        <select className="ghost-btn" value={theme} onChange={(event) => onThemeChange(event.target.value as Theme)}>
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
        <select className="ghost-btn" value={density} onChange={(event) => onDensityChange(event.target.value as Density)}>
          <option value="minimal">minimal</option>
          <option value="medium">medium</option>
          <option value="rich">rich</option>
        </select>
        <button className={`ghost-btn ${textModeActive ? "is-active" : ""}`} onClick={onTextMode}>{textModeActive ? labels.topBoardToggle : labels.topTextToggle}</button>
        <button className="ghost-btn" onClick={onUndo} disabled={!canUndo} title="Ctrl+Z">{labels.topUndo}</button>
        <button className="ghost-btn" onClick={onRedo} disabled={!canRedo} title="Ctrl+Shift+Z">{labels.topRedo}</button>
        {onNativeOpen && (
          <button className="ghost-btn" onClick={onNativeOpen} title={labels.topOpen}>{labels.topOpen}</button>
        )}
        {onNativeSave ? (
          <>
            <button className="ghost-btn" onClick={onNativeSave} title={`${labels.topSave} (Ctrl+S)`}>
              {currentFilePath ? labels.topSave : labels.topSaveAs}
            </button>
            {currentFilePath && (
              <button className="ghost-btn" onClick={onNativeSaveAs} title={labels.topSaveAs}>{labels.topSaveAs}</button>
            )}
          </>
        ) : (
          <button className="ghost-btn" onClick={onSave} title="Ctrl+S">{labels.topSave}</button>
        )}
        <button className="ghost-btn" onClick={onSnapshots} title={labels.snapTitle}>{labels.topSnapshots}</button>
        {saveStatus && <span className="save-status">{saveStatus}</span>}
        <button className="ghost-btn" onClick={onNewProject}>{labels.topNew}</button>
        <button
          className="ghost-btn"
          onClick={() => void openImportPicker(onImport)}
          title="Import one or more files: ChoiceForge .json, ChoiceScript .zip, or individual .txt scenes"
        >
          {labels.topImport}
        </button>
        <button
          className="ghost-btn"
          onClick={() => void openImportFolderPicker(onImport)}
          title="Import a folder: pick a directory and all .txt scenes inside it are imported as one project (shortcut for ChoiceScript game directories)"
        >
          {labels.topImportFolder}
        </button>
        <button className="ghost-btn" onClick={onExport}>{labels.export}</button>
        <button className="play-btn" onClick={onPlay}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor"><path d="M2 1l8 4.5-8 4.5z" /></svg>
          {labels.play}
        </button>
        <button className="ghost-btn hg-help-btn" onClick={onHelp} title="Help guide (?)">?</button>
      </div>
    </header>
  );
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
