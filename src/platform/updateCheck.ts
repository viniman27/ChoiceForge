const UPDATE_DISMISS_KEY = "choiceforge.updateCheck.dismissed";
const UPDATE_OPTOUT_KEY = "choiceforge.updateCheck.optout";
const RELEASES_LATEST = "https://api.github.com/repos/viniman27/ChoiceForge/releases/latest";

// Legacy localStorage key from the cached-check era — clean up if present.
const LEGACY_CACHE_KEY = "choiceforge.updateCheck.v1";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export interface UpdateInfo {
  version: string;
  url: string;
  /** True when running under Tauri and the bundled updater can install in-place. */
  canAutoInstall: boolean;
}

export interface InstallProgress {
  phase: "downloading" | "installing" | "done";
  downloaded?: number;
  total?: number | null;
}

function clearLegacyCache(): void {
  try {
    window.localStorage.removeItem(LEGACY_CACHE_KEY);
  } catch {
    // ignore
  }
}

export function isUpdateCheckOptedOut(): boolean {
  try {
    return window.localStorage.getItem(UPDATE_OPTOUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setUpdateCheckOptOut(optOut: boolean): void {
  try {
    if (optOut) window.localStorage.setItem(UPDATE_OPTOUT_KEY, "1");
    else window.localStorage.removeItem(UPDATE_OPTOUT_KEY);
  } catch {
    // ignore quota errors
  }
}

export function dismissUpdate(version: string): void {
  try {
    window.localStorage.setItem(UPDATE_DISMISS_KEY, version);
  } catch {
    // ignore
  }
}

export function isDismissed(version: string): boolean {
  try {
    return window.localStorage.getItem(UPDATE_DISMISS_KEY) === version;
  } catch {
    return false;
  }
}

export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  clearLegacyCache();
  if (isUpdateCheckOptedOut()) return null;
  if (isTauri()) {
    const tauriResult = await checkViaTauriUpdater();
    if (tauriResult) return tauriResult;
    // fall through to GitHub Releases poll if the Tauri updater can't reach the endpoint
  }
  try {
    const res = await fetch(RELEASES_LATEST, {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = await res.json() as { tag_name?: string; html_url?: string };
    const tag = typeof data.tag_name === "string" ? data.tag_name.replace(/^v/, "") : null;
    const url = typeof data.html_url === "string" ? data.html_url : null;
    if (!tag || !url) return null;
    return isNewer(tag, currentVersion) ? { version: tag, url, canAutoInstall: false } : null;
  } catch {
    return null;
  }
}

async function checkViaTauriUpdater(): Promise<UpdateInfo | null> {
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return null;
    return {
      version: update.version,
      url: `https://github.com/viniman27/ChoiceForge/releases/tag/v${update.version}`,
      canAutoInstall: true,
    };
  } catch {
    return null;
  }
}

export async function installUpdate(
  onProgress?: (progress: InstallProgress) => void,
): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const [{ check }, { relaunch }] = await Promise.all([
      import("@tauri-apps/plugin-updater"),
      import("@tauri-apps/plugin-process"),
    ]);
    const update = await check();
    if (!update) return false;
    let downloaded = 0;
    let totalBytes: number | null = null;
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        totalBytes = event.data.contentLength ?? null;
        onProgress?.({ phase: "downloading", downloaded: 0, total: totalBytes });
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        onProgress?.({ phase: "downloading", downloaded, total: totalBytes });
      } else if (event.event === "Finished") {
        onProgress?.({ phase: "installing" });
      }
    });
    onProgress?.({ phase: "done" });
    await relaunch();
    return true;
  } catch (err) {
    console.error("[ChoiceForge] update install failed", err);
    return false;
  }
}


export function isNewer(latest: string, current: string): boolean {
  const a = parts(latest);
  const b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

function parts(version: string): number[] {
  return version.replace(/^v/, "").split(".").map((segment) => {
    const numeric = parseInt(segment, 10);
    return Number.isFinite(numeric) ? numeric : 0;
  });
}
