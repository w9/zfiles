import { normalizeExplorerPath } from "../cloud/s3Paths";
import type { RunActionParams } from "./runActionParams";
import type { FileStat } from "./types";

export const STAT_CACHE_TTL_MS = 60_000;
export const DOWNLOAD_URL_REFRESH_BUFFER_MS = 5 * 60_000;
export const DEFAULT_PRESIGN_TTL_MS = 3_600_000;

type StatEntry = {
  stat: FileStat;
  expiresAtMs: number;
};

type DownloadEntry = {
  url: string;
  expiresAtMs: number;
};

function parseAmzDate(value: string): number | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second] = match;
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
}

export function parsePresignedUrlExpiryMs(url: string): number | null {
  try {
    const parsed = new URL(url);
    const date = parsed.searchParams.get("X-Amz-Date");
    const expires = parsed.searchParams.get("X-Amz-Expires");
    if (!date || !expires) {
      return null;
    }
    const issuedMs = parseAmzDate(date);
    const expiresSec = Number.parseInt(expires, 10);
    if (issuedMs == null || !Number.isFinite(expiresSec)) {
      return null;
    }
    return issuedMs + expiresSec * 1000;
  } catch {
    return null;
  }
}

export function isDownloadUrlFresh(
  expiresAtMs: number,
  now = Date.now(),
  refreshBufferMs = DOWNLOAD_URL_REFRESH_BUFFER_MS,
): boolean {
  return expiresAtMs - now > refreshBufferMs;
}

function renameDestPath(path: string, newName: string): string {
  const parent = normalizeExplorerPath(path).split("/").slice(0, -1).join("/");
  return parent ? `${parent}/${newName}` : newName;
}

function copyDestPath(source: string, destDir: string, newName?: string): string {
  const segments = normalizeExplorerPath(source).split("/");
  const sourceName = newName ?? segments.pop() ?? source;
  const normalizedDest = normalizeExplorerPath(destDir);
  return normalizedDest ? `${normalizedDest}/${sourceName}` : sourceName;
}

export function pathsAffectedByAction(params: RunActionParams): string[] {
  const { actionId, paths, destDir, newName } = params;
  switch (actionId) {
    case "file.delete":
      return [...paths];
    case "file.rename": {
      const path = paths[0];
      const nextName = newName?.trim();
      if (!path || !nextName) {
        return path ? [path] : [];
      }
      return [path, renameDestPath(path, nextName)];
    }
    case "file.copy":
    case "file.move": {
      if (!destDir) {
        return [...paths];
      }
      const affected = new Set<string>(paths);
      for (const source of paths) {
        const destPath = copyDestPath(source, destDir, newName && paths.length === 1 ? newName : undefined);
        affected.add(destPath);
      }
      return [...affected];
    }
    default:
      return [];
  }
}

export class BackendObjectCache {
  private stats = new Map<string, StatEntry>();
  private downloadUrls = new Map<string, DownloadEntry>();
  private inFlightStats = new Map<string, Promise<FileStat>>();
  private inFlightDownloadUrls = new Map<string, Promise<string>>();

  getCachedStat(path: string, now = Date.now()): FileStat | null {
    const entry = this.stats.get(path);
    if (!entry || entry.expiresAtMs <= now) {
      if (entry) {
        this.stats.delete(path);
      }
      return null;
    }
    return entry.stat;
  }

  setStat(path: string, stat: FileStat, now = Date.now(), ttlMs = STAT_CACHE_TTL_MS): void {
    this.stats.set(path, { stat, expiresAtMs: now + ttlMs });
  }

  getInFlightStat(path: string): Promise<FileStat> | null {
    return this.inFlightStats.get(path) ?? null;
  }

  trackInFlightStat(path: string, promise: Promise<FileStat>): Promise<FileStat> {
    this.inFlightStats.set(path, promise);
    void promise.finally(() => {
      if (this.inFlightStats.get(path) === promise) {
        this.inFlightStats.delete(path);
      }
    });
    return promise;
  }

  getCachedDownloadUrl(path: string, now = Date.now()): string | null {
    const entry = this.downloadUrls.get(path);
    if (!entry || !isDownloadUrlFresh(entry.expiresAtMs, now)) {
      if (entry) {
        this.downloadUrls.delete(path);
      }
      return null;
    }
    return entry.url;
  }

  setDownloadUrl(path: string, url: string, now = Date.now()): void {
    const expiresAtMs = parsePresignedUrlExpiryMs(url) ?? now + DEFAULT_PRESIGN_TTL_MS;
    this.downloadUrls.set(path, { url, expiresAtMs });
  }

  getInFlightDownloadUrl(path: string): Promise<string> | null {
    return this.inFlightDownloadUrls.get(path) ?? null;
  }

  trackInFlightDownloadUrl(path: string, promise: Promise<string>): Promise<string> {
    this.inFlightDownloadUrls.set(path, promise);
    void promise.finally(() => {
      if (this.inFlightDownloadUrls.get(path) === promise) {
        this.inFlightDownloadUrls.delete(path);
      }
    });
    return promise;
  }

  invalidatePath(path: string): void {
    this.stats.delete(path);
    this.downloadUrls.delete(path);
    this.inFlightStats.delete(path);
    this.inFlightDownloadUrls.delete(path);
  }

  invalidatePaths(paths: Iterable<string>): void {
    for (const path of paths) {
      this.invalidatePath(path);
    }
  }
}
