export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function nativeOpenProject(): Promise<{ path: string; content: string } | null> {
  if (!isTauri()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const selected = await open({
    filters: [{ name: "ChoiceForge Project", extensions: ["json"] }],
    multiple: false,
  });
  if (!selected || typeof selected !== "string") return null;
  const content = await readTextFile(selected);
  return { path: selected, content };
}

/** Read a specific .json project from disk (no dialog). Returns null if the file no longer exists. */
export async function nativeOpenProjectAt(path: string): Promise<{ path: string; content: string } | null> {
  if (!isTauri()) return null;
  const { readTextFile, exists } = await import("@tauri-apps/plugin-fs");
  if (!(await exists(path))) return null;
  const content = await readTextFile(path);
  return { path, content };
}

export async function nativeSaveProject(content: string, currentPath?: string): Promise<string | null> {
  if (!isTauri()) return null;
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  let path = currentPath;
  if (!path) {
    const chosen = await save({
      filters: [{ name: "ChoiceForge Project", extensions: ["json"] }],
      defaultPath: "project.json",
    });
    if (!chosen) return null;
    path = chosen;
  }
  await writeTextFile(path, content);
  return path;
}

export async function nativeSaveProjectAs(content: string): Promise<string | null> {
  return nativeSaveProject(content, undefined);
}

export async function nativeWriteProject(content: string, path: string): Promise<void> {
  if (!isTauri()) return;
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  await writeTextFile(path, content);
}

export async function nativeExportZip(bytes: Uint8Array, suggestedName: string): Promise<string | null> {
  return nativeSaveBytes(bytes, suggestedName, "ChoiceForge Export", ["zip"]);
}

export async function nativeSaveBytes(
  bytes: Uint8Array,
  suggestedName: string,
  filterLabel: string,
  extensions: string[],
): Promise<string | null> {
  if (!isTauri()) return null;
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  const chosen = await save({
    filters: [{ name: filterLabel, extensions }],
    defaultPath: suggestedName,
  });
  if (!chosen) return null;
  await writeFile(chosen, bytes);
  return chosen;
}

export async function setWindowTitle(title: string): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setTitle(title);
}
