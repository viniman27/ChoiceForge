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

export async function setWindowTitle(title: string): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setTitle(title);
}
