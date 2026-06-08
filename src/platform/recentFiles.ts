const STORAGE_KEY = "choiceforge.recentFiles.v1";
const MAX_ENTRIES = 8;

export interface RecentFile {
  path: string;
  openedAt: number;
}

export function loadRecentFiles(): RecentFile[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is RecentFile =>
        !!entry && typeof entry === "object" && typeof (entry as RecentFile).path === "string" && typeof (entry as RecentFile).openedAt === "number")
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function addRecentFile(path: string): RecentFile[] {
  if (!path) return loadRecentFiles();
  const existing = loadRecentFiles().filter((entry) => entry.path !== path);
  const next: RecentFile[] = [{ path, openedAt: Date.now() }, ...existing].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  return next;
}

export function removeRecentFile(path: string): RecentFile[] {
  const next = loadRecentFiles().filter((entry) => entry.path !== path);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function clearRecentFiles(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Returns just the filename portion of a full path, handling both POSIX and Windows separators. */
export function basenameOf(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() ?? path;
}
