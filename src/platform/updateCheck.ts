const UPDATE_CACHE_KEY = "choiceforge.updateCheck.v1";
const UPDATE_DISMISS_KEY = "choiceforge.updateCheck.dismissed";
const UPDATE_OPTOUT_KEY = "choiceforge.updateCheck.optout";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const RELEASES_LATEST = "https://api.github.com/repos/viniman27/ChoiceForge/releases/latest";

export interface UpdateInfo {
  version: string;
  url: string;
}

interface CachedCheck {
  checkedAt: number;
  latestVersion: string | null;
  url: string | null;
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
  if (isUpdateCheckOptedOut()) return null;
  const cached = readCache();
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return resolveCached(cached, currentVersion);
  }
  try {
    const res = await fetch(RELEASES_LATEST, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) return null;
    const data = await res.json() as { tag_name?: string; html_url?: string };
    const tag = typeof data.tag_name === "string" ? data.tag_name.replace(/^v/, "") : null;
    const url = typeof data.html_url === "string" ? data.html_url : null;
    writeCache({ checkedAt: Date.now(), latestVersion: tag, url });
    if (!tag || !url) return null;
    return isNewer(tag, currentVersion) ? { version: tag, url } : null;
  } catch {
    return null;
  }
}

function resolveCached(cached: CachedCheck, currentVersion: string): UpdateInfo | null {
  if (!cached.latestVersion || !cached.url) return null;
  return isNewer(cached.latestVersion, currentVersion)
    ? { version: cached.latestVersion, url: cached.url }
    : null;
}

function readCache(): CachedCheck | null {
  try {
    const raw = window.localStorage.getItem(UPDATE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedCheck;
  } catch {
    return null;
  }
}

function writeCache(cache: CachedCheck): void {
  try {
    window.localStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
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
